import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), '../../data-db'));
const APP_VERSIONS_FILE = path.join(DATA_DIR, 'app-versions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const PUSH_SERVICE_URL = process.env.PUSH_SERVICE_URL || 'http://localhost:3003';
const APP_SERVICE_URL = process.env.APP_SERVICE_URL || 'http://localhost:3004';

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
  try {
    const versionsData = readJsonFile(APP_VERSIONS_FILE, { versions: [], maintenance: false });
    
    const result = await proxyRequest(AUTH_SERVICE_URL, '/api/service/auth/status');
    
    res.json({
      success: true,
      data: {
        app: {
          name: 'ВелоПРО',
          version: versionsData.versions.length > 0 ? versionsData.versions[0].version : '1.0.1',
          maintenance: versionsData.maintenance || false
        },
        services: {
          auth: result.status === 200 ? 'active' : 'unavailable'
        }
      },
      error: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера' }
    });
  }
});

// GET /api/app/version
app.get('/api/app/version', (req, res) => {
  try {
    const versionsData = readJsonFile(APP_VERSIONS_FILE, { versions: [] });
    const stableVersion = versionsData.versions.find(v => v.type === 'stable');
    
    res.json({
      success: true,
      data: {
        version: stableVersion ? stableVersion.version : '1.0.1',
        type: stableVersion ? stableVersion.type : 'stable'
      },
      error: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера' }
    });
  }
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