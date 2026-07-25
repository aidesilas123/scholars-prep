window.addEventListener('DOMContentLoaded', async () => {
    
    // ==========================================
    // 1. TRANSPARENT STATUS BAR CONFIGURATION
    // ==========================================
    if (window.Capacitor && window.Capacitor.Plugins.StatusBar) {
        try {
            const StatusBar = window.Capacitor.Plugins.StatusBar;
            
            // 1. Tell the webview to flow UNDER the status bar (Floating)
            await StatusBar.setOverlaysWebView({ overlay: true });

            // 2. Make the status bar background completely transparent
            await StatusBar.setBackgroundColor({ color: '#00000000' });

            // 3. Smart Text Color Logic (Opposite of background)
            const isWelcomePage = window.location.pathname.includes('welcome.html');
            const isDarkMode = document.documentElement.classList.contains('dark');
            
            let textStyle = 'LIGHT'; // Default to black text

            if (isWelcomePage) {
                // Welcome page has a white header, so we need Black text
                textStyle = 'LIGHT'; 
            } else if (isDarkMode) {
                // Dark mode app has dark background, so we need White text
                textStyle = 'DARK';
            } else {
                // Light mode app has light background, so we need Black text
                textStyle = 'LIGHT';
            }

            await StatusBar.setStyle({ style: textStyle });
            
        } catch (err) {
            console.warn("Status Bar configuration bypassed or failed:", err);
        }
    }

    // ==========================================
    // 2. CAPGO OTA UPDATER LOGIC
    // ==========================================
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