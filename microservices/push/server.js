import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import { initDb, enqueue, run, get, all, saveDb } from '../../data-db/db.js';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().catch(console.error);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'push' }, error: null });
});

// POST /api/push/subscribe
app.post('/api/push/subscribe', async (req, res) => {
  await enqueue(async () => {
    const { endpoint, keys, userId } = req.body;

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
        [userId || null, now, existing.id]);
    } else {
      run('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nanoid(), userId || null, endpoint, keys?.p256dh || null, keys?.auth || null, now, now]);
    }

    saveDb();

    return res.json({
      success: true,
      data: { message: 'Подписка на push-уведомления оформлена' },
      error: null
    });
  });
});

// POST /api/push/send — отправка уведомления конкретному пользователю
app.post('/api/push/send', async (req, res) => {
  await enqueue(async () => {
    const { userId, title, body, data } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'userId обязателен' }
      });
    }

    if (!title && !body) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'title или body обязательны' }
      });
    }

    const userSubscriptions = all('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);

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

// GET /api/push/status
app.get('/api/push/status', async (req, res) => {
  await enqueue(async () => {
    const count = get('SELECT COUNT(*) as cnt FROM push_subscriptions', []).cnt;

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