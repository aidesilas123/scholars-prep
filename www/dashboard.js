// --- 1. CORE CONFIG & AUTH GUARD ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let globalCourses = []; 

(function protectPage() {
    const savedUser = localStorage.getItem('abupq_logged_in_user');
    if (!savedUser) {
        window.location.replace('index.html'); 
    } else {
        const user = JSON.parse(savedUser);
        const nameDisplay = document.getElementById('candidateName');
        if(nameDisplay && user.name) nameDisplay.textContent = user.name.split(' ')[0];
    }
})();

// --- 2. PREMIUM CACHING LOGIC ---
let isPremium = false;
let isSwitchActive = true;

async function checkAppStatus() {
    const savedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    try {
        const [settingsRes, subRes] = await Promise.all([
            supabaseClient.from('app_settings').select('payment_active').single(),
            supabaseClient.from('profiles').select('subscription_end').eq('id', savedUser.id).maybeSingle()
        ]);

        if (settingsRes.data) isSwitchActive = settingsRes.data.payment_active;
        
        if (subRes.data && subRes.data.subscription_end) {
            const endDate = new Date(subRes.data.subscription_end);
            if (endDate > new Date()) isPremium = true;
        }

        // Hide "Activate App" card if switch is OFF or if user has paid
        const activateCard = document.getElementById('activateAppCard');
        if (activateCard && (!isSwitchActive || isPremium)) {
            activateCard.style.display = 'none';
        }

    } catch (err) {
        console.error("Status Check Error", err);
    }
}

// --- 3. DYNAMIC COURSE FETCHING (ss_courses only) ---
async function fetchAndRenderCourses() {
    const grid = document.getElementById('courseGridContainer');
    
    try {
        const { data: courses, error: cError } = await supabaseClient
            .from('ss_courses')
            .select('*')
            .order('code', { ascending: true });

        if (cError) throw cError;

        globalCourses = courses;
        renderCourseGrid(globalCourses);

    } catch (error) {
        console.error("Error fetching courses:", error);
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--muted); font-size: 14px;">No courses available.</p>`;
        showGenericModal('Error', 'Failed to load courses. Please check your connection.', true);
    } 
}

function renderCourseGrid(courseArray) {
    const grid = document.getElementById('courseGridContainer');
    grid.innerHTML = '';

    if(!courseArray || courseArray.length === 0) {
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--muted); font-size: 14px;">No courses available.</p>`;
        return;
    }

    courseArray.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        card.onclick = () => window.location.href = `course-details.html?course=${course.code}`;
        
        const iconName = course.icon || 'book-outline';

        card.innerHTML = `
            <ion-icon name="${iconName}"></ion-icon>
            <span>${course.code}</span>
        `;
        grid.appendChild(card);
    });
}

// Attach Search Bar Listener
document.getElementById('courseSearch')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = globalCourses.filter(c => 
        c.code && c.code.toLowerCase().includes(term)
    );
    renderCourseGrid(filtered);
});

// --- 4. CAROUSEL AUTO-SCROLLER ---
function startCarousel() {
    const track = document.getElementById('sliderTrack');
    if(!track) return;

    setInterval(() => {
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
            track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
        }
    }, 5000); 
}

// --- 5. PREMIUM ACCESS GATEWAY & MODALS ---

// Generic clean modal for alerts and errors
window.showGenericModal = function(title, message, isError = false) {
    document.getElementById('genericModalTitle').innerText = title;
    document.getElementById('genericModalMessage').innerText = message;
    
    const icon = document.getElementById('genericModalIcon');
    icon.setAttribute('name', isError ? 'warning-outline' : 'checkmark-circle-outline');
    icon.setAttribute('color', isError ? 'danger' : 'primary');
    
    document.getElementById('genericModal').style.display = 'flex';
};

// Directly bypass modal and open Paystack for specific tabs (like Nexus chat)
window.checkPremiumAccessDirect = function(targetPage) {
    if (!isSwitchActive || isPremium) {
        window.location.href = targetPage;
        return;
    }
    triggerPaystack();
};

window.triggerPaystack = function() {
    const user = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    
    const handler = PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: user.email,
        amount: 2500 * 100, 
        currency: 'NGN', 
        ref: 'SP_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: {
            user_id: user.id,
            email: user.email
        },
        callback: function(response) {
            showLoading('Activating Account...');
            supabaseClient.from('profiles').upsert({ 
                id: user.id, 
                subscription_end: '2026-12-31' 
            }).then(() => {
                hideLoading();
                showGenericModal("Success", "Payment successful! Your app is fully activated."); 
                setTimeout(() => window.location.reload(), 2000);
            });
        },
        onClose: function() { }
    });
    handler.openIframe();
};

// --- 6. UTILITIES & INIT ---
function showLoading(text = 'Processing...') {
    const loader = document.getElementById('globalLoading');
    document.getElementById('loadingText').innerText = text;
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    return new Promise((resolve) => {
        const loader = document.getElementById('globalLoading');
        if (loader) {
            loader.style.display = 'none';
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        } else resolve();
    });
}

window.openLogoutModal = function() { document.getElementById('logoutModal').style.display = 'flex'; };

window.confirmLogout = async function() {
    document.getElementById('logoutModal').style.display = 'none';
    showLoading('Signing out...');
    await supabaseClient.auth.signOut();
    localStorage.removeItem('abupq_logged_in_user');
    window.location.replace('index.html');
};

// THEME TOGGLE (Syncs Status Bar Theme Color)
document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const htmlElement = document.documentElement;
    htmlElement.classList.toggle('dark');
    document.body.classList.toggle('dark'); // Toggle body for consistency
    
    const isDark = htmlElement.classList.contains('dark');
    localStorage.setItem('sp_theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-color-meta').setAttribute('content', isDark ? '#121212' : '#f8fafc');
});

// BOOTSTRAP APP
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Force Skeleton ON and Real UI OFF
    document.getElementById('skeleton-ui').style.display = 'block';
    document.getElementById('real-ui').style.display = 'none';

    // 2. Run Supabase & Paystack checks simultaneously
    await Promise.all([
        checkAppStatus(),
        fetchAndRenderCourses()
    ]);

    // 3. Force a delay to let the loading state be visible before showing the UI
    setTimeout(() => {
        document.getElementById('skeleton-ui').style.display = 'none';
        
        const realUI = document.getElementById('real-ui');
        realUI.style.display = 'block';
        
        realUI.style.opacity = '0';
        realUI.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { realUI.style.opacity = '1'; }, 50);

        startCarousel(); 
    }, 1200); 
});
// --- HARDWARE EXIT BTN---
document.addEventListener('backbutton', (e) => {
    // Check if any other modal is open; if so, close it instead of asking to exit
    const accessModal = document.getElementById('accessModal');
    const logoutModal = document.getElementById('logoutModal');
    const genericModal = document.getElementById('genericModal');
    
    if (accessModal.style.display === 'flex') {
        accessModal.style.display = 'none';
        return;
    }
    if (logoutModal.style.display === 'flex') {
        logoutModal.style.display = 'none';
        return;
    }
    if (genericModal.style.display === 'flex') {
        genericModal.style.display = 'none';
        return;
    }

    // If no modals are open, show the exit confirmation
    document.getElementById('exitModal').style.display = 'flex';
}, false);

window.confirmExitApp = function() {
    // This is the standard Capacitor/Cordova command to cleanly kill the application
    if (navigator.app) {
        navigator.app.exitApp();
    } else if (navigator.device) {
        navigator.device.exitApp();
    } else {
        window.close();
    }
};