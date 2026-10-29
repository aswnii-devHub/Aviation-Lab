const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const dataDir = path.join(__dirname, '..', '..', 'data');
const tokenPath = path.join(dataDir, 'google-oauth-token.json');
const SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/drive.file',
];

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    const error = new Error('Google Forms is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to server/.env.');
    error.status = 503;
    throw error;
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function getAuthorizationUrl(state) {
  const oauth = getOAuthClient();
  return oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

function saveTokens(tokens) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(tokenPath, 'utf8')) }
  catch { return null; }
}

async function exchangeCode(code) {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  saveTokens(tokens);
  return tokens;
}

function getSavedOAuthClient() {
  const tokens = loadTokens();
  if (!tokens) return null;
  const oauth = getOAuthClient();
  oauth.setCredentials(tokens);
  oauth.on('tokens', (updated) => saveTokens({ ...tokens, ...updated }));
  return oauth;
}

async function getConnectionStatus() {
  const oauth = getSavedOAuthClient();
  if (!oauth) return { connected: false };
  try {
    await oauth.getAccessToken();
    return { connected: true };
  } catch {
    return { connected: false, reason: 'Google authorization expired. Please connect again.' };
  }
}

function optionText(option) {
  return String(option || '').replace(/^[A-D][.)]\s*/, '').trim();
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function createGoogleForm({ title, description = '', questions, settings = {} }) {
  const auth = getSavedOAuthClient();
  if (!auth) {
    const error = new Error('Connect your Google account before creating a Google Form.');
    error.status = 401;
    throw error;
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    const error = new Error('Generate questions before creating a Google Form.');
    error.status = 400;
    throw error;
  }

  const forms = google.forms({ version: 'v1', auth });
  const created = await forms.forms.create({
    requestBody: { info: { title: String(title).trim() } },
  });
  const formId = created.data.formId;
  if (!formId) throw new Error('Google did not return a form ID.');

  const validQuestions = questions.map((q, index) => {
    const options = Array.isArray(q.options) ? q.options.map(optionText) : [];
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer);
    if (!q.question || options.length !== 4 || correctIndex < 0) {
      throw new Error(`Question ${index + 1} is missing valid options or a correct answer.`);
    }
    return { ...q, options, correctOption: options[correctIndex] };
  });

  const questionList = settings.shuffleQuestions ? shuffle(validQuestions) : validQuestions;
  const requests = [
    {
      updateFormInfo: {
        info: { description: String(description).trim() },
        updateMask: 'description',
      },
    },
    {
      updateSettings: {
        settings: {
          quizSettings: { isQuiz: true },
          emailCollectionType: settings.collectEmail ? 'RESPONDENT_INPUT' : 'DO_NOT_COLLECT',
        },
        updateMask: 'quizSettings.isQuiz,emailCollectionType',
      },
    },
  ];

  if (settings.collectName) {
    requests.push({
      createItem: {
        item: {
          title: 'Your name',
          questionItem: { question: { required: true, textQuestion: { paragraph: false } } },
        },
        location: { index: requests.length - 2 },
      },
    });
  }

  questionList.forEach((q, index) => {
    const choices = q.options.map((value) => ({ value }));
    requests.push({
      createItem: {
        item: {
          title: q.question,
          questionItem: {
            question: {
              required: settings.requireAllQuestions !== false,
              choiceQuestion: { type: 'RADIO', options: choices, shuffle: false },
              grading: {
                pointValue: Math.max(1, Math.min(100, Number(settings.pointsPerQuestion) || 1)),
                correctAnswers: { answers: [{ value: q.correctOption }] },
                whenRight: { text: String(q.explanation || 'Correct.') },
                whenWrong: { text: `Correct answer: ${q.correctOption}. ${String(q.explanation || '')}`.trim() },
              },
            },
          },
        },
        location: { index: (settings.collectName ? 1 : 0) + index },
      },
    });
  });

  await forms.forms.batchUpdate({ formId, requestBody: { requests } });
  const finalForm = await forms.forms.get({ formId });
  const responderUri = finalForm.data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`;
  return {
    formId,
    title: finalForm.data.info?.title || title,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    responderUrl: responderUri,
    questionCount: questions.length,
  };
}

module.exports = { getAuthorizationUrl, exchangeCode, getConnectionStatus, createGoogleForm };
