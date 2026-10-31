const { GoogleGenAI } = require("@google/genai");

function parseJson(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first >= 0 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1));
  }

  throw new Error("The AI returned invalid JSON. Please retry.");
}

// Check if the error is a retryable Gemini error based on status codes and message patterns.
function isRetryableGeminiError(error) {
  const status = Number(
    error?.status || error?.statusCode || error?.response?.status,
  );
  const message = String(error?.message || "");

  return (
    status === 429 ||
    status === 503 ||
    status >= 500 ||
    /\b(429|503)\b/.test(message) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL/i.test(message)
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate content using the Gemini API with retry logic for transient errors.
async function generateWithRetry(ai, model, prompt) {
  const maxAttempts = 4;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model,
        contents: prompt,
      });
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetryableGeminiError(error)) {
        throw error;
      }

      const delayMs = 1000 * 2 ** (attempt - 1);

      console.warn(
        `Temporary Gemini error (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms.`,
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

// Generate multiple-choice questions based on the provided chapter text, count, difficulty, and question type. Returns an array of generated questions.
async function generateQuestions(
  chapter,
  { count, difficulty, questionType = "mixed", priorQuestions = [] },
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "AI generation is not configured. Add GEMINI_API_KEY to server/.env.",
    );
    error.status = 503;
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const maxChars = Math.max(
    5000,
    Number(process.env.MAX_AI_SOURCE_CHARS || 50000),
  );

  const text = String(chapter.text || "").slice(0, maxChars);

  // Mixed mode targets 60% numerical and 40% theory.
  const numericalCount = Math.round(count * 0.6);
  const theoryCount = count - numericalCount;

  const typeInstructions = {
    theory: `Generate THEORY questions only. Every question must test conceptual understanding, definitions, rules, regulations, procedures, or aviation principles. Do not include calculation-based questions. Set type to "theory" for every question.`,
    numerical: `Generate NUMERICAL questions only. Questions must require calculations or mathematical reasoning. Include all necessary values and units in each question. Use only formulas and facts supported by the source excerpt. Do not invent missing values, formulas, or aviation facts. Set type to "numerical" for every question. If the excerpt does not support enough numerical questions, do not fabricate questions.`,
    mixed: `Generate exactly ${numericalCount} NUMERICAL questions and ${theoryCount} THEORY questions. This distribution is mandatory: - Numerical: ${numericalCount} - Theory: ${theoryCount} A NUMERICAL question must require the learner to calculate a value, solve a quantitative problem, or apply a formula using numerical inputs. Merely mentioning a number, speed, altitude, time, or distance does NOT make a question numerical. A THEORY question tests concepts, definitions, rules, regulations, procedures, or principles without requiring a calculation. Do not classify a theory question as numerical just because it contains numbers. Do not classify a calculation question as theory. Use type "numerical" for numerical questions and type "theory" for theory questions. Follow the requested distribution exactly. Use only formulas and facts supported by the excerpt. If the source cannot support the requested numerical questions, do not invent formulas, values, or aviation facts.`,
  };

  const typeInstruction =
    typeInstructions[questionType] || typeInstructions.mixed;

  const excluded = priorQuestions
    .slice(-80)
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join("\n");

  const prompt = `
    You are an aviation examination question writer. 
    Create exactly ${count} multiple-choice questions. 
    Difficulty: ${difficulty}. Requested question mode: ${questionType}. 
    QUESTION-TYPE REQUIREMENTS: ${typeInstruction} 
    QUALITY RULES:
      1. Use only information supported by the supplied textbook excerpt.
      2. Every question must have exactly four plausible answer options.
      3. correctAnswer must be exactly "A", "B", "C", or "D".
      4. Explain the correct answer using the supplied excerpt.
      5. Numerical questions must be independently solvable from the
        question and its supplied values.
      6. Include appropriate units in numerical questions and answers
        where applicable.
      7. Do not repeat or lightly rephrase previously generated questions.
      8. Cover different concepts and applications where possible.
      9. Do not add unsupported aviation facts or formulas.
      10. Return valid JSON only. Do not use Markdown code fences.
    Return this JSON structure:
      {
        "questions": [
          {
            "question": "Question text",
            "type": "numerical",
            "options": [
              "A. First option",
              "B. Second option",
              "C. Third option",
              "D. Fourth option"
            ],
            "correctAnswer": "A",
            "explanation": "Explanation supported by the excerpt",
            "concept": "Concept being tested"
          }
        ]
      }

    The type field must be exactly "numerical" or "theory".
    For mixed mode, verify the required numerical and theory counts
    before returning the JSON.

    Chapter: ${chapter.title}

    Previously generated questions to avoid: ${excluded || "None yet."}

    Source excerpt: ${text}
  `;

  let response;

  try {
    response = await generateWithRetry(ai, model, prompt);
  } catch (cause) {
    const error = new Error(
      `Gemini request failed: ${
        cause.message || "unknown error"
      }. Check model access, API key, network, and quota.`,
    );

    error.status = 502;
    throw error;
  }

  const parsed = parseJson(response.text);

  // Validate that the parsed response contains a questions array. If not, throw an error with status 502.
  if (!Array.isArray(parsed.questions)) {
    throw new Error("The AI response did not include a questions array.");
  }

  const questions = parsed.questions.slice(0, count).map((q, i) => {
    if (
      !q ||
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      !["A", "B", "C", "D"].includes(q.correctAnswer) ||
      !["theory", "numerical"].includes(q.type)
    ) {
      throw new Error(
        `The AI returned an invalid question or question type at position ${
          i + 1
        }. Please retry.`,
      );
    }

    return {
      id: i + 1,
      question: q.question,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: String(q.explanation || ""),
      concept: String(q.concept || ""),
    };
  });

  if (questions.length !== count) {
    throw new Error(
      `The AI returned ${questions.length} questions instead of ${count}. Please retry.`,
    );
  }

  if (questionType === "mixed") {
    const actualNumerical = questions.filter(
      (q) => q.type === "numerical",
    ).length;

    const actualTheory = questions.filter((q) => q.type === "theory").length;

    if (actualNumerical !== numericalCount || actualTheory !== theoryCount) {
      const error = new Error(
        `The AI returned ${actualNumerical} numerical and ${actualTheory} theory questions. The requested distribution is ${numericalCount} numerical and ${theoryCount} theory. Please generate again.`,
      );

      error.status = 502;
      throw error;
    }
  }

  if (!questions.length) {
    throw new Error("The AI returned no valid questions.");
  }

  return questions;
}

module.exports = {
  generateQuestions,
  parseJson,
  isRetryableGeminiError,
  generateWithRetry,
};
