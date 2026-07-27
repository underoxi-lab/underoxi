/**
 * GET /api/team-data — получить список команды (публично)
 * POST /api/team-data — обновить список команды (требуется авторизация)
 * 
 * Данные хранятся в team-data.json в GitHub репозитории.
 * Для записи используется GitHub Personal Access Token из переменной окружения.
 */
const cookie = require('cookie');
const { getSession, destroySession } = require('./_session');

// ── GitHub helper ──────────────────────────────────────────────

function getGitHubConfig() {
  const repo = process.env.GITHUB_REPO;         // e.g. "username/repo"
  const token = process.env.GITHUB_TOKEN;
  const filePath = process.env.GITHUB_FILE_PATH || 'team-data.json';
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!repo) throw new Error('GITHUB_REPO not configured');
  if (!token) throw new Error('GITHUB_TOKEN not configured');

  return { repo, token, filePath, branch };
}

/**
 * Fetch the current team-data.json from GitHub (raw content).
 */
async function fetchFromGitHub() {
  const { repo, token, filePath, branch } = getGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'underoxi-site/1.0',
    },
  });

  if (response.status === 404) {
    // File doesn't exist yet — return empty array
    return { data: [], sha: null };
  }

  if (!response.ok) {
    throw new Error(`GitHub API error (GET): ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const content = Buffer.from(result.content, 'base64').toString('utf-8');
  const parsed = JSON.parse(content);
  return { data: Array.isArray(parsed) ? parsed : [], sha: result.sha };
}

/**
 * Write team data to GitHub.
 */
async function writeToGitHub(data, existingSha) {
  const { repo, token, filePath, branch } = getGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const content = JSON.stringify(data, null, 2);
  const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

  const body = {
    message: 'Update team data (via site panel)',
    content: encodedContent,
    branch: branch,
    sha: existingSha || undefined,
  };

  // Remove sha if it's null/undefined
  if (!body.sha) delete body.sha;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'underoxi-site/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub API error (PUT): ${response.status} ${response.statusText} — ${errText}`);
  }

  return await response.json();
}

// ── Validation ──────────────────────────────────────────────────

function validateMember(member, index) {
  const errors = [];

  if (!member.nickname || typeof member.nickname !== 'string' || member.nickname.trim().length === 0) {
    errors.push(`Участник #${index + 1}: никнейм обязателен`);
  }
  if (member.nickname && member.nickname.length > 64) {
    errors.push(`Участник #${index + 1}: никнейм слишком длинный (макс. 64 символа)`);
  }
  if (member.description && typeof member.description !== 'string') {
    errors.push(`Участник #${index + 1}: описание должно быть строкой`);
  }
  if (member.description && member.description.length > 500) {
    errors.push(`Участник #${index + 1}: описание слишком длинное (макс. 500 символов)`);
  }
  if (member.discord && typeof member.discord !== 'string') {
    errors.push(`Участник #${index + 1}: discord должен быть строкой`);
  }
  if (member.discord && member.discord.length > 200) {
    errors.push(`Участник #${index + 1}: discord слишком длинный (макс. 200 символов)`);
  }
  if (member.role && typeof member.role !== 'string') {
    errors.push(`Участник #${index + 1}: роль должна быть строкой`);
  }
  if (member.role && member.role.length > 50) {
    errors.push(`Участник #${index + 1}: роль слишком длинная (макс. 50 символов)`);
  }
  if (member.priority !== undefined && (typeof member.priority !== 'number' || member.priority < 0)) {
    errors.push(`Участник #${index + 1}: приоритет должен быть числом >= 0`);
  }
  if (member.head_url && typeof member.head_url === 'string') {
    // Validate that head_url is a reasonable length for a data URL or a URL
    if (member.head_url.length > 500000) {
      errors.push(`Участник #${index + 1}: изображение головы слишком большое (макс. 500KB)`);
    }
    // Validate it's a proper data URL or http URL
    if (!member.head_url.startsWith('data:image/') && !member.head_url.startsWith('http')) {
      errors.push(`Участник #${index + 1}: некорректный URL головы`);
    }
  }

  return errors;
}

