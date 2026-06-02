window.addEventListener('DOMContentLoaded', async () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
        try {
            const Updater = window.Capacitor.Plugins.CapacitorUpdater;
            
            await Updater.notifyAppReady();
            console.log("Capgo Updater: App state verified.");

            const capgoState = await Updater.current();
            const activeOtaVersion = capgoState && capgoState.bundle ? capgoState.bundle.version : null;
            
            // Your Master APK baseline
            const nativeVersion = "6.5.0"; 
            
            const currentAppVersion = activeOtaVersion || nativeVersion;
            console.log(`Current active version: ${currentAppVersion}`);

            const response = await fetch('https://scholars-prep.vercel.app/update.json');
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.latestVersion !== currentAppVersion) {
                    console.log(`New update ${data.latestVersion} found. Starting silent download...`);
                    
                    const version = await Updater.download({
                        version: data.latestVersion,
                        url: data.url, 
                    });

                    console.log(`Download complete! The update is waiting.`);
                    console.log(`It will install automatically the exact moment the app is minimized.`);
                    
                    // ==========================================
                    // THE FIX: Wait for app to be hidden to apply
                    // ==========================================
                    let updateApplied = false;

                    const applyUpdateSilently = async () => {
                        if (!updateApplied) {
                            updateApplied = true;
                            console.log("App moved to background. Applying update now...");
                            await Updater.set(version);
                        }
                    };

                    // 1. Standard Web API for background detection
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'hidden') {
                            applyUpdateSilently();
                        }
                    });

                    // 2. Native Capacitor App Plugin fallback (if installed)
                    if (window.Capacitor.Plugins.App) {
                        window.Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
                            if (!isActive) {
                                applyUpdateSilently();
                            }
                        });
                    }
                    
                } else {
                    console.log("App is up to date.");
                }
            }
        } catch (err) {
            console.error("Update check bypassed or failed:", err);
        }
    }
});