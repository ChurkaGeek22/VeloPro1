import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDb, enqueue, get, saveDb } from '../../data-db/db.js';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().catch(console.error);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'app' }, error: null });
});

// GET /api/app/versions
app.get('/api/app/versions', async (req, res) => {
  await enqueue(async () => {
    const versions = all('SELECT * FROM app_versions ORDER BY created_at DESC', []);
    const maintenance = get('SELECT enabled, message FROM maintenance WHERE id = 1', []);

    return res.json({
      success: true,
      data: {
        versions,
        maintenance: Boolean(maintenance?.enabled),
        maintenanceMessage: maintenance?.message || null
      },
      error: null
    });
  });
});

// GET /api/app/version
app.get('/api/app/version', async (req, res) => {
  await enqueue(async () => {
    const versionRow = get('SELECT version, type, download_url FROM app_versions WHERE type = ? ORDER BY created_at DESC LIMIT 1', ['stable']);

    return res.json({
      success: true,
      data: {
        version: versionRow ? versionRow.version : '1.0.1',
        type: versionRow ? versionRow.type : 'stable',
        downloadUrl: versionRow ? versionRow.download_url : null
      },
      error: null
    });
  });
});

// GET /api/app/download/stable
app.get('/api/app/download/stable', async (req, res) => {
  await enqueue(async () => {
    const versionRow = get('SELECT * FROM app_versions WHERE type = ? ORDER BY created_at DESC LIMIT 1', ['stable']);

    if (!versionRow) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'VERSION_NOT_FOUND', message: 'Стабильная версия не найдена' }
      });
    }

    return res.json({
      success: true,
      data: {
        version: versionRow.version,
        downloadUrl: versionRow.download_url,
        size: versionRow.size,
        minSdkVersion: versionRow.min_sdk_version
      },
      error: null
    });
  });
});

// GET /api/app/status
app.get('/api/app/status', async (req, res) => {
  await enqueue(async () => {
    const maintenance = get('SELECT enabled, message FROM maintenance WHERE id = 1', []);

    return res.json({
      success: true,
      data: {
        status: maintenance?.enabled ? 'maintenance' : 'active',
        maintenance: Boolean(maintenance?.enabled),
        maintenanceMessage: maintenance?.message || null,
        service: 'app',
        uptime: process.uptime()
      },
      error: null
    });
  });
});

// Service status endpoint
app.get('/api/service/app/status', (req, res) => {
  res.json({
    success: true,
    data: { status: 'active', service: 'app', uptime: process.uptime() },
    error: null
  });
});

app.listen(PORT, () => {
  console.log(`App service running on port ${PORT}`);
});

export default app;