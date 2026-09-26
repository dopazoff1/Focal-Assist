const crypto = require('node:crypto');
const express = require('express');
const { Aki } = require('aki-api');

const app = express();
const sessions = new Map();
const port = Number(process.env.AKINATOR_PORT || 4201);
const allowedRegions = new Set(['en', 'ar', 'cn', 'de', 'es', 'fr', 'il', 'it', 'jp', 'kr', 'nl', 'pl', 'pt', 'ru', 'tr', 'id']);

app.use(express.json({ limit: '20kb' }));
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});

function state(sessionId, aki) {
  return {
    sessionId,
    question: aki.question || '',
    answers: aki.answers || [],
    progress: Number(aki.progress || 0),
    guess: aki.guess ? {
      name: aki.guess.name,
      description: aki.guess.description,
      image: aki.guess.absolute_picture_path || aki.guess.picture_path
    } : undefined
  };
}

function sessionOr404(request, response) {
  const session = sessions.get(request.params.sessionId);
  if (!session) {
    response.status(404).json({ error: 'Akinator session not found or expired' });
    return null;
  }
  session.touchedAt = Date.now();
  return session;
}

app.post('/api/akinator', async (request, response) => {
  try {
    const region = allowedRegions.has(request.body?.region) ? request.body.region : 'en';
    const aki = new Aki({ region, childMode: true });
    await aki.start();
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { aki, touchedAt: Date.now() });
    response.json(state(sessionId, aki));
  } catch (error) {
    response.status(502).json({ error: error.message || 'Akinator is unavailable' });
  }
});

app.post('/api/akinator/:sessionId/answer', async (request, response) => {
  const session = sessionOr404(request, response);
  if (!session) return;
  const answer = Number(request.body?.answer);
  if (!Number.isInteger(answer) || answer < 0 || answer > 4) return response.status(400).json({ error: 'Answer must be between 0 and 4' });
  try {
    await session.aki.step(answer);
    response.json(state(request.params.sessionId, session.aki));
  } catch (error) {
    response.status(502).json({ error: error.message || 'Akinator answer failed' });
  }
});

app.post('/api/akinator/:sessionId/back', async (request, response) => {
  const session = sessionOr404(request, response);
  if (!session) return;
  try {
    await session.aki.back();
    response.json(state(request.params.sessionId, session.aki));
  } catch (error) {
    response.status(502).json({ error: error.message || 'Akinator back failed' });
  }
});

app.delete('/api/akinator/:sessionId', (request, response) => {
  sessions.delete(request.params.sessionId);
  response.sendStatus(204);
});

setInterval(() => {
  const expiry = Date.now() - 30 * 60 * 1000;
  for (const [sessionId, session] of sessions) if (session.touchedAt < expiry) sessions.delete(sessionId);
}, 5 * 60 * 1000).unref();

app.listen(port, '0.0.0.0', () => console.log(`Akinator gateway listening on http://localhost:${port}`));
