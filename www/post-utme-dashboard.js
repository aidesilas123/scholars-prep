// --- AUTH GUARD & INIT ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) {
        window.location.replace('/'); 
    }
})();
// --- 1. SECURITY & DATA LOADING (The Skeleton Shimmer) ---
document.addEventListener('DOMContentLoaded', () => {
    const skeletonUI = document.getElementById('skeleton-ui');
    const realUI = document.getElementById('real-ui');
    const nameDisplay = document.getElementById('candidateName');

    // Check if logged in securely
    const savedUser = localStorage.getItem('post_utme_logged_in_user');
    
    if (!savedUser) {
        // Kick out instantly if not logged in
        window.location.replace('post-utme-login.html');
        return;
    }

    // Parse user data
    const user = JSON.parse(savedUser);
    nameDisplay.textContent = user.name.split(' ')[0]; // Show first name

    // Simulate fetching data from Supabase (To let the shimmer run for 1 second)
    setTimeout(() => {
        skeletonUI.style.display = 'none';
        realUI.style.display = 'block';
        // Trigger a tiny delay to allow CSS opacity transition to fire
        setTimeout(() => { realUI.style.opacity = '1'; }, 50);
        
        startCarousel(); // Start sliding only after UI is visible
    }, 1200);
});

let userReferralCode = "";

document.addEventListener('DOMContentLoaded', () => {
    const userString = localStorage.getItem('post_utme_logged_in_user');
    
    if (userString) {
        // 1. Check if we already generated a code for them on this device
        userReferralCode = localStorage.getItem('my_referral_code');

        // 2. If no code exists, generate a fresh 8-character alphanumeric string
        if (!userReferralCode) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            userReferralCode = '';
            for (let i = 0; i < 8; i++) {
                userReferralCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            // 3. Save it instantly so it never changes on refresh
            localStorage.setItem('my_referral_code', userReferralCode);
        }
        
        // Display it in the UI
        document.getElementById('myReferralCode').innerText = userReferralCode;
    }
    
    fetchReferralProgress(); 
    checkNewAlerts();
});

// Share Function (Remains exactly the same as before)
window.copyReferralMessage = async function() {
    const btn = document.getElementById('shareCodeBtn');
    const shareMessage = `I'm using Scholars Prep to study for the ABU POST UTME! Join me and use my referral code: ${userReferralCode} during sign up.\n\nRegister here: https://scholars-prep.vercel.app/post-utme-login?ref=${userReferralCode}`;

    try {
        await navigator.clipboard.writeText(shareMessage);
        
        const originalText = btn.innerHTML;
        btn.innerHTML = `<ion-icon name="checkmark-circle" slot="start"></ion-icon> Copied!`;
        btn.color = "success";
        
        const toast = document.createElement('ion-toast');
        toast.message = 'Invite message copied to clipboard! Paste it on WhatsApp.';
        toast.duration = 3000;
        toast.color = 'dark';
        document.body.appendChild(toast);
        await toast.present();

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.color = "warning";
        }, 3000);
    } catch (err) {
        console.error('Failed to copy', err);
    }
};

// --- 2. CAROUSEL SLIDER LOGIC ---
function startCarousel() {
    const track = document.getElementById('sliderTrack');

    setInterval(() => {
        // If the user has scrolled to the very end of the track
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
            // Scroll back to the first card
            track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            // Auto-slide to the next card
            track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
        }
    }, 5000); // Still 5 seconds
}


// --- 4. THEME TOGGLE (Light/Dark Mode) ---
const themeBtn = document.getElementById('themeToggleBtn');
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    
    // Save preference to localStorage
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('post_utme_theme', isDark ? 'dark' : 'light');
});

// Check saved theme on load
if (localStorage.getItem('post_utme_theme') === 'dark') {
    document.body.classList.add('dark');
}

/// --- 5. LOGOUT LOGIC (With Modal Protection) ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Open the Logout Modal when they click the logout button
document.getElementById('logoutBtn').addEventListener('click', () => {
    document.getElementById('logoutOverlay').style.display = 'flex';
});

// 2. Execute the actual logout ONLY if they click YES inside the modal
document.getElementById('confirmLogoutBtn').addEventListener('click', async () => {
    // Hide modal instantly for a snappy UI feel
    document.getElementById('logoutOverlay').style.display = 'none';
    
    // Log out of Supabase to kill backend session
    await supabaseClient.auth.signOut();
    
    // Clear local storage
    localStorage.removeItem('post_utme_logged_in_user');
    
    // Redirect
    window.location.replace('/post-utme-login');
});

