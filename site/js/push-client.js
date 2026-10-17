const VeloPush = (function() {
    let registration = null;
    
    async function init() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return false;
        }
        
        if (!('PushManager' in window)) {
            console.warn('Push API not supported');
            return false;
        }
        
        try {
            registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Notification permission not granted');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Push init error:', error);
            return false;
        }
    }
    
    async function subscribe() {
        if (!registration) {
            await init();
        }
        
        try {
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    'BGn00W3L7B5J8K2M4N6P8Q0R2S4T6U8V0W2X4Y6Z8A0B2C4D6E8F0'
                )
            });
            
            const subscriptionJson = subscription.toJSON();
            
            // Send to push microservice
            await VeloAPI.subscribePush({
                endpoint: subscriptionJson.endpoint,
                keys: {
                    p256dh: subscriptionJson.keys ? subscriptionJson.keys.p256dh : '',
                    auth: subscriptionJson.keys ? subscriptionJson.keys.auth : ''
                }
            });
            
            console.log('Push subscribed:', subscriptionJson.endpoint);
            return subscription;
        } catch (error) {
            console.error('Push subscribe error:', error);
            throw error;
        }
    }
    
    async function unsubscribe() {
        if (!registration) return;
        
        try {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }
        } catch (error) {
            console.error('Push unsubscribe error:', error);
        }
    }
    
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    
    return {
        init,
        subscribe,
        unsubscribe
    };
})();