/**
 * Shared session store for Vercel serverless functions.
 * Uses a global in-memory store (per-instance).
 * In production with multiple instances, consider using Redis or Vercel KV.
 */
const crypto = require('crypto');

// Global session store (persists across warm function invocations)
if (!global.__sessionStore) {
  global.__sessionStore = new Map();
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession() {
  const sessionId = generateSessionId();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    data: { authenticated: true, role: 'owner' }
  };
  global.__sessionStore.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = global.__sessionStore.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    global.__sessionStore.delete(sessionId);
    return null;
  }
  return session;
}

function destroySession(sessionId) {
  if (sessionId) {
    global.__sessionStore.delete(sessionId);
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of global.__sessionStore.entries()) {
    if (now > session.expiresAt) {
      global.__sessionStore.delete(id);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = { createSession, getSession, destroySession };