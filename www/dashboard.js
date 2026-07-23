// --- 1. CORE CONFIG & AUTH GUARD ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let globalCourses = []; 
let userSavedCourses = [];
let isJiggling = false; // Tracks if we are in delete mode
let longPressTimer;

(function protectPage() {
    const savedUser = localStorage.getItem('abupq_logged_in_user');
    if (!savedUser) window.location.replace('index.html'); 
    else {
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

// --- 3. DYNAMIC COURSE FETCHING (Split Dashboard) ---
async function fetchAndRenderCourses() {
    const savedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    
    try {
        // Look at the new table for the user's custom dashboard
        const [coursesRes, customCoursesRes] = await Promise.all([
            supabaseClient.from('ss_courses').select('*').order('code', { ascending: true }),
            supabaseClient.from('user_custom_courses').select('course_code').eq('user_id', savedUser.id)
        ]);

        if (coursesRes.error) throw coursesRes.error;

        globalCourses = coursesRes.data;
        userSavedCourses = customCoursesRes.data ? customCoursesRes.data.map(row => row.course_code) : [];

        renderCourseGrids(globalCourses);

    } catch (error) {
        console.error("Error fetching courses:", error);
        showGenericModal('Error', 'Failed to load courses. Please check your connection.', true);
    } 
}

function renderCourseGrids(courseArray) {
    const myGrid = document.getElementById('myCoursesGridContainer');
    const availableGrid = document.getElementById('availableCoursesGridContainer');
    
    myGrid.innerHTML = '';
    availableGrid.innerHTML = '';

    const myCoursesData = [];
    const availableCoursesData = [];

    // Split the global list based on what the user has saved
    courseArray.forEach(course => {
        if (userSavedCourses.includes(course.code)) {
            myCoursesData.push(course);
        } else {
            availableCoursesData.push(course);
        }
    });

    // --- UI TOGGLES BASED ON SAVED COURSES ---
    const customizeBox = document.getElementById('customizeBox');
    const myCoursesWrapper = document.getElementById('myCoursesWrapper');
    const addHeaderBtn = document.getElementById('addCourseHeaderBtn');
    const countText = document.getElementById('courseCountText');

    if (userSavedCourses.length === 0) {
        customizeBox.style.display = 'flex';
        myCoursesWrapper.style.display = 'none';
        addHeaderBtn.style.display = 'none';
    } else {
        customizeBox.style.display = 'none';
        myCoursesWrapper.style.display = 'block';
        countText.innerText = `${userSavedCourses.length}/13`;
        // Show + button if they have less than 13
        addHeaderBtn.style.display = userSavedCourses.length < 13 ? 'block' : 'none';
        
        myCoursesData.forEach(course => myGrid.appendChild(createCourseCard(course, true)));
    }

    // Render remaining
    if (availableCoursesData.length > 0) {
        availableCoursesData.forEach(course => availableGrid.appendChild(createCourseCard(course, false)));
    } else {
        availableGrid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--muted); font-size: 13px;">No other courses available.</p>`;
    }
}


function createCourseCard(course, isMyCourse) {
    const card = document.createElement('div');
    card.className = 'course-card';
    const iconName = course.icon || 'book-outline';

    card.innerHTML = `
        <div class="delete-badge" onclick="event.stopPropagation(); removeCourse('${course.code}')">
            <ion-icon name="close"></ion-icon>
        </div>
        <ion-icon name="${iconName}"></ion-icon>
        <span>${course.code}</span>
    `;

    if (isMyCourse) {
        card.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => triggerJiggleMode(), 500);
        });
        card.addEventListener('touchend', () => clearTimeout(longPressTimer));
        card.addEventListener('touchmove', () => clearTimeout(longPressTimer));

        card.onclick = (event) => {
            event.stopPropagation();
            if (!isJiggling) {
                // FIX: Route using ID instead of course code
                window.location.href = `course-details.html?id=${course.id}`;
            }
        };
    } else {
        // FIX: Route using ID instead of course code
        card.onclick = () => window.location.href = `course-details.html?id=${course.id}`;
    }

    return card;
}
// --- JIGGLE ENGINE (Delete Mode) ---
function triggerJiggleMode() {
    isJiggling = true;
    navigator.vibrate(100); // Small haptic feedback if supported
    document.querySelectorAll('.course-card').forEach(card => card.classList.add('jiggling'));
}

window.cancelJiggleMode = function() {
    if (!isJiggling) return;
    isJiggling = false;
    document.querySelectorAll('.course-card').forEach(card => card.classList.remove('jiggling'));
}

window.removeCourse = async function(courseCode) {
    showLoading('Removing...');
    const savedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    
    try {
        // Delete the specific course from the new table
        const { error } = await supabaseClient.from('user_custom_courses')
            .delete()
            .eq('user_id', savedUser.id)
            .eq('course_code', courseCode);
            
        if (error) throw error;

        // Update UI Array and re-render
        userSavedCourses = userSavedCourses.filter(c => c !== courseCode);
        renderCourseGrids(globalCourses);
        hideLoading();
        
    } catch (err) {
        console.error(err);
        hideLoading();
        showGenericModal('Error', 'Failed to remove course.', true);
    }
}

// Search Logic
document.getElementById('courseSearch')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = globalCourses.filter(c => c.code && c.code.toLowerCase().includes(term));
    renderCourseGrids(filtered);
});

// --- 4. MODALS & PAYSTACK ---
window.checkPremiumAccess = function(targetPage) {
    if (!isSwitchActive || isPremium) {
        window.location.href = targetPage;
        return;
    }
    document.getElementById('accessModal').style.display = 'flex';
};

