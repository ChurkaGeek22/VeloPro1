import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fetch from 'node-fetch';
import { initDb, enqueue, get, saveDb } from '../../data-db/db.js';

const app = express();
const PORT = process.env.PORT || 3002;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const PUSH_SERVICE_URL = process.env.PUSH_SERVICE_URL || 'http://localhost:3003';
const APP_SERVICE_URL = process.env.APP_SERVICE_URL || 'http://localhost:3004';

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().catch(console.error);

async function proxyRequest(serviceUrl, endpoint, options = {}) {
  try {
    const url = `${serviceUrl}${endpoint}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    return { status: 503, data: { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Сервис временно недоступен' } } };
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'api' }, error: null });
});

// GET /api/app/info
app.get('/api/app/info', async (req, res) => {
  await enqueue(async () => {
    const versionRow = get('SELECT version FROM app_versions WHERE type = ? ORDER BY created_at DESC LIMIT 1', ['stable']);
    const maintenanceRow = get('SELECT enabled, message FROM maintenance WHERE id = 1', []);

    const result = await proxyRequest(AUTH_SERVICE_URL, '/api/service/auth/status');

    return res.json({
      success: true,
      data: {
        app: {
          name: 'ВелоПРО',
          version: versionRow ? versionRow.version : '1.0.1',
          maintenance: Boolean(maintenanceRow?.enabled),
          maintenanceMessage: maintenanceRow?.message || null
        },
        services: {
          auth: result.status === 200 ? 'active' : 'unavailable'
        }
      },
      error: null
    });
  });
});

// GET /api/app/version
app.get('/api/app/version', async (req, res) => {
  await enqueue(async () => {
    const versionRow = get('SELECT version, type FROM app_versions WHERE type = ? ORDER BY created_at DESC LIMIT 1', ['stable']);

    return res.json({
      success: true,
      data: {
        version: versionRow ? versionRow.version : '1.0.1',
        type: versionRow ? versionRow.type : 'stable'
      },
      error: null
    });
  });
});

// Proxy to auth service
app.post('/api/auth/register', async (req, res) => {
  const result = await proxyRequest(AUTH_SERVICE_URL, '/api/auth/register', {
    method: 'POST',
    body: req.body
  });
  res.status(result.status).json(result.data);
});

app.post('/api/auth/login', async (req, res) => {
  const result = await proxyRequest(AUTH_SERVICE_URL, '/api/auth/login', {
    method: 'POST',
    body: req.body
  });
  res.status(result.status).json(result.data);
});

app.post('/api/auth/logout', async (req, res) => {
  const result = await proxyRequest(AUTH_SERVICE_URL, '/api/auth/logout', {
    method: 'POST',
    headers: req.headers
  });
  res.status(result.status).json(result.data);
});

app.get('/api/auth/me', async (req, res) => {
  const result = await proxyRequest(AUTH_SERVICE_URL, '/api/auth/me', {
    headers: req.headers
  });
  res.status(result.status).json(result.data);
});

// Proxy to push service
app.post('/api/push/subscribe', async (req, res) => {
  const result = await proxyRequest(PUSH_SERVICE_URL, '/api/push/subscribe', {
    method: 'POST',
    body: req.body
  });
  res.status(result.status).json(result.data);
});

app.post('/api/push/send', async (req, res) => {
  const result = await proxyRequest(PUSH_SERVICE_URL, '/api/push/send', {
    method: 'POST',
    body: req.body
  });
  res.status(result.status).json(result.data);
});

// Service status endpoint
app.get('/api/service/api/status', (req, res) => {
  res.json({
    success: true,
    data: { status: 'active', service: 'api', uptime: process.uptime() },
    error: null
  });
});

app.listen(PORT, () => {
  console.log(`API service running on port ${PORT}`);
});

export default app;