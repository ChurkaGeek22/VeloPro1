import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import { initDb, enqueue, run, get, all, saveDb } from '../../data-db/db.js';

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'velopro-secret-key-change-in-production';

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().catch(console.error);

// Middleware: проверка авторизации
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

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'push' }, error: null });
});

// POST /api/push/subscribe (требует авторизации, подписка только для себя)
app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
  await enqueue(async () => {
    const { endpoint, keys } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Endpoint обязателен' }
      });
    }

    const existing = get('SELECT id FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    const now = new Date().toISOString();

    if (existing) {
      run('UPDATE push_subscriptions SET user_id = ?, updated_at = ? WHERE id = ?',
        [req.user.userId, now, existing.id]);
    } else {
      run('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nanoid(), req.user.userId, endpoint, keys?.p256dh || null, keys?.auth || null, now, now]);
    }

    saveDb();

    return res.json({
      success: true,
      data: { message: 'Подписка на push-уведомления оформлена' },
      error: null
    });
  });
});

// POST /api/push/send — отправка уведомления только себе (проверка владения userId)
app.post('/api/push/send', authenticateToken, async (req, res) => {
  await enqueue(async () => {
    const { userId, title, body, data } = req.body;

    // Пользователь может отправлять уведомления только себе
    if (userId && userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { code: 'FORBIDDEN', message: 'Можно отправлять уведомления только себе' }
      });
    }

    const targetUserId = userId || req.user.userId;

    if (!title && !body) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'title или body обязательны' }
      });
    }

    const userSubscriptions = all('SELECT * FROM push_subscriptions WHERE user_id = ?', [targetUserId]);

    if (userSubscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NO_SUBSCRIPTIONS', message: 'У пользователя нет активных подписок' }
      });
    }

    const notifications = userSubscriptions.map(sub => ({
      subscriptionId: sub.id,
      endpoint: sub.endpoint,
      title: title || 'ВелоПРО',
      body: body || 'Новое уведомление',
      data: data || {},
      timestamp: new Date().toISOString()
    }));

    return res.json({
      success: true,
      data: {
        message: `Уведомление отправлено ${notifications.length} устройству(ам)`,
        sentTo: notifications.length,
        notifications
      },
      error: null
    });
  });
});

// GET /api/push/status (требует авторизации, только свои подписки)
app.get('/api/push/status', authenticateToken, async (req, res) => {
  await enqueue(async () => {
    const count = get('SELECT COUNT(*) as cnt FROM push_subscriptions WHERE user_id = ?', [req.user.userId]).cnt;

    return res.json({
      success: true,
      data: {
        status: 'active',
        service: 'push',
        totalSubscriptions: count,
        uptime: process.uptime()
      },
      error: null
    });
  });
});

// Service status endpoint
app.get('/api/service/push/status', (req, res) => {
  res.json({
    success: true,
    data: { status: 'active', service: 'push', uptime: process.uptime() },
    error: null
  });
});

app.listen(PORT, () => {
  console.log(`Push service running on port ${PORT}`);
});

export default app;