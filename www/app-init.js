window.addEventListener('DOMContentLoaded', async () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
        try {
            const Updater = window.Capacitor.Plugins.CapacitorUpdater;
            
            await Updater.notifyAppReady();
            console.log("Capgo Updater: App state verified.");

            // 1. Ask Capgo what OTA version is CURRENTLY active in memory
            const capgoState = await Updater.current();
            const activeOtaVersion = capgoState && capgoState.bundle ? capgoState.bundle.version : null;

            // 2. Fallback to the native baseline version
            const nativeVersion = "6.5.0"; // Ensure this matches the APK installed on the phone
            
            const currentAppVersion = activeOtaVersion || nativeVersion;
            console.log(`Current active version: ${currentAppVersion}`);

            // 3. Check Vercel
            const response = await fetch('https://scholars-prep.vercel.app/update.json');
            
            if (response.ok) {
                const data = await response.json();
                
                // 4. Compare true version against Vercel
                if (data.latestVersion !== currentAppVersion) {
                    console.log(`New update ${data.latestVersion} found. Starting download...`);
                    
                    // Listen to the download progress to verify the file is moving
                    let progressListener = await Updater.addListener('download', (info) => {
                        console.log(`Downloading: ${info.percent}%`);
                    });
                    
                    // 5. Start the download with the new Cache-Busting URL
                    const version = await Updater.download({
                        version: data.latestVersion,
                        url: data.url, 
                    });

                    // Clean up the listener once finished
                    if (progressListener) {
                        progressListener.remove();
                    }

                    // 6. The Requested Success Indicator
                    console.log(`Download complete! Version ${data.latestVersion} has been safely stored in the background and will be loaded on the next launch.`);
                    
                    // 7. Set the update to apply silently on next app boot
                    await Updater.set(version, {
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