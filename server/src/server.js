require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { extractPdfPages } = require("./services/pdf.service");
const { detectChapters, selectChapter } = require("./services/chapter.service");
const { generateQuestions } = require("./services/questions.service");
const {
  getAuthorizationUrl,
  exchangeCode,
  getConnectionStatus,
  createGoogleForm,
} = require("./services/google-forms.service");

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const port = Number(process.env.PORT || 5000);

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 30);
const documentSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const dataDir = path.join(__dirname, "..", "data");
const formsFile = path.join(dataDir, "forms.json");
const historyFile = path.join(dataDir, "question-history.json");

fs.mkdirSync(dataDir, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}
const forms = readJson(formsFile, {});
const questionHistory = readJson(historyFile, {});
const googleOAuthStates = new Map();

// CORS configuration to allow requests from specific origins
const allowedOrigins = [
  "http://localhost:5173",
  "https://aviation-lab.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  }),
);


app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const isPdf =
      file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    cb(isPdf ? null : new Error("Please upload a PDF file."), isPdf);
  },
});

// Health check endpoint to verify that the API is running and working correctly
app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", message: "Aviation Exam Generator API is running" });
});

// Analyze a PDF document and extract text, chapters, and metadata
app.post(
  "/api/documents/analyze",
  upload.single("file"),
  async (req, res, next) => {
    try {
      // Validate that a PDF file was uploaded and extract its pages and text
      if (!req.file)
        return res.status(400).json({ error: "Choose a PDF file first." });
      const pages = await extractPdfPages(req.file.buffer);
      const sourceText = pages
        .map((p) => `-- ${p.number} of ${pages.length} --\n${p.text}`)
        .join("\n\n");
      const nonWhitespace = sourceText.replace(/\s/g, "").length;
      // If the extracted text is too short, return an error indicating that OCR is not included
      if (nonWhitespace < 500) {
        return res
          .status(422)
          .json({
            error:
              "Very little text was extracted. This PDF may be scanned/image-only; OCR is not included.",
          });
      }
      const chapters = detectChapters(sourceText);
      const documentId = require("crypto").randomUUID();
      const now = Date.now();
      // Clean up expired document sessions to free memory and maintain session integrity
      for (const [id, session] of documentSessions) {
        if (now - session.createdAt > SESSION_TTL_MS)
          documentSessions.delete(id);
      }
      documentSessions.set(documentId, {
        sourceText,
        fileName: req.file.originalname,
        pageCount: pages.length,
        createdAt: now,
      });
      // Return the analysis results, including document ID, file name, page count, extracted characters, chapters, and a preview of the extracted text
      res.json({
        documentId,
        fileName: req.file.originalname,
        pageCount: pages.length,
        extractedCharacters: sourceText.length,
        chapters,
        extractionPreview: sourceText.slice(0, 900),
        warning: chapters.length
          ? null
          : "No chapter headings were detected. This PDF may use a different heading layout.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Preview a specific chapter from the analyzed PDF document
app.post("/api/documents/chapter-preview", (req, res, next) => {
  try {
    const { documentId, chapter } = req.body || {};
    const session = documentSessions.get(documentId);
    // If the session has expired or the document ID is invalid, return an error indicating that the PDF analysis has expired
    if (!session)
      return res
        .status(410)
        .json({
          error:
            "This PDF analysis expired or the server restarted. Analyze the PDF again.",
        });
    const result = selectChapter(session.sourceText, chapter);
    res.json({
      chapter: result.chapter,
      heading: result.heading,
      title: result.title,
      startPage: result.startPage,
      endPage: result.endPage,
      extractedCharacters: result.text.length,
      preview: result.text.slice(0, 2200),
      sourceText: result.text,
    });
  } catch (error) {
    next(error);
  }
});

// Generate questions based on the selected chapter text and user preferences
app.post("/api/questions/generate", async (req, res, next) => {
  try {
    const {
      sourceText,
      chapter,
      title,
      startPage,
      endPage,
      count = 10,
      difficulty = "mixed",
      questionType = "mixed",
    } = req.body || {};
    // Validate the input parameters for question generation, including count, source text length, difficulty, and question type
    if (!Number.isInteger(count) || count < 1 || count > 30) {
      return res
        .status(400)
        .json({ error: "Question count must be an integer between 1 and 30." });
    }

    // Validate that the source text is a string and has a minimum length of 500 characters
    if (typeof sourceText !== "string" || sourceText.trim().length < 500) {
      return res
        .status(400)
        .json({
          error:
            "Preview a chapter first. The selected chapter text is missing or too short.",
        });
    }

    // Validate that the difficulty level is one of the allowed values: "easy", "medium", "hard", or "mixed"
    if (!["easy", "medium", "hard", "mixed"].includes(difficulty)) {
      return res.status(400).json({ error: "Choose a valid difficulty." });
    }

    // Validate that the question type is one of the allowed values: "theory", "numerical", or "mixed"
    if (!["theory", "numerical", "mixed"].includes(questionType)) {
      return res
        .status(400)
        .json({ error: "Choose theory, numerical, or mixed question type." });
    }

    const sourceKey = crypto
      .createHash("sha256")
      .update(`${String(title || "").toLowerCase()}|${sourceText}`)
      .digest("hex");
    const priorQuestions = questionHistory[sourceKey] || [];
    const questions = await generateQuestions(
      {
        chapter: Number(chapter),
        title: String(title || `Chapter ${chapter}`),
        startPage,
        endPage,
        text: sourceText,
      },
      { count, difficulty, questionType, priorQuestions },
    );
    const priorSet = new Set(
      priorQuestions.map((q) =>
        String(q.question || "")
          .trim()
          .toLowerCase(),
      ),
    );
    const fresh = questions.filter(
      (q) => !priorSet.has(String(q.question).trim().toLowerCase()),
    );

    questionHistory[sourceKey] = [
      ...priorQuestions,
      ...fresh.map((q) => ({ question: q.question, concept: q.concept || "" })),
    ].slice(-500);
    writeJson(historyFile, questionHistory);
    res.json({
      chapter: Number(chapter),
      title,
      startPage,
      endPage,
      questions: fresh,
    });
  } catch (error) {
    next(error);
  }
});

// Google OAuth and Google Forms integration endpoints
app.get("/api/google/status", async (_req, res) => {
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI,
  );
  // If Google OAuth credentials are missing, return a response indicating that the connection is not configured
  if (!configured)
    return res.json({
      connected: false,
      configured: false,
      reason: "Google OAuth credentials are missing.",
    });
  try {
    res.json({ configured: true, ...(await getConnectionStatus()) });
  } catch (error) {
    res.json({ connected: false, configured: true, reason: error.message });
  }
});

// Generate a Google OAuth authorization URL for the frontend to initiate the OAuth flow
app.get("/api/google/auth-url", (_req, res, next) => {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    googleOAuthStates.set(state, Date.now());
    for (const [key, createdAt] of googleOAuthStates) {
      // Clean up expired OAuth states to prevent memory leaks and maintain security
      if (Date.now() - createdAt > 10 * 60 * 1000)
        googleOAuthStates.delete(key);
    }
    res.json({ url: getAuthorizationUrl(state) });
  } catch (error) {
    next(error);
  }
});

// Handle the Google OAuth callback, exchange the authorization code for tokens, and redirect to the frontend
app.get("/api/google/oauth/callback", async (req, res) => {
  const frontendUrl =
    process.env.GOOGLE_FRONTEND_URL || "http://localhost:5173";
  const state = String(req.query.state || "");

  // If there is an error in the query parameters, redirect to the frontend with an error message
  if (req.query.error)
    return res.redirect(
      `${frontendUrl}/?google=error&reason=${encodeURIComponent(String(req.query.error))}`,
    );
  if (!state || !googleOAuthStates.has(state)) {
    return res.redirect(
      `${frontendUrl}/?google=error&reason=${encodeURIComponent("Invalid or expired OAuth state. Please connect again.")}`,
    );
  }
  googleOAuthStates.delete(state);
  try {
    // Exchange the authorization code for access tokens and redirect to the frontend with a success message
    await exchangeCode(String(req.query.code || ""));
    res.redirect(`${frontendUrl}/?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error.message);
    res.redirect(
      `${frontendUrl}/?google=error&reason=${encodeURIComponent(error.message || "Google authorization failed")}`,
    );
  }
});

// Create a new Google Form with the provided title, description, questions, and settings
app.post("/api/google/forms/create", async (req, res, next) => {
  try {
    const {
      title,
      description = "",
      questions,
      settings = {},
    } = req.body || {};
    // Validate that the title is provided and not just whitespace; if not, return a 400 error response
    if (!String(title || "").trim())
      return res.status(400).json({ error: "Google Form title is required." });
    const created = await createGoogleForm({
      title,
      description,
      questions,
      settings,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// Form management endpoints for creating, retrieving, submitting, and viewing results of forms
app.post("/api/forms", (req, res) => {
  const {
    title,
    description = "",
    questions,
    settings = {},
    source = {},
  } = req.body || {};

  // Validate that the title is provided and not just whitespace; if not, return a 400 error response
  if (!String(title || "").trim())
    return res.status(400).json({ error: "Form title is required." });
  // Validate that the questions array is provided and not empty; if not, return a 400 error response
  if (!Array.isArray(questions) || !questions.length)
    return res
      .status(400)
      .json({ error: "Generate questions before creating a form." });
  const id = crypto.randomBytes(9).toString("hex");

  forms[id] = {
    id,
    title: String(title).trim(),
    description: String(description).trim(),
    questions: questions.map((q, i) => ({
      id: i + 1,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "",
    })),
    settings: {
      collectName: Boolean(settings.collectName),
      collectEmail: Boolean(settings.collectEmail),
      shuffleQuestions: Boolean(settings.shuffleQuestions),
      showScore: settings.showScore !== false,
    },
    source,
    createdAt: new Date().toISOString(),
    submissions: [],
  };

  writeJson(formsFile, forms);
  res
    .status(201)
    .json({
      id,
      title: forms[id].title,
      sharePath: `/form/${id}`,
      questionCount: questions.length,
    });
});

// Retrieve a specific form by ID, excluding correct answers and explanations for public access
app.get("/api/forms/:id", (req, res) => {
  const form = forms[req.params.id];
  // If the form does not exist, return a 404 error response indicating that the form is not available
  if (!form)
    return res
      .status(404)
      .json({ error: "This form does not exist or is no longer available." });
  const { submissions, ...publicForm } = form;
  res.json({
    ...publicForm,
    questions: publicForm.questions.map(
      ({ correctAnswer, explanation, ...q }) => q,
    ),
  });
});

// Submit answers to a specific form, validate inputs, calculate score, and store the submission
app.post("/api/forms/:id/submit", (req, res) => {
  const form = forms[req.params.id];
  // If the form does not exist, return a 404 error response indicating that the form is not available
  if (!form)
    return res
      .status(404)
      .json({ error: "This form does not exist or is no longer available." });
  const { answers = {}, name = "", email = "" } = req.body || {};
  // Validate that the required fields (name, email, and answers) are provided based on the form settings; if not, return a 400 error response
  if (form.settings.collectName && !String(name).trim())
    return res.status(400).json({ error: "Please enter your name." });
  // Validate that the required fields (name, email, and answers) are provided based on the form settings; if not, return a 400 error response
  if (form.settings.collectEmail && !String(email).trim())
    return res.status(400).json({ error: "Please enter your email." });
  // Validate that all questions have been answered and that the answers are valid options; if not, return a 400 error response
  if (form.questions.some((q) => !["A", "B", "C", "D"].includes(answers[q.id])))
    return res
      .status(400)
      .json({ error: "Please answer every question before submitting." });

  const score = form.questions.reduce(
    (sum, q) => sum + (answers[q.id] === q.correctAnswer ? 1 : 0),
    0,
  );
  form.submissions.push({
    id: crypto.randomUUID(),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 320),
    answers,
    score,
    submittedAt: new Date().toISOString(),
  });
  writeJson(formsFile, forms);
  res.json({
    submitted: true,
    score: form.settings.showScore ? score : null,
    total: form.settings.showScore ? form.questions.length : null,
    showScore: form.settings.showScore,
  });
});

// Retrieve the results of a specific form, including submission details and total submissions
app.get("/api/forms/:id/results", (req, res) => {
  const form = forms[req.params.id];
  // If the form does not exist, return a 404 error response indicating that the form is not available
  if (!form) return res.status(404).json({ error: "Form not found." });
  res.json({
    title: form.title,
    submissions: form.submissions.map(
      ({ answers, ...submission }) => submission,
    ),
    totalSubmissions: form.submissions.length,
  });
});

// Global error handling middleware to catch and respond to errors consistently
app.use((err, _req, res, _next) => {
  console.error(`[API error] ${err.message}`);
  // Handle Multer errors specifically, returning appropriate status codes and messages for file upload issues
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res
      .status(status)
      .json({
        error:
          status === 413
            ? `PDF exceeds the ${maxUploadMb} MB upload limit.`
            : err.message,
      });
  }

  // If the error has a status property, use it to set the response status code and return the error message; otherwise, return a 500 Internal Server Error with a generic message
  if (err.status) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: err.message || "Unexpected server error." });
});

// Start the Express server and listen on the specified port, logging a message to indicate that the API is running
app.listen(port, "0.0.0.0", () => {
  console.log(`Aviation Exam Generator API listening on port ${port}`);
});
