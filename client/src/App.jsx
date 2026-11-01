import { useEffect, useMemo, useState } from "react";
import {
  Plane,
  UploadCloud,
  FileText,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Download,
  RotateCcw,
  ClipboardList,
  Link2,
  Copy,
  ArrowLeft,
} from "lucide-react";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndService from "./pages/TermsAndService";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      "Cannot reach the backend. Start the server in the server folder and try again.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function PublicForm({ formId }) {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    apiRequest(`${API}/api/forms/${formId}`)
      .then(setForm)
      .catch((e) => setError(e.message));
  }, [formId]);

  async function submitForm() {
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest(`${API}/api/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, name, email }),
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="/">
            <span className="brand-icon">
              <Plane size={20} />
            </span>
            <span>
              AVIATION<span className="brand-light">LAB</span>
              <small>EXAM PREPARATION</small>
            </span>
          </a>
        </header>
        <main className="main">
          <section className="panel result-panel">
            <div className="verified">
              <CheckCircle2 size={16} /> Response submitted
            </div>
            <h1 className="public-title">Thank you for submitting!</h1>
            {result.showScore && (
              <p className="public-description">
                Your score:{" "}
                <strong>
                  {result.score}/{result.total}
                </strong>
              </p>
            )}
            <p className="helper">Your response has been saved.</p>
          </section>
        </main>
      </div>
    );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Plane size={20} />
          </span>
          <span>
            AVIATION<span className="brand-light">LAB</span>
            <small>EXAM PREPARATION</small>
          </span>
        </a>
        <span className="top-pill">Form response</span>
      </header>
      <main className="main public-main">
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {!form ? (
          <section className="panel">Loading form…</section>
        ) : (
          <>
            <section className="panel">
              <div className="eyebrow">AVIATIONLAB FORM</div>
              <h1 className="public-title">{form.title}</h1>
              <p className="public-description">{form.description}</p>
              {form.source?.chapterTitle && (
                <p className="helper">Source: {form.source.chapterTitle}</p>
              )}
            </section>
            <section className="panel result-panel">
              {form.settings.collectName && (
                <div className="form-field">
                  <label className="field-label">Your name *</label>
                  <input
                    className="field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              {form.settings.collectEmail && (
                <div className="form-field">
                  <label className="field-label">Email address *</label>
                  <input
                    className="field"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
              {(form.settings.shuffleQuestions
                ? [...form.questions].sort(
                    (a, b) => ((a.id * 17) % 23) - ((b.id * 17) % 23),
                  )
                : form.questions
              ).map((q, i) => (
                <article className="question" key={q.id}>
                  <div className="question-number">
                    QUESTION {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3>{q.question}</h3>
                  <div className="options">
                    {q.options.map((option, j) => {
                      const letter = ["A", "B", "C", "D"][j];
                      return (
                        <button
                          type="button"
                          key={letter}
                          className={`option ${answers[q.id] === letter ? "selected" : ""}`}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: letter }))
                          }
                        >
                          <span>{letter}</span>
                          {option.replace(/^[A-D][.)]\s*/, "")}
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
              <button
                className="button button-primary full"
                disabled={busy || form.questions.some((q) => !answers[q.id])}
                onClick={submitForm}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <CheckCircle2 size={17} />
                )}{" "}
                Submit responses
              </button>
              <p className="helper">Answer all questions before submitting.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [chapterNumber, setChapterNumber] = useState("");
  const [preview, setPreview] = useState(null);
  const [generatedSource, setGeneratedSource] = useState(null);
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionType, setQuestionType] = useState("mixed");
  const [activeTab, setActiveTab] = useState("practice");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [collectName, setCollectName] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [pointsPerQuestion, setPointsPerQuestion] = useState("2");
  const [requireAllQuestions, setRequireAllQuestions] = useState(true);
  const [createdForm, setCreatedForm] = useState(null);
  const [googleStatus, setGoogleStatus] = useState({
    connected: false,
    configured: true,
  });
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedChapter = useMemo(
    () => analysis?.chapters?.find((c) => String(c.number) === chapterNumber),
    [analysis, chapterNumber],
  );
  const score = questions.reduce(
    (sum, q, index) => sum + (answers[index] === q.correctAnswer ? 1 : 0),
    0,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleResult = params.get("google");
    // Restore application state after returning from Google
    if (googleResult === "connected" || googleResult === "error") {
      const savedState = sessionStorage.getItem("aviationFormState");
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setQuestions(parsedState.questions || []);
          setFormTitle(parsedState.formTitle || "");
          setGeneratedSource(parsedState.generatedSource || "");

          console.log("Previous form state restored");
        } catch (error) {
          console.error("Failed to restore form state:", error);
        }
        sessionStorage.removeItem("aviationFormState");
      }
    }

    if (googleResult === "connected") {
      console.log("Google OAuth callback detected");
      setActiveTab("form");
      setNotice("Google account connected. You can now create Google Forms.");
      apiRequest(`${API}/api/google/status`)
        .then((data) => {
          console.log("Google status:", data);
          setGoogleStatus(data);
        })
        .catch((error) => {
          console.error("Google status check failed:", error);
          setGoogleStatus({ connected: false });
        });

      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (googleResult === "error") {
      setError(
        `Google connection failed: ${
          params.get("reason") || "Please try again."
        }`,
      );
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    apiRequest(`${API}/api/google/status`)
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ connected: false }));
  }, []);

  const publicMatch = window.location.pathname.match(
    /^\/form\/([a-f0-9]+)\/?$/i,
  );
  if (publicMatch) return <PublicForm formId={publicMatch[1]} />;

  const currentPath = window.location.pathname;
  if (currentPath === "/privacy-policy") return <PrivacyPolicy />;
  if (currentPath === "/terms-of-service") return <TermsAndService />;
  function onFileChange(nextFile) {
    const selectedFile = nextFile || null;
    setFile(selectedFile);
    setAnalysis(null);
    setPreview(null);
    setGeneratedSource(null);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setError("");
    setNotice("");
    setChapterNumber("");
    setCreatedForm(null);
    if (selectedFile) analyzePdf(selectedFile);
  }

  async function analyzePdf(selectedFile = file) {
    if (!selectedFile) {
      setError("Choose a PDF file first.");
      return;
    }
    setBusy("analyze");
    setError("");
    setNotice("");
    setAnalysis(null);
    setPreview(null);
    setGeneratedSource(null);
    setQuestions([]);
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const data = await apiRequest(`${API}/api/documents/analyze`, {
        method: "POST",
        body,
      });
      console.log(data);
      setAnalysis(data);
      const first = data.chapters?.[0];
      if (first) setChapterNumber(String(first.number));
      setNotice(
        `PDF analyzed: ${data.pageCount} pages and ${data.chapters?.length || 0} detected chapters. No AI credits used.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function loadChapterText() {
    if (!analysis || !selectedChapter)
      throw new Error("Analyze the PDF and select a detected chapter first.");
    return apiRequest(`${API}/api/documents/chapter-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: analysis.documentId,
        chapter: Number(selectedChapter.number),
        title: selectedChapter.title,
      }),
    });
  }

  async function previewChapter() {
    if (!analysis || !selectedChapter) {
      setError("Analyze the PDF and select a detected chapter first.");
      return;
    }
    setBusy("preview");
    setError("");
    setNotice("");
    setPreview(null);
    try {
      const data = await loadChapterText();
      setPreview(data);
      setNotice(
        "Chapter preview is ready. You can now review the extracted text.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    if (!analysis || !selectedChapter) {
      setError("Upload and analyze a PDF, then select a chapter.");
      return;
    }
    setBusy("generate");
    setError("");
    setNotice("");
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setCreatedForm(null);
    try {
      // Preview is optional: load the selected chapter text automatically if it was not previewed.
      const chapterData =
        preview && String(preview.chapter) === String(selectedChapter.number)
          ? preview
          : await loadChapterText();
      const data = await apiRequest(`${API}/api/questions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: chapterData.sourceText,
          chapter: chapterData.chapter,
          title: chapterData.title,
          startPage: chapterData.startPage,
          endPage: chapterData.endPage,
          count: Number(count),
          difficulty,
          questionType,
        }),
      });
      setQuestions(data.questions || []);
      setGeneratedSource({
        chapter: chapterData.chapter,
        title: chapterData.title,
        startPage: chapterData.startPage,
        endPage: chapterData.endPage,
      });
      setFormTitle(`${chapterData.title} — Practice Form`);
      setNotice(`Generated ${data.questions?.length || 0} questions.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function connectGoogle() {
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(`${API}/api/google/auth-url`);
      // Preserve generated data before leaving the application
      sessionStorage.setItem(
        "aviationFormState",
        JSON.stringify({
          questions,
          formTitle,
          generatedSource,
        })
      );
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
    }
  }

  async function createForm() {
    if (!questions.length) {
      setError("Generate questions before creating a Google Form.");
      return;
    }
    if (!googleStatus.connected) {
      setError("Connect your Google account before creating a Google Form.");
      return;
    }
    setBusy("form");
    setError("");
    setNotice("");
    setCreatedForm(null);
    try {
      const data = await apiRequest(`${API}/api/google/forms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          questions,
          settings: {
            collectName,
            collectEmail,
            shuffleQuestions,
            showScore,
            pointsPerQuestion: Number(pointsPerQuestion),
            requireAllQuestions,
          },
          source: {
            chapterTitle: generatedSource?.title || preview?.title,
            startPage: generatedSource?.startPage || preview?.startPage,
            endPage: generatedSource?.endPage || preview?.endPage,
          },
        }),
      });
      setCreatedForm(data);
      setNotice("Google Form created in your Google account.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function copyShareLink() {
    const shareUrl = createdForm?.responderUrl;
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Google Forms responder link copied.");
    } catch {
      setNotice(`Copy this link: ${shareUrl}`);
    }
  }

  function exportQuestions() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            chapter: generatedSource?.title || preview?.title,
            pageRange: [
              generatedSource?.startPage || preview?.startPage,
              generatedSource?.endPage || preview?.endPage,
            ],
            questions,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aviation-practice-questions.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">
            <Plane size={20} />
          </span>
          <span>
            AVIATION<span className="brand-light">LAB</span>
            <small>EXAM PREPARATION</small>
          </span>
        </a>
        <span className="top-pill">
          <span className="live-dot" /> Personal study workspace
        </span>
      </header>
      <nav className="app-nav">
        <button
          className={activeTab === "practice" ? "nav-item active" : "nav-item"}
          onClick={() => setActiveTab("practice")}
        >
          <BookOpen size={16} /> Real-time practice
        </button>
        <button
          className={activeTab === "form" ? "nav-item active" : "nav-item"}
          onClick={() => setActiveTab("form")}
          disabled={!questions.length}
        >
          <ClipboardList size={16} /> Form generator{" "}
          <span>{questions.length || ""}</span>
        </button>
      </nav>
      <main className="main">
        {activeTab === "practice" ? (
          <>
            <section className="hero">
              <div className="eyebrow">
                <span /> AI-POWERED STUDY TOOL
              </div>
              <h1>
                Turn your study material
                <br />
                <span>into exam practice.</span>
              </h1>
              <p>
                Upload an aviation textbook, select a detected chapter, inspect
                its extracted text, and create a multiple-choice practice test.
              </p>
              <div className="hero-meta">
                <span>
                  <CheckCircle2 size={15} /> Page-aware extraction
                </span>
                <span>
                  <CheckCircle2 size={15} /> Optional chapter preview
                </span>
                <span>
                  <CheckCircle2 size={15} /> Score and explanations
                </span>
              </div>
            </section>

            <div className="workspace">
              <section className="panel">
                <div className="section-heading">
                  <div className="step">01</div>
                  <div>
                    <h2>Source material</h2>
                    <p>Upload a selectable-text PDF.</p>
                  </div>
                </div>
                <label
                  className={`dropzone ${file ? "has-file" : ""}`}
                  htmlFor="pdf-file"
                >
                  <input
                    id="pdf-file"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => onFileChange(e.target.files?.[0])}
                  />
                  <span className="upload-icon">
                    <UploadCloud size={23} />
                  </span>
                  {file ? (
                    <>
                      <strong>{file.name}</strong>
                      <span>
                        {(file.size / 1048576).toFixed(2)} MB · PDF selected
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Choose a PDF file</strong>
                      <span>Click to browse · Maximum 100 MB</span>
                    </>
                  )}
                </label>
                {busy === "analyze" && (
                  <div className="chapter-note">
                    <LoaderCircle className="spin" size={17} />
                    <span>Analyzing PDF and detecting chapters…</span>
                  </div>
                )}
                {analysis && (
                  <div className="verified">
                    <CheckCircle2 size={15} /> PDF analyzed successfully
                  </div>
                )}
                {analysis && (
                  <div className="file-stats">
                    <div>
                      <span>Pages</span>
                      <strong>{analysis.pageCount}</strong>
                    </div>
                    <div>
                      <span>Characters</span>
                      <strong>
                        {Number(analysis.extractedCharacters).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span>Detected chapters</span>
                      <strong>
                        {analysis.chapters.length > 0
                          ? analysis.chapters[analysis.chapters.length - 1]
                              .number
                          : 0}
                      </strong>
                    </div>
                  </div>
                )}
                {analysis?.warning && (
                  <p className="helper warning">{analysis.warning}</p>
                )}
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div className="step">02</div>
                  <div>
                    <h2>Build your test</h2>
                    <p>Choose a detected chapter and settings.</p>
                  </div>
                </div>
                <label className="field-label" htmlFor="chapter-select">
                  Detected chapter
                </label>
                <select
                  id="chapter-select"
                  className="field"
                  value={chapterNumber}
                  disabled={!analysis?.chapters?.length || !!busy}
                  onChange={(e) => {
                    setChapterNumber(e.target.value);
                    setPreview(null);
                    setGeneratedSource(null);
                    setQuestions([]);
                    setAnswers({});
                    setSubmitted(false);
                    setCreatedForm(null);
                  }}
                >
                  {!analysis?.chapters?.length && (
                    <option value="">
                      {busy === "analyze"
                        ? "Analyzing PDF…"
                        : "Upload a PDF first"}
                    </option>
                  )}
                  {analysis?.chapters?.map((c, i) => (
                    <option
                      key={`${c.number}-${c.title}-${i}`}
                      value={c.number}
                    >
                      Chapter {c.number} — {c.title} (PDF page {c.startPage})
                    </option>
                  ))}
                </select>
                <div className="two-fields">
                  <div>
                    <label className="field-label" htmlFor="question-count">
                      Question count
                    </label>
                    <select
                      id="question-count"
                      className="field"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                    >
                      {[5, 10, 15, 20, 30].map((n) => (
                        <option key={n} value={n}>
                          {n} questions
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="difficulty">
                      Difficulty
                    </label>
                    <select
                      id="difficulty"
                      className="field"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </div>
                <div className="form-field question-type-field">
                  <label className="field-label" htmlFor="question-type">
                    Question type
                  </label>
                  <select
                    id="question-type"
                    className="field"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                  >
                    <option value="theory">Theory only</option>
                    <option value="numerical">Numerical only</option>
                    <option value="mixed">Mixed theory + numerical</option>
                  </select>
                </div>
                <div className="chapter-note">
                  <BookOpen size={17} />
                  <span>
                    {selectedChapter ? (
                      <>
                        <strong>Selected:</strong> {selectedChapter.title}
                      </>
                    ) : (
                      "Select a chapter after analyzing the PDF."
                    )}
                  </span>
                </div>
                <button
                  className="button button-primary full"
                  onClick={previewChapter}
                  disabled={!selectedChapter || !file || !!busy}
                >
                  {busy === "preview" ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <BookOpen size={17} />
                  )}{" "}
                  Preview chapter content
                </button>
                <button
                  className="button button-ai full"
                  onClick={generate}
                  disabled={!selectedChapter || !analysis || !!busy}
                >
                  {busy === "generate" ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}{" "}
                  Generate questions
                </button>
                <p className="helper">
                  PDF analysis runs automatically after upload. Preview is
                  optional; generating questions will prepare the selected
                  chapter text automatically.
                </p>
              </section>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="alert alert-success">
                <CheckCircle2 size={18} />
                <span>{notice}</span>
              </div>
            )}

            {preview && (
              <section className="panel result-panel">
                <div className="result-head">
                  <div>
                    <div className="eyebrow">EXTRACTION REVIEW</div>
                    <h2>
                      Chapter {preview.chapter}: {preview.title}
                    </h2>
                    <p>
                      PDF pages {preview.startPage}–{preview.endPage} ·{" "}
                      {Number(preview.extractedCharacters).toLocaleString()}{" "}
                      characters
                    </p>
                  </div>
                  <span className="verified">
                    <CheckCircle2 size={15} /> Preview ready
                  </span>
                </div>
                <pre className="text-preview">{preview.preview}</pre>
                <p className="helper">
                  Confirm the text begins in the selected chapter and ends
                  before the next chapter. If the boundary looks wrong, do not
                  generate questions.
                </p>
              </section>
            )}

            {questions.length > 0 && (
              <section className="panel result-panel">
                <div className="result-head">
                  <div>
                    <div className="eyebrow">PRACTICE SESSION</div>
                    <h2>
                      {generatedSource?.title ||
                        preview?.title ||
                        selectedChapter?.title}
                    </h2>
                    <p>
                      {questions.length} multiple-choice questions ·{" "}
                      {difficulty} difficulty
                    </p>
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={exportQuestions}
                  >
                    <Download size={16} /> Export JSON
                  </button>
                </div>
                {questions.map((q, i) => (
                  <article className="question" key={q.id || i}>
                    <div className="question-number">
                      QUESTION {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3>{q.question}</h3>
                    <div className="options">
                      {q.options.map((option, j) => {
                        const letter = ["A", "B", "C", "D"][j];
                        const chosen = answers[i] === letter;
                        const correct = submitted && q.correctAnswer === letter;
                        const wrong = submitted && chosen && !correct;
                        return (
                          <button
                            key={letter}
                            className={`option ${chosen ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`}
                            onClick={() =>
                              !submitted &&
                              setAnswers((prev) => ({ ...prev, [i]: letter }))
                            }
                            disabled={submitted}
                          >
                            <span>{letter}</span>
                            {option.replace(/^[A-D][.)]\s*/, "")}
                          </button>
                        );
                      })}
                    </div>
                    {submitted && (
                      <div className="explanation">
                        <strong>Correct answer: {q.correctAnswer}</strong>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </article>
                ))}
                <div className="quiz-footer">
                  {submitted ? (
                    <>
                      <strong className="score">
                        Score: {score}/{questions.length} (
                        {Math.round((score / questions.length) * 100)}%)
                      </strong>
                      <button
                        className="button button-primary"
                        onClick={() => {
                          setAnswers({});
                          setSubmitted(false);
                        }}
                      >
                        <RotateCcw size={15} /> Try again
                      </button>
                    </>
                  ) : (
                    <button
                      className="button button-primary"
                      onClick={() => setSubmitted(true)}
                      disabled={
                        Object.keys(answers).length !== questions.length
                      }
                    >
                      Submit answers ({Object.keys(answers).length}/
                      {questions.length})
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="form-builder">
            <section className="panel">
              <div className="section-heading">
                <div className="step">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h2>Form generator</h2>
                  <p>
                    Turn the generated questions into a shareable quiz without
                    generating questions again.
                  </p>
                </div>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="form-title">
                  Form title
                </label>
                <input
                  id="form-title"
                  className="field"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Air Law — Chapter 5 Quiz"
                />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="form-description">
                  Description / instructions
                </label>
                <textarea
                  id="form-description"
                  className="field field-textarea"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Add instructions for respondents…"
                />
              </div>
              <div className="settings-grid">
                <label className="setting-option">
                  <input
                    type="checkbox"
                    checked={collectName}
                    onChange={(e) => setCollectName(e.target.checked)}
                  />{" "}
                  Collect respondent name
                </label>
                <label className="setting-option">
                  <input
                    type="checkbox"
                    checked={collectEmail}
                    onChange={(e) => setCollectEmail(e.target.checked)}
                  />{" "}
                  Collect email address
                </label>
                <label className="setting-option">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                  />{" "}
                  Shuffle question order
                </label>
                <label className="setting-option">
                  <input
                    type="checkbox"
                    checked={showScore}
                    onChange={(e) => setShowScore(e.target.checked)}
                  />{" "}
                  Show score after submission (set in Google Forms)
                </label>
                <label className="setting-option">
                  <input
                    type="checkbox"
                    checked={requireAllQuestions}
                    onChange={(e) => setRequireAllQuestions(e.target.checked)}
                  />{" "}
                  Require answers to every question
                </label>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="points-per-question">
                  Points per question
                </label>
                <select
                  id="points-per-question"
                  className="field"
                  value={pointsPerQuestion}
                  onChange={(e) => setPointsPerQuestion(e.target.value)}
                >
                  <option value="1">1 point</option>
                  <option value="2">2 points</option>
                  <option value="3">3 points</option>
                  <option value="5">5 points</option>
                  <option value="10">10 points</option>
                </select>
              </div>
              <p className="helper">
                Each question will be worth the selected points. Required-answer
                settings are applied to the real Google Form. Google controls
                score-release behavior; verify it in the form after creation.
              </p>
              <div className="google-connect-card">
                <div>
                  <strong>Google account</strong>
                  <p className="helper">
                    {googleStatus.connected
                      ? "Connected. New forms will be created in your Google account."
                      : "Connect your Google account to create a real Google Form in Drive."}
                  </p>
                </div>
                <button
                  className={
                    googleStatus.connected
                      ? "button button-secondary"
                      : "button button-primary"
                  }
                  onClick={connectGoogle}
                  disabled={!!busy}
                >
                  {googleStatus.connected
                    ? "Reconnect Google"
                    : "Connect Google"}
                </button>
              </div>
              {!googleStatus.configured && (
                <p className="helper warning">
                  Google OAuth is not configured yet. Add the Google OAuth
                  credentials listed in server/.env.example.
                </p>
              )}
              <div className="chapter-note">
                <CheckCircle2 size={17} />
                <span>
                  <strong>{questions.length} questions ready.</strong> Existing
                  generated questions, answers, and explanations are used.
                  Creating the Google Form does not call AI again.
                </span>
              </div>
              <button
                className="button button-primary full"
                onClick={createForm}
                disabled={
                  !questions.length ||
                  !formTitle.trim() ||
                  !googleStatus.connected ||
                  !!busy
                }
              >
                {busy === "form" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ClipboardList size={17} />
                )}{" "}
                Create Google Form
              </button>
              {createdForm && (
                <div className="share-panel">
                  <div className="verified">
                    <CheckCircle2 size={15} /> Google Form created
                  </div>
                  <p>
                    Your quiz is now in Google Forms. Share the responder link,
                    or open the form to edit it.
                  </p>
                  <div className="share-link">{createdForm.responderUrl}</div>
                  <button
                    className="button button-secondary"
                    onClick={copyShareLink}
                  >
                    <Copy size={16} /> Copy responder link
                  </button>
                  <a
                    className="button button-primary"
                    href={createdForm.responderUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Link2 size={16} /> Open responder form
                  </a>
                  <a
                    className="button button-secondary"
                    href={createdForm.editUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ClipboardList size={16} /> Edit in Google Forms
                  </a>
                  <p className="helper">
                    Google owns the form and responses. Anyone who can access
                    the responder link according to your Google Form's sharing
                    settings can submit it.
                  </p>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="section-heading">
                <div className="step">Q</div>
                <div>
                  <h2>Form preview</h2>
                  <p>These are the exact questions that will be included.</p>
                </div>
              </div>
              {questions.map((q, i) => (
                <article className="question" key={q.id || i}>
                  <div className="question-number">
                    QUESTION {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3>{q.question}</h3>
                  <div className="options">
                    {q.options.map((option, j) => (
                      <div className="option" key={j}>
                        <span>{["A", "B", "C", "D"][j]}</span>
                        {option.replace(/^[A-D][.)]\s*/, "")}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </section>
        )}
        <footer>
          <span>AVIATIONLAB</span>
          <span>Study smart. Fly prepared.</span>

          <div className="footer-links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
