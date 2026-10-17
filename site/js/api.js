const VeloAPI = (function() {
    const BASE_URL = window.location.origin;
    
    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        // Add auth token if available
        const token = VeloStorage.getSessionToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Add device ID header
        const deviceId = VeloStorage.getDeviceId();
        if (deviceId) {
            config.headers['X-Device-Id'] = deviceId;
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => ({}));
            
            if (!response.ok) {
                throw {
                    code: response.status,
                    message: data.error || data.message || 'Ошибка запроса',
                    data: data
                };
            }
            
            return data;
        } catch (error) {
            if (error.code) {
                throw error;
            }
            throw {
                code: 0,
                message: error.message || 'Сетевая ошибка',
                data: null
            };
        }
    }
    
    return {
        // Auth
        async register(userData) {
            return request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        },
        
        async login(credentials) {
            return request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });
        },
        
        async logout() {
            return request('/api/auth/logout', {
                method: 'POST'
            });
        },
        
        async getProfile() {
            return request('/api/auth/me');
        },
        
        // App info
        async getAppInfo() {
            return request('/api/app/info');
        },
        
        async getAppVersion() {
            return request('/api/app/version');
        },
        
        async getVersions() {
            return request('/api/app/versions');
        },
        
        async downloadStableApk() {
            return request('/api/app/download/stable');
        },
        
        // Push
        async subscribePush(subscription) {
            return request('/api/push/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription)
            });
        },
        
        async sendPush(userId, title, body, data) {
            return request('/api/push/send', {
                method: 'POST',
                body: JSON.stringify({ userId, title, body, data })
            });
        },
        
        // Service status
        async getServiceStatus(serviceName) {
            return request(`/api/service/${serviceName}/status`);
        }
    };
})();