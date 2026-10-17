import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'velopro-secret-key-change-in-production';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), '../../data-db'));
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'active', service: 'auth' }, error: null });
});

// Read JSON file helper
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

// Write JSON file helper
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
    return false;
  }
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Email и пароль обязательны' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Пароль должен быть не менее 6 символов' }
      });
    }

    const usersData = readJsonFile(USERS_FILE, { users: [], nextId: 1 });

    const existingUser = usersData.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: { code: 'USER_EXISTS', message: 'Пользователь с таким email уже существует' }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = nanoid();

    const user = {
      id: userId,
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    usersData.users.push(user);
    writeJsonFile(USERS_FILE, usersData);

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        token
      },
      error: null
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера при регистрации' }
    });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Email и пароль обязательны' }
      });
    }

    const usersData = readJsonFile(USERS_FILE, { users: [], nextId: 1 });
    const user = usersData.users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' }
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' }
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Save session
    const sessionsData = readJsonFile(SESSIONS_FILE, { sessions: [] });
    sessionsData.sessions.push({
      userId: user.id,
      token,
      createdAt: new Date().toISOString()
    });
    writeJsonFile(SESSIONS_FILE, sessionsData);

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        token
      },
      error: null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера при входе' }
    });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const sessionsData = readJsonFile(SESSIONS_FILE, { sessions: [] });
      sessionsData.sessions = sessionsData.sessions.filter(s => s.token !== token);
      writeJsonFile(SESSIONS_FILE, sessionsData);
    }
    res.json({ success: true, data: { message: 'Выход выполнен' }, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера при выходе' }
    });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  try {
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

    const usersData = readJsonFile(USERS_FILE, { users: [], nextId: 1 });
    const user = usersData.users.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден' }
      });
    }

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name }
      },
      error: null
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера' }
    });
  }
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