/**
 * GET /api/verify-session
 * Checks if the current request has a valid owner session.
 * Returns the session status.
 */
const cookie = require('cookie');
const { getSession } = require('./_session');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }
  
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies.session_id;
    const session = getSession(sessionId);
    
    if (!session) {
      res.status(200).json({ ok: false, authenticated: false });
      return;
    }
    
    res.status(200).json({ 
      ok: true, 
      authenticated: true, 
      role: session.data.role 
    });
  } catch (error) {
    console.error('Verify session error:', error);
    res.status(200).json({ ok: false, authenticated: false });
  }
};