window.addEventListener('DOMContentLoaded', async () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
        try {
            // 1. Notify the app loaded successfully to prevent rollback loops
            await window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
            console.log("Capgo Updater: App state verified.");

            // 2. Fetch the version control file from the live website
            // IMPORTANT: Replace this URL with the actual Scholars Prep domain
            const response = await fetch('https://scholars-prep.vercel.app/update.json');
            
            if (response.ok) {
                const data = await response.json();
                
                // 3. Set the current version (Must match the version in this specific APK)
                const currentVersion = "6.4.1"; 

                // 4. Compare versions and trigger download if a newer version is hosted
                if (data.latestVersion !== currentVersion) {
                    console.log(`New update ${data.latestVersion} found. Downloading...`);
                    
                    const version = await window.Capacitor.Plugins.CapacitorUpdater.download({
                        version: data.latestVersion,
                        url: data.url, 
                    });

                    console.log("Download complete. Applying update...");
                    await window.Capacitor.Plugins.CapacitorUpdater.set(version);
                } else {
                    console.log("App is up to date.");
                }
            }

        } catch (err) {
            // Safe to ignore: network failure, missing JSON, or running in a standard web browser
            console.error("Update check bypassed or failed:", err);
        }
    }
});