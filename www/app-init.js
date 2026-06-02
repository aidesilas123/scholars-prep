window.addEventListener('DOMContentLoaded', async () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
        try {
            await window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
            console.log("Capgo Updater: App state verified.");

            // 1. Ask Capgo what OTA version is CURRENTLY active in memory
            const capgoState = await window.Capacitor.Plugins.CapacitorUpdater.current();
            const activeOtaVersion = capgoState && capgoState.bundle ? capgoState.bundle.version : null;

            // 2. Fallback to the native baseline version if no OTA is active
            const nativeVersion = "6.4.6"; 
            // Determine the true current version (OTA wins if it exists)
            const currentAppVersion = activeOtaVersion || nativeVersion;
            console.log(`Current active version: ${currentAppVersion}`);

            // 3. Check Vercel
            const response = await fetch('https://scholars-prep.vercel.app/update.json');
            
            if (response.ok) {
                const data = await response.json();
                
                // 4. Compare true version against Vercel
                if (data.latestVersion !== currentAppVersion) {
                    console.log(`New update ${data.latestVersion} found. Downloading...`);
                    
                    const version = await window.Capacitor.Plugins.CapacitorUpdater.download({
                        version: data.latestVersion,
                        url: data.url, 
                    });

                    console.log("Download complete. Applying update in the background...");
                    
                    // 5. BACKGROUND UPDATE: Download it now, but don't apply it until the app restarts
                    await window.Capacitor.Plugins.CapacitorUpdater.set(version, {
                         // This specific config tells Capgo to load the new code on the NEXT boot
                        strategy: 'background' 
                    });
                    
                } else {
                    console.log("App is up to date.");
                }
            }
        } catch (err) {
            console.error("Update check bypassed or failed:", err);
        }
    }
});