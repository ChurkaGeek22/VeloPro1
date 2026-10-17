const VeloApp = (function() {
    let currentPage = 'homePage';
    let isMaintenanceMode = false;
    
    const pages = {
        homePage: document.getElementById('homePage'),
        catalogPage: document.getElementById('catalogPage'),
        profilePage: document.getElementById('profilePage'),
        morePage: document.getElementById('morePage'),
        appSectionPage: document.getElementById('appSectionPage')
    };
    
    const navItems = document.querySelectorAll('.nav-item');
    
    function init() {
        setupNavigation();
        setupAppSection();
        setupAuth();
        checkMaintenanceMode();
        loadStats();
        
        // Initialize device ID
        if (!VeloStorage.getDeviceId()) {
            const deviceId = 'dev_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            VeloStorage.setDeviceId(deviceId);
        }
        
        // Initialize push notifications
        if (typeof VeloPush !== 'undefined') {
            VeloPush.init().catch(() => {});
        }
    }
    
    function setupNavigation() {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = item.getAttribute('data-page');
                navigateTo(pageId);
                
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }
    
    function navigateTo(pageId) {
        Object.values(pages).forEach(page => {
            page.classList.remove('active');
            page.classList.add('hidden');
        });
        
        if (pages[pageId]) {
            pages[pageId].classList.remove('hidden');
            pages[pageId].classList.add('active');
            currentPage = pageId;
        }
    }
    
    function setupAppSection() {
        const appSectionMenu = document.getElementById('appSectionMenu');
        const backToMore = document.getElementById('backToMore');
        const downloadApkBtn = document.getElementById('downloadApkBtn');
        const downloadStatus = document.getElementById('downloadStatus');
        
        if (appSectionMenu) {
            appSectionMenu.addEventListener('click', () => {
                navigateTo('appSectionPage');
                loadAppVersions();
            });
        }
        
        if (backToMore) {
            backToMore.addEventListener('click', () => {
                navigateTo('morePage');
            });
        }
        
        if (downloadApkBtn) {
            downloadApkBtn.addEventListener('click', async () => {
                downloadApkBtn.disabled = true;
                downloadApkBtn.textContent = 'Загрузка...';
                downloadStatus.textContent = '';
                
                try {
                    const result = await VeloAPI.downloadStableApk();
                    if (result.success) {
                        downloadStatus.textContent = 'APK готов к скачиванию';
                        const link = document.createElement('a');
                        link.href = result.data.downloadUrl;
                        link.download = 'velopro-stable.apk';
                        link.click();
                    } else {
                        downloadStatus.textContent = 'Ошибка: ' + (result.error || 'Неизвестная ошибка');
                    }
                } catch (error) {
                    downloadStatus.textContent = 'Ошибка: ' + error.message;
                } finally {
                    downloadApkBtn.disabled = false;
                    downloadApkBtn.textContent = 'Скачать APK';
                }
            });
        }
    }
    
    async function loadAppVersions() {
        try {
            const result = await VeloAPI.getVersions();
            if (result.success) {
                const stableVersion = document.getElementById('stableVersion');
                const currentVersion = document.getElementById('currentVersion');
                
                if (stableVersion && result.data.stable) {
                    stableVersion.textContent = result.data.stable.version || '1.0.1';
                }
                if (currentVersion && result.data.current) {
                    currentVersion.textContent = result.data.current.version || '1.0.1';
                }
            }
        } catch (error) {
            console.error('Load versions error:', error);
        }
    }
    
    function setupAuth() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const email = prompt('Введите email:');
                if (!email) return;
                
                const password = prompt('Введите пароль:');
                if (!password) return;
                
                try {
                    const result = await VeloAPI.login({ email, password });
                    if (result.success) {
                        VeloStorage.setUserId(result.data.user.id);
                        VeloStorage.setSessionToken(result.data.token);
                        updateAuthUI(true, result.data.user);
                        AndroidBridge.showToast('Вход выполнен');
                    }
                } catch (error) {
                    alert('Ошибка входа: ' + error.message);
                }
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await VeloAPI.logout();
                } catch (e) {}
                VeloStorage.clearAuth();
                updateAuthUI(false);
                AndroidBridge.showToast('Вы вышли');
            });
        }
        
        updateAuthUI(VeloStorage.isAuthenticated());
    }
    
    function updateAuthUI(authenticated, user = null) {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        
        if (authenticated && user) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            if (profileName) profileName.textContent = user.name || 'Пользователь';
            if (profileEmail) profileEmail.textContent = user.email || '';
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (profileName) profileName.textContent = 'Гость';
            if (profileEmail) profileEmail.textContent = 'Не авторизован';
        }
    }
    
    async function checkMaintenanceMode() {
        try {
            const result = await VeloAPI.getServiceStatus('app');
            if (result.success && result.data.maintenance) {
                showMaintenanceMode(result.data.message);
            }
        } catch (error) {
            // Service may be unavailable, continue without maintenance check
        }
    }
    
    function showMaintenanceMode(message) {
        isMaintenanceMode = true;
        const appMain = document.querySelector('.app-main');
        if (appMain) {
            appMain.innerHTML = `
                <div class="maintenance-container" style="text-align:center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔧</div>
                    <h1 style="color: #00695C; font-size: 24px; margin-bottom: 16px;">Идут технические работы</h1>
                    <p style="color: #666; font-size: 16px; line-height: 1.5; max-width: 300px; margin: 0 auto;">
                        Скоро вернемся,<br>
                        а сейчас мы вносим улучшения...<br><br>
                        Через некоторое время всё заработает.
                    </p>
                </div>
            `;
        }
    }
    
    async function loadStats() {
        try {
            const result = await VeloAPI.getAppInfo();
            if (result.success && result.data.stats) {
                const totalDistance = document.getElementById('totalDistance');
                const totalRides = document.getElementById('totalRides');
                const totalTime = document.getElementById('totalTime');
                
                if (totalDistance) totalDistance.textContent = result.data.stats.distance || '0';
                if (totalRides) totalRides.textContent = result.data.stats.rides || '0';
                if (totalTime) totalTime.textContent = result.data.stats.time || '0';
            }
        } catch (error) {
            console.error('Load stats error:', error);
        }
    }
    
    return {
        init,
        navigateTo,
        showMaintenanceMode
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    VeloApp.init();
});