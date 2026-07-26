window.addEventListener('DOMContentLoaded', async () => {
    
    // ==========================================
    // 1. TRANSPARENT STATUS BAR CONFIGURATION
    // ==========================================
    if (window.Capacitor && window.Capacitor.Plugins.StatusBar) {
        try {
            const StatusBar = window.Capacitor.Plugins.StatusBar;
            
            await StatusBar.setOverlaysWebView({ overlay: true });
            await StatusBar.setBackgroundColor({ color: '#00000000' });

            const isWelcomePage = window.location.pathname.includes('welcome.html');
            const isDarkMode = document.documentElement.classList.contains('dark');
            
            let textStyle = 'LIGHT'; 

            if (isWelcomePage) {
                textStyle = 'LIGHT'; 
            } else if (isDarkMode) {
                textStyle = 'DARK';
            } else {
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

                    let updateApplied = false;

                    const applyUpdateSilently = async () => {
                        if (!updateApplied) {
                            updateApplied = true;
                            console.log("App moved to background. Applying update now...");
                            await Updater.set(version);
                        }
                    };

                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'hidden') {
                            applyUpdateSilently();
                        }
                    });

                    if (window.Capacitor.Plugins.App) {
                        window.Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
                            if (!isActive) {
                                applyUpdateSilently();
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Update check bypassed or failed:", err);
        }
    }

    // ==========================================
    // 3. PUSH NOTIFICATIONS & SUPABASE SYNC
    // ==========================================
    if (window.Capacitor && window.Capacitor.Plugins.PushNotifications) {
        try {
            const PushNotifications = window.Capacitor.Plugins.PushNotifications;

            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive === 'granted') {
                await PushNotifications.register();
            }

            PushNotifications.addListener('registration', async (token) => {
                console.log('Firebase Push Token generated:', token.value);
                await saveTokenToSupabase(token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Error during push registration:', error);
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push notification received in foreground:', notification);
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('User tapped the notification:', notification);
            });

        } catch (err) {
            console.warn("Push Notifications configuration failed:", err);
        }
    }
});

// ==========================================
// SUPABASE TOKEN SAVER
// ==========================================
async function saveTokenToSupabase(fcmToken) {
    try {
        // 1. Check if user is logged in
        const studentData = localStorage.getItem('abupq_logged_in_user');
        const putmeData = localStorage.getItem('post_utme_logged_in_user');
        
        let userId = null;
        if (studentData) userId = JSON.parse(studentData).id;
        else if (putmeData) userId = JSON.parse(putmeData).id;

        if (!userId) {
            console.log("No logged in user found. Skipping token save.");
            return;
        }

        // 2. Your Exact Credentials
        const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
        
        // IMPORTANT: Change 'users' to 'profiles' below if that is where you added the fcm_token column!
        const tableName = 'users'; 

        // 3. Attempt to use global client, fallback to direct REST API if not loaded yet
        if (typeof supabaseClient !== 'undefined') {
            const { error } = await supabaseClient
                .from(tableName)
                .update({ fcm_token: fcmToken })
                .eq('id', userId);

            if (error) throw error;
            console.log("Successfully saved FCM token using supabaseClient.");
        } else {
            // Direct REST fallback for maximum reliability (runs even if Supabase SDK isn't loaded)
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ fcm_token: fcmToken })
            });
            
            if (!response.ok) throw new Error('REST API update failed');
            console.log("Successfully saved FCM token using REST fallback.");
        }
    } catch (err) {
        console.error("Error saving FCM token to Supabase:", err);
    }
}