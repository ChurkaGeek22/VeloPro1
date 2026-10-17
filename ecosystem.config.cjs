module.exports = {
  apps: [
    {
      name: 'auth-service',
      script: './microservices/auth/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 1,
      min_uptime: '10s',
      env: {
        PORT: 3001,
        DATA_DIR: './data-db',
        JWT_SECRET: 'velopro-secret-key-change-in-production',
        NODE_ENV: 'development'
      },
      env_production: {
        PORT: 3001,
        DATA_DIR: './data-db',
        JWT_SECRET: 'velopro-secret-key-change-in-production',
        NODE_ENV: 'production'
      }
    },
    {
      name: 'api-service',
      script: './microservices/api/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 1,
      min_uptime: '10s',
      env: {
        PORT: 3002,
        DATA_DIR: './data-db',
        AUTH_SERVICE_URL: 'http://localhost:3001',
        PUSH_SERVICE_URL: 'http://localhost:3003',
        APP_SERVICE_URL: 'http://localhost:3004',
        NODE_ENV: 'development'
      },
      env_production: {
        PORT: 3002,
        DATA_DIR: './data-db',
        AUTH_SERVICE_URL: 'http://localhost:3001',
        PUSH_SERVICE_URL: 'http://localhost:3003',
        APP_SERVICE_URL: 'http://localhost:3004',
        NODE_ENV: 'production'
      }
    },
    {
      name: 'push-service',
      script: './microservices/push/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 1,
      min_uptime: '10s',
      env: {
        PORT: 3003,
        DATA_DIR: './data-db',
        NODE_ENV: 'development'
      },
      env_production: {
        PORT: 3003,
        DATA_DIR: './data-db',
        NODE_ENV: 'production'
      }
    },
    {
      name: 'app-service',
      script: './microservices/app/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 1,
      min_uptime: '10s',
      env: {
        PORT: 3004,
        DATA_DIR: './data-db',
        NODE_ENV: 'development'
      },
      env_production: {
        PORT: 3004,
        DATA_DIR: './data-db',
        NODE_ENV: 'production'
      }
    }
  ]
};