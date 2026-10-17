import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDb, enqueue, run, get, all, saveDb } from '../../data-db/db.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'velopro-secret-key-change-in-production';

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().catch(console.error);

// Middleware: проверка авторизации (Bearer JWT)
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Токен авторизации не предоставлен' }
    });
  }

  const token = authHeader.substring(7);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Недействительный токен' }
    });
  }

  // Проверяем, что сессия ещё активна
  const session = get('SELECT * FROM sessions WHERE token = ? AND expires_at > ?', [token, new Date().toISOString()]);
  if (!session) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: 'SESSION_EXPIRED', message: 'Сессия истекла' }
    });
  }

  req.user = { userId: decoded.userId, phone: decoded.phone };
  next();
}

// Middleware: проверка владения пользователем данными (userId в теле или параметрах)
function requireOwnership(req, res, next) {
  const userId = req.body.userId || req.query.userId || req.params.userId;
  if (userId && userId !== req.user.userId) {
    return res.status(403).json({
      success: false,
      data: null,
      error: { code: 'FORBIDDEN', message: 'Доступ к чужим данным запрещён' }
    });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'auth' }, error: null });
});

// POST /api/auth/register — регистрация по номеру телефона (доступна без авторизации)
app.post('/api/auth/register', async (req, res) => {
  await enqueue(async () => {
    const { phone, password, name } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Номер телефона и пароль обязательны' }
      });
    }

    if (!/^8\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Номер телефона должен быть в формате 8XXXXXXXXXX' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Пароль должен быть не менее 6 символов' }
      });
    }

    const existingUser = get('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: { code: 'USER_EXISTS', message: 'Пользователь с таким номером телефона уже существует' }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = nanoid();
    const now = new Date().toISOString();

    run('INSERT INTO users (id, phone, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, phone, name || phone, hashedPassword, now, now]);

    const token = jwt.sign({ userId, phone }, JWT_SECRET, { expiresIn: '7d' });

    run('INSERT INTO sessions (id, user_id, token, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [nanoid(), userId, token, req.headers['x-device-id'] || null, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]);

    saveDb();

    return res.status(201).json({
      success: true,
      data: {
        user: { id: userId, phone, name: name || phone },
        token
      },
      error: null
    });
  });
});

// POST /api/auth/login — вход по номеру телефона (доступен без авторизации)
app.post('/api/auth/login', async (req, res) => {
  await enqueue(async () => {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Номер телефона и пароль обязательны' }
      });
    }

    const user = get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Неверный номер телефона или пароль' }
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Неверный номер телефона или пароль' }
      });
    }

    const token = jwt.sign({ userId: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
    const now = new Date().toISOString();

    run('INSERT INTO sessions (id, user_id, token, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [nanoid(), user.id, token, req.headers['x-device-id'] || null, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]);

    saveDb();

    return res.json({
      success: true,
      data: {
        user: { id: user.id, phone: user.phone, name: user.name },
        token
      },
      error: null
    });
  });
});

// POST /api/auth/logout (требует авторизации)
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await enqueue(async () => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        run('DELETE FROM sessions WHERE token = ?', [token]);
        saveDb();
      }
      return res.json({ success: true, data: { message: 'Выход выполнен' }, error: null });
    } catch (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера при выходе' }
      });
    }
  });
});

// GET /api/auth/me (требует авторизации, возвращает только свои данные)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  await enqueue(async () => {
    const user = get('SELECT id, phone, name, wallet_balance FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' }
      });
    }

    return res.json({
      success: true,
      data: {
        user: { id: user.id, phone: user.phone, name: user.name, wallet_balance: user.wallet_balance }
      },
      error: null
    });
  });
});

// Service status endpoint
app.get('/api/service/auth/status', (req, res) => {
  res.json({
    success: true,
    data: { status: 'active', service: 'auth', uptime: process.uptime() },
    error: null
  });
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});

export default app;