// --- 6. FETCH REFERRAL PROGRESS (The Missing Engine) ---
async function fetchReferralProgress() {
    
    const userString = localStorage.getItem('post_utme_logged_in_user');
    if (!userString) return;
    
    const authEmail = JSON.parse(userString).email;
    const targetReferrals = 10;

    console.log("Checking database for referrer:", authEmail); // Bug Tracker 1

    try {
        // We use supabaseClient here since you defined it in Section 5
        const { data, count, error } = await supabaseClient.from('putme_referrals')
            .select('*', { count: 'exact' }) 
            .eq('referrer_email', authEmail);

        if (error) {
            console.error("CRITICAL DASHBOARD ERROR:", error); // Bug Tracker 2
            return;
        }

        console.log("Rows found by Dashboard:", data); // Bug Tracker 3
        console.log("Total Count:", count);

        const currentCount = count || 0;
        const progressDecimal = Math.min(currentCount / targetReferrals, 1); 

        // Update UI Elements
        document.getElementById('referralCountText').innerText = `${currentCount}/${targetReferrals}`;
        document.getElementById('referralProgressBar').value = progressDecimal;

        // Trigger Success State if 10/10 is reached
        if (currentCount >= targetReferrals) {
            document.getElementById('referralProgressBar').color = "success";
            document.getElementById('referralMessage').style.display = 'none';
            document.getElementById('claimDiscountBtn').style.display = 'block';
        }

    } catch (err) {
        console.error("JavaScript Error in fetchReferralProgress:", err);
    }
}

// --- NOTIFICATION BADGE LOGIC ---
async function checkNewAlerts() {
    try {
        // Count the total number of alerts in the database
        const { count, error } = await supabaseClient.from('putme_notifications')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        if (count) {
            // Get the ID of the last alert the user viewed (defaults to 0 for new users)
            const lastSeenId = localStorage.getItem('post_utme_last_seen_alert') || 0;

            // If the total alerts in DB is higher than what they've seen, show the badge!
            if (count > lastSeenId) {
                const bellBtn = document.getElementById('alertBellBtn');
                
                // Prevent adding multiple badges if the function runs twice
                if(bellBtn && !bellBtn.innerHTML.includes('ion-badge')) {
                    bellBtn.innerHTML += `<ion-badge color="danger" style="position:absolute; top: 4px; right: 4px; border-radius: 50%; font-size: 9px; padding: 3px 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">New</ion-badge>`;
                }
            }
        }
    } catch (err) {
        console.error("Failed to load notification badge:", err);
    }
}

// --- 7. EXIT APP LOGIC (Web Swipe & Native Trap) ---

// 1. Push an initial state into the browser history when the dashboard loads
window.addEventListener('DOMContentLoaded', () => {
    history.pushState({ page: 'post-utme-dashboard' }, document.title, window.location.href);
});

// 2. Intercept the web browser back button (Swipe navigation)
window.addEventListener('popstate', function(event) {
    // Push the state back immediately so the app doesn't actually close
    history.pushState({ page: 'post-utme-dashboard' }, document.title, window.location.href);
    
    // Show the exit confirmation modal
    const exitModal = document.getElementById('exitOverlay');
    if (exitModal) {
        exitModal.style.display = 'flex';
    }
});

// 3. Trap the Native Android Back Button (For when you compile the APK)
document.addEventListener('backbutton', (e) => {
    e.preventDefault(); 
    const exitModal = document.getElementById('exitOverlay');
    if (exitModal) {
        exitModal.style.display = 'flex';
    }
}, false);

// 4. Modal Action: YES Button (Redirects to index.html)
const confirmExitBtn = document.getElementById('confirmExitBtn');
if (confirmExitBtn) {
    confirmExitBtn.addEventListener('click', () => {
        // Hide the modal
        document.getElementById('exitOverlay').style.display = 'none';
        
        // If running inside Capacitor (Android/iOS App)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            window.Capacitor.Plugins.App.exitApp();
        } else {
            // If on the web, kick them to index.html
            window.location.replace('index.html');
        }
    });
}

// --- 8. PREMIUM STATUS ENGINE (Optimistic Cache) ---
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 

