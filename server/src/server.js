require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { extractPdfPages } = require("./services/pdf.service");
const { detectChapters, selectChapter } = require("./services/chapter.service");
const { generateQuestions } = require("./services/questions.service");
const { getAuthorizationUrl, exchangeCode, getConnectionStatus, createGoogleForm } = require("./services/google-forms.service");
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
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8"); }
const forms = readJson(formsFile, {});
const questionHistory = readJson(historyFile, {});
const googleOAuthStates = new Map();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const isPdf = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    cb(isPdf ? null : new Error("Please upload a PDF file."), isPdf);
  },
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", message: "Aviation Exam Generator API is running" });
});

app.post("/api/documents/analyze", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a PDF file first." });
    const pages = await extractPdfPages(req.file.buffer);
    const sourceText = pages.map((p) => `-- ${p.number} of ${pages.length} --\n${p.text}`).join("\n\n");
    const nonWhitespace = sourceText.replace(/\s/g, "").length;
    if (nonWhitespace < 500) {
      return res.status(422).json({ error: "Very little text was extracted. This PDF may be scanned/image-only; OCR is not included." });
    }
    const chapters = detectChapters(sourceText);
    const documentId = require("crypto").randomUUID();
    const now = Date.now();
    for (const [id, session] of documentSessions) {
      if (now - session.createdAt > SESSION_TTL_MS) documentSessions.delete(id);
    }
    documentSessions.set(documentId, { sourceText, fileName: req.file.originalname, pageCount: pages.length, createdAt: now });
    res.json({
      documentId,
      fileName: req.file.originalname,
      pageCount: pages.length,
      extractedCharacters: sourceText.length,
      chapters,
      extractionPreview: sourceText.slice(0, 900),
      warning: chapters.length ? null : "No chapter headings were detected. This PDF may use a different heading layout."
    });
  } catch (error) { next(error); }
});


app.post("/api/documents/chapter-preview", (req, res, next) => {
  try {
    const { documentId, chapter } = req.body || {};
    const session = documentSessions.get(documentId);
    if (!session) return res.status(410).json({ error: "This PDF analysis expired or the server restarted. Analyze the PDF again." });
    const result = selectChapter(session.sourceText, chapter);
    res.json({
      chapter: result.chapter, heading: result.heading, title: result.title,
      startPage: result.startPage, endPage: result.endPage,
      extractedCharacters: result.text.length, preview: result.text.slice(0, 2200),
      sourceText: result.text
    });
  } catch (error) { next(error); }
});

app.post("/api/questions/generate", async (req, res, next) => {
  try {
    const { sourceText, chapter, title, startPage, endPage, count = 10, difficulty = "mixed", questionType = "mixed" } = req.body || {};
    if (!Number.isInteger(count) || count < 1 || count > 30) {
      return res.status(400).json({ error: "Question count must be an integer between 1 and 30." });
    }
    if (typeof sourceText !== "string" || sourceText.trim().length < 500) {
      return res.status(400).json({ error: "Preview a chapter first. The selected chapter text is missing or too short." });
    }
    if (!["easy", "medium", "hard", "mixed"].includes(difficulty)) {
      return res.status(400).json({ error: "Choose a valid difficulty." });
    }
    if (!["theory", "numerical", "mixed"].includes(questionType)) {
      return res.status(400).json({ error: "Choose theory, numerical, or mixed question type." });
    }
    const sourceKey = crypto.createHash("sha256").update(`${String(title || "").toLowerCase()}|${sourceText}`).digest("hex");
    const priorQuestions = questionHistory[sourceKey] || [];
    const questions = await generateQuestions({
      chapter: Number(chapter), title: String(title || `Chapter ${chapter}`),
      startPage, endPage, text: sourceText
    }, { count, difficulty, questionType, priorQuestions });
    const priorSet = new Set(priorQuestions.map((q) => String(q.question || "").trim().toLowerCase()));
    const fresh = questions.filter((q) => !priorSet.has(String(q.question).trim().toLowerCase()));
    questionHistory[sourceKey] = [...priorQuestions, ...fresh.map((q) => ({ question: q.question, concept: q.concept || "" }))].slice(-500);
    writeJson(historyFile, questionHistory);
    res.json({ chapter: Number(chapter), title, startPage, endPage, questions: fresh });
  } catch (error) { next(error); }
});




app.get("/api/google/status", async (_req, res) => {
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  if (!configured) return res.json({ connected: false, configured: false, reason: "Google OAuth credentials are missing." });
  try { res.json({ configured: true, ...(await getConnectionStatus()) }); }
  catch (error) { res.json({ connected: false, configured: true, reason: error.message }); }
});

