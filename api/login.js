/**
 * POST /api/login
 * Authenticates the owner with a password and creates a session.
 * Returns an HttpOnly cookie with the session ID.
 */
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { createSession } = require('./_session');

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  
  if (now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
}

module.exports = async function handler(req, res) {
  // CORS headers for frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }
  
  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(ip);
  
  if (!rateLimit.allowed) {
    res.status(429).json({ 
      ok: false, 
      message: 'Слишком много попыток. Попробуйте позже.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
    return;
  }
  
  try {
    const { password } = req.body || {};
    
    if (!password || typeof password !== 'string') {
      res.status(400).json({ ok: false, message: 'Неверный запрос' });
      return;
    }
    
    const storedHash = process.env.OWNER_PASSWORD_HASH || '';
    
    if (!storedHash) {
      console.error('OWNER_PASSWORD_HASH is not set in environment variables');
      res.status(500).json({ ok: false, message: 'Ошибка конфигурации сервера' });
      return;
    }
    
    // Verify password against bcrypt hash
    const isValid = await bcrypt.compare(password, storedHash);
    
    if (!isValid) {
      res.status(401).json({ ok: false, message: 'Неверный пароль' });
      return;
    }
    
    // Create session
    const session = createSession();
    
    // Set HttpOnly cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
    };
    
    res.setHeader('Set-Cookie', cookie.serialize('session_id', session.id, cookieOptions));
    
    res.status(200).json({ ok: true, message: 'Авторизация успешна' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, message: 'Внутренняя ошибка сервера' });
  }
};