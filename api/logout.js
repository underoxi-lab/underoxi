/**
 * POST /api/logout
 * Destroys the current session and clears the session cookie.
 */
const cookie = require('cookie');
const { destroySession } = require('./_session');

module.exports = function handler(req, res) {
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
  
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies.session_id;
    
    if (sessionId) {
      destroySession(sessionId);
    }
    
    // Clear the cookie
    res.setHeader('Set-Cookie', cookie.serialize('session_id', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    }));
    
    res.status(200).json({ ok: true, message: 'Сессия завершена' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ ok: false, message: 'Внутренняя ошибка сервера' });
  }
};