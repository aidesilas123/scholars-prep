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
    // Show Skeleton UI initially
    document.getElementById('skeleton-ui').style.display = 'block';
    document.getElementById('real-ui').style.display = 'none';
    
    const grid = document.getElementById('courseGridContainer');
    
    try {
        const { data: courses, error: cError } = await supabaseClient
            .from('ss_courses')
            .select('*')
            .order('code', { ascending: true }); // Using 'code' as requested

        if (cError) throw cError;

        globalCourses = courses;
        renderCourseGrid(globalCourses);

    } catch (error) {
        console.error("Error fetching courses:", error);
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: red;">Failed to load courses.</p>`;
    } finally {
        // Hide Skeleton, Show Real UI
        document.getElementById('skeleton-ui').style.display = 'none';
        document.getElementById('real-ui').style.display = 'block';
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
        card.onclick = () => window.location.href = `cbt.html?course=${course.id}`;
        
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
window.showAccessModal = function(intent = 'locked_feature') {
    document.getElementById('accessModal').style.display = 'flex';
};

window.checkPremiumAccess = function(targetPage) {
    if (!isSwitchActive || isPremium) {
        window.location.href = targetPage;
        return;
    }
    window.showAccessModal();
};

window.triggerPaystack = function() {
    document.getElementById('accessModal').style.display = 'none';
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
                alert("Payment successful! Your app is fully activated."); 
                window.location.reload();
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
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('sp_theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-color-meta').setAttribute('content', isDark ? '#121212' : '#f8fafc');
});

// INITIAL THEME LOAD
if (localStorage.getItem('sp_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-color-meta').setAttribute('content', '#121212');
}

// BOOTSTRAP APP
document.addEventListener('DOMContentLoaded', () => {
    checkAppStatus();
    fetchAndRenderCourses();
    setTimeout(startCarousel, 1000); 
});