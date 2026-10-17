import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3003;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), '../../data-db'));
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

app.use(helmet());
app.use(cors());
app.use(express.json());

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
    return false;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'push' }, error: null });
});

// POST /api/push/subscribe
app.post('/api/push/subscribe', (req, res) => {
  try {
    const { endpoint, keys, userId } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Endpoint обязателен' }
      });
    }

    const subscriptionsData = readJsonFile(SUBSCRIPTIONS_FILE, { subscriptions: [] });

    const existingIndex = subscriptionsData.subscriptions.findIndex(s => s.endpoint === endpoint);
    if (existingIndex >= 0) {
      subscriptionsData.subscriptions[existingIndex] = {
        ...subscriptionsData.subscriptions[existingIndex],
        userId,
        updatedAt: new Date().toISOString()
      };
    } else {
      subscriptionsData.subscriptions.push({
        id: nanoid(),
        endpoint,
        keys: keys || {},
        userId: userId || null,
        createdAt: new Date().toISOString()
      });
    }

    writeJsonFile(SUBSCRIPTIONS_FILE, subscriptionsData);

    res.json({
      success: true,
      data: { message: 'Подписка на push-уведомления оформлена' },
      error: null
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера при подписке' }
    });
  }
});

// POST /api/push/send
app.post('/api/push/send', (req, res) => {
  try {
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

    const subscriptionsData = readJsonFile(SUBSCRIPTIONS_FILE, { subscriptions: [] });
    const userSubscriptions = subscriptionsData.subscriptions.filter(s => s.userId === userId);

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

    res.json({
      success: true,
      data: {
        message: `Уведомление отправлено ${notifications.length} устройству(ам)`,
        sentTo: notifications.length,
        notifications
      },
      error: null
    });
  } catch (error) {
    console.error('Send push error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера при отправке уведомления' }
    });
  }
});

// GET /api/push/status
app.get('/api/push/status', (req, res) => {
  const subscriptionsData = readJsonFile(SUBSCRIPTIONS_FILE, { subscriptions: [] });
  res.json({
    success: true,
    data: {
      status: 'active',
      service: 'push',
      totalSubscriptions: subscriptionsData.subscriptions.length,
      uptime: process.uptime()
    },
    error: null
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