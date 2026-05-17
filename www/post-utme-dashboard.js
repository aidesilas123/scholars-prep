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

// --- 5. LOGOUT LOGIC (Red Destructive Action) ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('logoutBtn').addEventListener('click', async () => {
    // 1. Log out of Supabase to kill backend session
    await supabaseClient.auth.signOut();
    
    // 2. Clear local storage
    localStorage.removeItem('post_utme_logged_in_user');
    
    // 3. Redirect
    window.location.replace('post-utme-login.html');
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