// app-init.js
window.addEventListener('DOMContentLoaded', async () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
        try {
            await window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
            console.log("Capgo Updater: App state verified.");
        } catch (err) {
            // Safe to ignore if running on web
        }
    }
});