// ── Handler ─────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ── GET: Public read ──────────────────────────────────────
    if (req.method === 'GET') {
      try {
        const { data } = await fetchFromGitHub();
        res.status(200).json(data);
      } catch (err) {
        console.error('Failed to fetch team data from GitHub:', err.message);
        // If GitHub is unavailable, try local fallback
        try {
          const fs = require('fs');
          const path = require('path');
          const localPath = path.join(__dirname, '..', 'team-data.json');
          if (fs.existsSync(localPath)) {
            const localRaw = fs.readFileSync(localPath, 'utf-8');
            const localData = JSON.parse(localRaw);
            res.status(200).json(Array.isArray(localData) ? localData : []);
            return;
          }
        } catch (e) {
          // ignore local fallback errors
        }
        res.status(200).json([]);
      }
      return;
    }

    // ── POST: Requires authentication ─────────────────────────
    if (req.method === 'POST') {
      // Verify session
      const cookies = cookie.parse(req.headers.cookie || '');
      const sessionId = cookies.session_id;
      const session = getSession(sessionId);

      if (!session) {
        res.status(401).json({ ok: false, message: 'Требуется авторизация' });
        return;
      }

      // Parse and validate body
      let members;
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        members = body.members;
      } catch (e) {
        res.status(400).json({ ok: false, message: 'Неверный формат данных' });
        return;
      }

      if (!Array.isArray(members)) {
        res.status(400).json({ ok: false, message: 'Поле "members" должно быть массивом' });
        return;
      }

      if (members.length > 100) {
        res.status(400).json({ ok: false, message: 'Слишком много участников (макс. 100)' });
        return;
      }

      // Validate each member
      const allErrors = [];
      members.forEach((m, i) => {
        allErrors.push(...validateMember(m, i));
      });

      if (allErrors.length > 0) {
        res.status(400).json({ ok: false, message: 'Ошибки валидации', errors: allErrors });
        return;
      }

      // Sanitize members: clean up fields
      const sanitized = members.map(m => ({
        id: m.id || String(Date.now() + Math.random()),
        nickname: m.nickname.trim(),
        role: (m.role || '').trim(),
        priority: typeof m.priority === 'number' ? m.priority : 10,
        description: (m.description || '').trim() || null,
        discord: (m.discord || '').trim() || null,
        head_url: m.head_url || null,
      }));

      // Sort by priority (lower = first)
      sanitized.sort((a, b) => (a.priority || 10) - (b.priority || 10));

      // Write to GitHub
      try {
        // First fetch existing to get SHA
        const { sha } = await fetchFromGitHub();
        await writeToGitHub(sanitized, sha);

        // Also write locally as fallback
        try {
          const fs = require('fs');
          const path = require('path');
          const localPath = path.join(__dirname, '..', 'team-data.json');
          fs.writeFileSync(localPath, JSON.stringify(sanitized, null, 2));
        } catch (e) {
          // local write is optional
        }

        res.status(200).json({ ok: true, message: 'Данные сохранены в GitHub', members: sanitized });
      } catch (err) {
        console.error('Failed to write to GitHub:', err.message);

        // Fallback: save only locally if GitHub write fails
        try {
          const fs = require('fs');
          const path = require('path');
          const localPath = path.join(__dirname, '..', 'team-data.json');
          fs.writeFileSync(localPath, JSON.stringify(sanitized, null, 2));
          res.status(200).json({
            ok: true,
            message: 'Данные сохранены локально (GitHub недоступен).',
            members: sanitized,
            warning: true
          });
        } catch (e) {
          res.status(500).json({ ok: false, message: 'Не удалось сохранить данные' });
        }
      }
      return;
    }

    res.status(405).json({ ok: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Team data handler error:', error);
    res.status(500).json({ ok: false, message: 'Внутренняя ошибка сервера' });
  }
};