const AppDownload = (function() {
    const downloadBtn = document.getElementById('downloadApkBtn');
    const downloadStatus = document.getElementById('downloadStatus');
    const stableVersionEl = document.getElementById('stableVersion');
    const backBtn = document.getElementById('backBtn');
    
    function init() {
        loadVersionInfo();
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadApk);
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }
    }
    
    async function loadVersionInfo() {
        try {
            const result = await VeloAPI.getVersions();
            if (result.success && result.data.stable) {
                if (stableVersionEl) {
                    stableVersionEl.textContent = result.data.stable.version || '1.0.1';
                }
            }
        } catch (error) {
            console.error('Load version error:', error);
        }
    }
    
    async function downloadApk() {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Загрузка...';
        downloadStatus.textContent = '';
        
        try {
            const result = await VeloAPI.downloadStableApk();
            if (result.success) {
                downloadStatus.textContent = 'APK готов к скачиванию';
                downloadStatus.style.color = '#00695C';
                
                const link = document.createElement('a');
                link.href = result.data.downloadUrl;
                link.download = 'velopro-stable.apk';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                downloadStatus.textContent = 'Ошибка: ' + (result.error || 'Неизвестная ошибка');
                downloadStatus.style.color = '#d32f2f';
            }
        } catch (error) {
            downloadStatus.textContent = 'Ошибка: ' + error.message;
            downloadStatus.style.color = '#d32f2f';
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Скачать APK';
        }
    }
    
    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    AppDownload.init();
});