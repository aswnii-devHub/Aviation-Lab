# Aviation Exam Generator — complete local application

A React + Vite application with an Express API for uploading a textbook PDF, extracting text page-by-page, detecting chapter boundaries, previewing the selected chapter, generating multiple-choice questions with Gemini, taking a quiz, viewing explanations/scores, and exporting questions as JSON.

## Requirements
- Node.js 20 or later
- A Gemini API key only for AI question generation
- Text-based PDFs. OCR for scanned-only PDFs is not included.

## Windows PowerShell setup

PowerShell may block `npm.ps1`; use `npm.cmd` in the commands below.

### 1. Backend
```powershell
cd server
npm.cmd install
Copy-Item .env.example .env
```
Edit `server/.env` and set `GEMINI_API_KEY` if you want AI generation. Never put the key in the React client.

Then:
```powershell
npm.cmd test
npm.cmd run dev
```
Backend: `http://localhost:5000`

### 2. Frontend (open a second terminal)
```powershell
cd client
npm.cmd install
npm.cmd run dev
```
Open the Vite URL, usually `http://localhost:5173`.

## App workflow
1. Choose a PDF.
2. Click **Analyze PDF**. The API extracts each page and detects chapter openers; no Gemini call is made.
3. Choose a detected chapter.
4. Click **Preview chapter** and inspect the start/end and text excerpt.
5. Only then click **Generate questions**.
6. Answer the quiz, submit, review correct answers/explanations, retry, or export JSON.

## Important safeguards
- PDF uploads are processed in memory and not persisted to disk.
- File-size limit defaults to 30 MB (`MAX_UPLOAD_MB`).
- Extracted content is sent to Gemini with a conservative character cap. Large chapters may be truncated for the AI prompt; the UI/API reports this.
- The chapter parser is heuristic because PDFs vary in layout. The preview is deliberately required before generation.
- If chapter detection is uncertain, the API returns an error instead of silently generating questions from empty text.
- Gemini model and API quota/access vary by account. Set `GEMINI_MODEL` in `.env` to a model available to your key.
- This starter cannot guarantee the correctness of AI-generated questions; verify answers against the source material.

## Question types, repeat avoidance, and form sharing

- In **Real-time practice**, choose **Theory only**, **Numerical only**, or **Mixed theory + numerical** before generating questions.
- Generated question wording is recorded in `server/data/question-history.json` by chapter/source fingerprint. Later generations for the same extracted chapter include previous questions in the prompt to reduce repeats. This is a best-effort AI instruction, not a mathematical guarantee that paraphrased questions can never recur.
- After questions are generated, open **Form generator** in the navigation. Set a title, instructions, and form settings, then choose **Create shareable form**. This uses the existing generated questions and does not make another AI request.
- Created forms and responses are stored in `server/data/forms.json`. Keep the `server/data` directory persistent when deploying; otherwise stored forms can be lost if the host's filesystem is ephemeral.
- The share link works on the same machine during local development. To share with other people over the internet, deploy the frontend and backend to a public host and set `VITE_API_URL` at frontend build time to the deployed backend API base URL (for example, `https://your-api.example.com/api`). Configure the deployed server to allow your frontend origin. This app creates its own hosted form pages; it does not create a Google Form in the user's Google account.
- Responses are stored by the backend. A simple summary endpoint is available at `GET /api/forms/:id/results`; protect/administer that endpoint before using the app for sensitive or public production exams.

## Create real Google Forms

The **Google Form Generator** creates a real quiz in the connected Google account. It reuses the generated questions; it does not call Gemini again. Google Forms receives the title, description, multiple-choice questions, answer key, points, and correct/incorrect feedback. The responder and edit URLs are returned after creation.

### One-time Google OAuth setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Enable **Google Forms API** for that project.
3. Configure the OAuth consent screen. For local testing, add your Google account as a test user if the app is in Testing mode.
4. Create an OAuth client ID with application type **Web application**.
5. Add this exact authorized redirect URI:
   `http://localhost:5000/api/google/oauth/callback`
6. Copy the client ID and client secret into `server/.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=your_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_oauth_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth/callback
   GOOGLE_FRONTEND_URL=http://localhost:5173
   ```

7. Install the updated backend dependencies from the `server` folder with `npm.cmd install`, then start it with `npm.cmd run dev`.
8. Start the frontend from `client` with `npm.cmd install` and `npm.cmd run dev`.
9. Open the app, generate questions, go to **Form generator**, click **Connect Google**, and approve the requested permissions. Return to the app and click **Create Google Form**.

OAuth tokens are stored locally in `server/data/google-oauth-token.json`. Do not commit this file or share it. The current implementation is intended for a single-user local development setup; a multi-user/public deployment should use per-user OAuth token storage and a secure database/session strategy.

### Notes

- Google Forms API access must be enabled in the Google Cloud project used by the OAuth client.
- A form is created in the Google account that authorizes the application. Google can restrict access based on the account's organization policies and OAuth consent configuration.
- `collectName` adds a required name question; `collectEmail` enables respondent-entered email collection.
- Google Forms quiz grading is enabled and each multiple-choice question includes an answer key and feedback. Review the quiz's grade-release settings in Google Forms if you need a specific score-release policy; not every Forms UI setting is exposed by the Forms API.
- `shuffleQuestions` randomizes question order when the form is created. It does not reshuffle per respondent.
