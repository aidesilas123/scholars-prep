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