async function cachePremiumStatus() {
    const userString = localStorage.getItem('post_utme_logged_in_user');
    if (!userString) return;
    const authEmail = JSON.parse(userString).email;

    try {
        // Fetch Master Switch, Sub Status, and Referral Count simultaneously
        const [settingsRes, subRes, refRes] = await Promise.all([
            supabaseClient.from('putme_settings').select('is_payment_active').maybeSingle(),
            supabaseClient.from('putme_subscriptions').select('end_date').eq('user_email', authEmail).maybeSingle(),
            supabaseClient.from('putme_referrals').select('*', { count: 'exact', head: true }).eq('referrer_email', authEmail)
        ]);

        let isSwitchActive = true; 
        let isPremium = false;
        let earnedDiscount = false;

        // 1. Check Master Switch
        if (settingsRes.data && settingsRes.data.is_payment_active !== undefined) {
            isSwitchActive = settingsRes.data.is_payment_active;
        }

        // 2. Check Subscription Expiry
        if (subRes.data && subRes.data.end_date) {
            const endDate = new Date(subRes.data.end_date);
            if (endDate > new Date()) {
                isPremium = true;
            }
        }

        // 3. Check Discount Eligibility (10+ referrals)
        if (refRes.count >= 10) {
            earnedDiscount = true;
        }

        // --- NEW: UI CLEANUP LOGIC ---
        // Hide the Activate Card AND Referral Section if the switch is off OR if they already paid!
        const activateCard = document.getElementById('activateAppCard');
        const referralSection = document.getElementById('referralSection');
        
        if (!isSwitchActive || isPremium) {
            if (activateCard) activateCard.style.display = 'none';
            if (referralSection) referralSection.style.display = 'none';
        }
       
        // -----------------------------

        // 4. Save to Local Storage for INSTANT UI checks
        const premiumData = {
            switchActive: isSwitchActive,
            isPremium: isPremium,
            discountEarned: earnedDiscount,
            lastChecked: Date.now()
        };
        
        localStorage.setItem('putme_premium_data', JSON.stringify(premiumData));

    } catch (error) {
        console.error("Failed to cache premium status:", error);
    }
}

// Call cache function silently on load
document.addEventListener('DOMContentLoaded', () => {
    cachePremiumStatus();
});

// --- MODAL & ACCESS LOGIC (With Dynamic Text) ---
window.showAccessModal = function(intent = 'locked_feature') {
    const modal = document.getElementById('premiumModal');
    const payBtn = document.getElementById('paystackBtnText');
    const modalTitle = document.getElementById('premiumModalTitle');
    const modalDesc = document.getElementById('premiumModalDesc');

    // 1. DYNAMIC TEXT: Change what the modal says based on what they clicked
    if (intent === 'direct_pay') {
        if (modalTitle) modalTitle.innerText = "Activate Scholars Prep";
        if (modalDesc) modalDesc.innerHTML = "Before proceeding with payment, make sure you read and understand our <a href='#' style='color: var(--ion-color-primary); text-decoration: underline;'>policy, terms and conditions</a>.";
    } else {
        if (modalTitle) modalTitle.innerText = "Premium Access Required";
        if (modalDesc) modalDesc.innerText = "Unlock full access to unlimited CBT Mock Exams, Question Banks, and the Nexus AI Tutor.";
    }

    // 2. STRICT PRICING: Check if they actually earned the discount
    const cached = JSON.parse(localStorage.getItem('putme_premium_data') || '{}');
    const hasDiscount = (cached && cached.discountEarned === true);
    
    if (payBtn) {
        payBtn.innerHTML = hasDiscount ? 
            `<ion-icon name="card-outline" slot="start"></ion-icon> Activate Now - ₦5,000` : 
            `<ion-icon name="card-outline" slot="start"></ion-icon> Activate Now - ₦5,500`;
    }
    
    if (modal) modal.style.display = 'flex';
}

// Check access (Only used for Nexus AI on the Dashboard)
window.checkPremiumAccess = function(targetPage) {
    const cached = JSON.parse(localStorage.getItem('putme_premium_data'));
    
    if (!cached) {
        console.log("Waiting for premium cache...");
        setTimeout(() => window.checkPremiumAccess(targetPage), 500);
        return;
    }

    if (!cached.switchActive || cached.isPremium) {
        window.location.href = targetPage;
        return;
    }
    
    // Pass 'locked_feature' so it shows the standard "Premium Access Required" text
    showAccessModal('locked_feature');
}

// --- PAYSTACK TRIGGER (Webhook Handled) ---
window.triggerPutmePaystack = function() {
    const userString = localStorage.getItem('post_utme_logged_in_user');
    if (!userString) return;
    
    // Grab BOTH email and ID from local storage
    const userObj = JSON.parse(userString);
    const userEmail = userObj.email;
    const userId = userObj.id || ''; 
    
    const cached = JSON.parse(localStorage.getItem('putme_premium_data') || '{}');
    const finalPrice = (cached && cached.discountEarned === true) ? 5000 : 5500;

    function onPaymentSuccess(response) {
        console.log("Payment Ref:", response.reference);
        const modal = document.getElementById('premiumModal');
        if (modal) modal.style.display = 'none';
        
        cached.isPremium = true;
        localStorage.setItem('putme_premium_data', JSON.stringify(cached));
        
        alert("Payment successful! Your app is fully activated."); 
    }

    // Initializing and opening Paystack safely
    const handler = PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: userEmail,
        amount: finalPrice * 100, 
        currency: 'NGN', 
        ref: 'PUTME_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: {
            user_id: userId,
            user_email: userEmail,
            plan_type: 'Pro Access' 
        },
        callback: onPaymentSuccess,
        onClose: function() {
            console.log('Payment window closed.');
        }
    });
    handler.openIframe();
}