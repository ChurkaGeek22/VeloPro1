const VeloStorage = (function() {
    const PREFIX = 'velopro_';
    
    function set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    }
    
    function get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(PREFIX + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    }
    
    function remove(key) {
        try {
            localStorage.removeItem(PREFIX + key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    }
    
    function clear() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(PREFIX)) {
                    keys.push(key);
                }
            }
            keys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (e) {
            console.error('Storage clear error:', e);
            return false;
        }
    }
    
    return {
        set, get, remove, clear,
        
        // User data
        setUserId(id) { return set('user_id', id); },
        getUserId() { return get('user_id'); },
        
        setSessionToken(token) { return set('session_token', token); },
        getSessionToken() { return get('session_token'); },
        
        setDeviceId(id) { return set('device_id', id); },
        getDeviceId() { return get('device_id'); },
        
        setCookie(name, value) { return set('cookie_' + name, value); },
        getCookie(name) { return get('cookie_' + name); },
        removeCookie(name) { return remove('cookie_' + name); },
        
        isAuthenticated() {
            return !!this.getUserId() && !!this.getSessionToken();
        },
        
        clearAuth() {
            this.remove('user_id');
            this.remove('session_token');
        }
    };
})();