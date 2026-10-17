import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3004;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), '../../data-db'));
const APP_VERSIONS_FILE = path.join(DATA_DIR, 'app-versions.json');

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
  res.json({ success: true, data: { status: 'active', service: 'app' }, error: null });
});

// GET /api/app/versions
app.get('/api/app/versions', (req, res) => {
  try {
    const versionsData = readJsonFile(APP_VERSIONS_FILE, { versions: [], maintenance: false });
    res.json({
      success: true,
      data: {
        versions: versionsData.versions,
        maintenance: versionsData.maintenance || false,
        maintenanceMessage: versionsData.maintenanceMessage || null
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
        type: stableVersion ? stableVersion.type : 'stable',
        downloadUrl: stableVersion ? stableVersion.downloadUrl : null
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

// GET /api/app/download/stable
app.get('/api/app/download/stable', (req, res) => {
  try {
    const versionsData = readJsonFile(APP_VERSIONS_FILE, { versions: [] });
    const stableVersion = versionsData.versions.find(v => v.type === 'stable');

    if (!stableVersion) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'VERSION_NOT_FOUND', message: 'Стабильная версия не найдена' }
      });
    }

    res.json({
      success: true,
      data: {
        version: stableVersion.version,
        downloadUrl: stableVersion.downloadUrl,
        size: stableVersion.size,
        minSdkVersion: stableVersion.minSdkVersion
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

// GET /api/app/status
app.get('/api/app/status', (req, res) => {
  try {
    const versionsData = readJsonFile(APP_VERSIONS_FILE, { versions: [], maintenance: false });
    res.json({
      success: true,
      data: {
        status: versionsData.maintenance ? 'maintenance' : 'active',
        maintenance: versionsData.maintenance || false,
        maintenanceMessage: versionsData.maintenanceMessage || null,
        service: 'app',
        uptime: process.uptime()
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