app.get("/api/google/auth-url", (_req, res, next) => {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    googleOAuthStates.set(state, Date.now());
    for (const [key, createdAt] of googleOAuthStates) {
      if (Date.now() - createdAt > 10 * 60 * 1000) googleOAuthStates.delete(key);
    }
    res.json({ url: getAuthorizationUrl(state) });
  } catch (error) { next(error); }
});

app.get("/api/google/oauth/callback", async (req, res) => {
  const frontendUrl = process.env.GOOGLE_FRONTEND_URL || "http://localhost:5173";
  const state = String(req.query.state || "");
  if (req.query.error) return res.redirect(`${frontendUrl}/?google=error&reason=${encodeURIComponent(String(req.query.error))}`);
  if (!state || !googleOAuthStates.has(state)) {
    return res.redirect(`${frontendUrl}/?google=error&reason=${encodeURIComponent("Invalid or expired OAuth state. Please connect again.")}`);
  }
  googleOAuthStates.delete(state);
  try {
    await exchangeCode(String(req.query.code || ""));
    res.redirect(`${frontendUrl}/?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error.message);
    res.redirect(`${frontendUrl}/?google=error&reason=${encodeURIComponent(error.message || "Google authorization failed")}`);
  }
});

app.post("/api/google/forms/create", async (req, res, next) => {
  try {
    const { title, description = "", questions, settings = {} } = req.body || {};
    if (!String(title || "").trim()) return res.status(400).json({ error: "Google Form title is required." });
    const created = await createGoogleForm({ title, description, questions, settings });
    res.status(201).json(created);
  } catch (error) { next(error); }
});

app.post("/api/forms", (req, res) => {
  const { title, description = "", questions, settings = {}, source = {} } = req.body || {};
  if (!String(title || "").trim()) return res.status(400).json({ error: "Form title is required." });
  if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: "Generate questions before creating a form." });
  const id = crypto.randomBytes(9).toString("hex");
  forms[id] = {
    id, title: String(title).trim(), description: String(description).trim(),
    questions: questions.map((q, i) => ({ id: i + 1, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || "" })),
    settings: { collectName: Boolean(settings.collectName), collectEmail: Boolean(settings.collectEmail), shuffleQuestions: Boolean(settings.shuffleQuestions), showScore: settings.showScore !== false },
    source, createdAt: new Date().toISOString(), submissions: []
  };
  writeJson(formsFile, forms);
  res.status(201).json({ id, title: forms[id].title, sharePath: `/form/${id}`, questionCount: questions.length });
});

app.get("/api/forms/:id", (req, res) => {
  const form = forms[req.params.id];
  if (!form) return res.status(404).json({ error: "This form does not exist or is no longer available." });
  const { submissions, ...publicForm } = form;
  res.json({ ...publicForm, questions: publicForm.questions.map(({ correctAnswer, explanation, ...q }) => q) });
});

app.post("/api/forms/:id/submit", (req, res) => {
  const form = forms[req.params.id];
  if (!form) return res.status(404).json({ error: "This form does not exist or is no longer available." });
  const { answers = {}, name = "", email = "" } = req.body || {};
  if (form.settings.collectName && !String(name).trim()) return res.status(400).json({ error: "Please enter your name." });
  if (form.settings.collectEmail && !String(email).trim()) return res.status(400).json({ error: "Please enter your email." });
  if (form.questions.some((q) => !["A", "B", "C", "D"].includes(answers[q.id]))) return res.status(400).json({ error: "Please answer every question before submitting." });
  const score = form.questions.reduce((sum, q) => sum + (answers[q.id] === q.correctAnswer ? 1 : 0), 0);
  form.submissions.push({ id: crypto.randomUUID(), name: String(name).slice(0, 200), email: String(email).slice(0, 320), answers, score, submittedAt: new Date().toISOString() });
  writeJson(formsFile, forms);
  res.json({ submitted: true, score: form.settings.showScore ? score : null, total: form.settings.showScore ? form.questions.length : null, showScore: form.settings.showScore });
});

app.get("/api/forms/:id/results", (req, res) => {
  const form = forms[req.params.id];
  if (!form) return res.status(404).json({ error: "Form not found." });
  res.json({ title: form.title, submissions: form.submissions.map(({ answers, ...submission }) => submission), totalSubmissions: form.submissions.length });
});

app.use((err, _req, res, _next) => {
  console.error(`[API error] ${err.message}`);
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ error: status === 413 ? `PDF exceeds the ${maxUploadMb} MB upload limit.` : err.message });
  }
  if (err.status) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: err.message || "Unexpected server error." });
});

app.listen(port, () => console.log(`Aviation Exam Generator API listening at http://localhost:${port}`));