// --- PAYSTACK INTEGRATION ---
window.triggerPaystack = function() {
    document.getElementById('accessModal').style.display = 'none';
    const userString = localStorage.getItem('abupq_logged_in_user');
    if (!userString) return;
    const user = JSON.parse(userString);
    
    PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: user.email,
        amount: 2500 * 100, 
        currency: 'NGN', 
        ref: 'SP_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: { 
            user_id: user.id, 
            email: user.email,
            plan_type: 'semester' // Added for the webhook
        },
        callback: function(response) {
            showLoading('Verifying payment securely...');
            
            // Wait 3 seconds for the Webhook to update the DB
            setTimeout(() => {
                hideLoading();
                showGenericModal("Success", "Payment successful! Your app is fully activated."); 
                setTimeout(() => window.location.reload(), 2000);
            }, 3000);
        },
        onClose: function() { console.log('Payment window closed.'); }
    }).openIframe();
};

window.showGenericModal = function(title, message, isError = false) {
    document.getElementById('genericModalTitle').innerText = title;
    document.getElementById('genericModalMessage').innerText = message;
    const icon = document.getElementById('genericModalIcon');
    icon.setAttribute('name', isError ? 'warning-outline' : 'checkmark-circle-outline');
    icon.setAttribute('color', isError ? 'danger' : 'primary');
    document.getElementById('genericModal').style.display = 'flex';
};

// ... (Utility functions for loading and logout remain the same) ...
function showLoading(text = 'Processing...') { const loader = document.getElementById('globalLoading'); document.getElementById('loadingText').innerText = text; if (loader) loader.style.display = 'flex'; }
function hideLoading() { return new Promise((resolve) => { const loader = document.getElementById('globalLoading'); if (loader) { loader.style.display = 'none'; requestAnimationFrame(() => requestAnimationFrame(() => resolve())); } else resolve(); }); }
window.openLogoutModal = function() { document.getElementById('logoutModal').style.display = 'flex'; };
window.confirmLogout = async function() { document.getElementById('logoutModal').style.display = 'none'; showLoading('Signing out...'); await supabaseClient.auth.signOut(); localStorage.removeItem('abupq_logged_in_user'); window.location.replace('index.html'); };

// Slider
function startCarousel() {
    const track = document.getElementById('sliderTrack');
    if(!track) return;
    setInterval(() => {
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) track.scrollTo({ left: 0, behavior: 'smooth' });
        else track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
    }, 5000); 
}

document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const htmlElement = document.documentElement;
    htmlElement.classList.toggle('dark');
    document.body.classList.toggle('dark');
    const isDark = htmlElement.classList.contains('dark');
    localStorage.setItem('sp_theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-color-meta').setAttribute('content', isDark ? '#121212' : '#f8fafc');
});

// Hardware traps
document.addEventListener('backbutton', (e) => {
    const modals = ['accessModal', 'logoutModal', 'genericModal', 'exitModal'];
    let modalClosed = false;
    modals.forEach(id => {
        const m = document.getElementById(id);
        if (m && m.style.display === 'flex') { m.style.display = 'none'; modalClosed = true; }
    });
    if (!modalClosed) document.getElementById('exitModal').style.display = 'flex';
}, false);

window.confirmExitApp = function() {
    if (navigator.app) navigator.app.exitApp();
    else if (navigator.device) navigator.device.exitApp();
    else window.close();
};

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('skeleton-ui').style.display = 'block';
    document.getElementById('real-ui').style.display = 'none';

    await Promise.all([ checkAppStatus(), fetchAndRenderCourses() ]);

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
// --- NOTIFICATION BADGE ENGINE ---
async function updateNotificationBadge() {
    const lastSeenId = parseInt(localStorage.getItem('abupq_last_seen_alert') || '0', 10);
    try {
        const { count, error } = await supabaseClient
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .gt('id', lastSeenId); 

        if (error) throw error;

        const badge = document.getElementById('notifBadge');
        if (badge) {
            if (count && count > 0) {
                badge.innerText = count > 9 ? '9+' : count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error("Failed to load notification badge count:", err);
    }
}

// --- MAIN INITIALIZATION (Consolidated) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Show skeleton UI initially
    document.getElementById('skeleton-ui').style.display = 'block';
    document.getElementById('real-ui').style.display = 'none';

    // 2. Fetch all initial data concurrently
    await Promise.all([ 
        checkAppStatus(), 
        fetchAndRenderCourses(),
        updateNotificationBadge() // Moved this here!
    ]);

    // 3. Transition to real UI
    setTimeout(() => {
        document.getElementById('skeleton-ui').style.display = 'none';
        const realUI = document.getElementById('real-ui');
        realUI.style.display = 'block';
        realUI.style.opacity = '0';
        realUI.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { realUI.style.opacity = '1'; }, 50);
        
        startCarousel(); 
    }, 1200); 

    // 4. Attach Pull-to-Refresh Logic
    const refresher = document.getElementById('dashboard-refresher');
    if (refresher) {
        refresher.addEventListener('ionRefresh', async (event) => {
            try {
                // Re-fetch all necessary dashboard data silently in the background
                await Promise.all([
                    checkAppStatus(),
                    fetchAndRenderCourses(),
                    updateNotificationBadge()
                ]);
            } catch (error) {
                console.error("Dashboard refresh failed:", error);
            } finally {
                // This required method tells the UI to hide the spinner once data is loaded
                event.detail.complete();
            }
        });
    }
});