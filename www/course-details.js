// --- 1. CORE CONFIG ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Extract Course ID from URL (e.g., ?id=28)
const urlParams = new URLSearchParams(window.location.search);
const currentCourseId = urlParams.get('id');

// Variables to hold data
let currentCourseData = null;

// Ensure user is logged in & course ID exists
(function protectPage() {
    const savedUser = localStorage.getItem('abupq_logged_in_user');
    if (!savedUser) window.location.replace('index.html'); 
    
    if (!currentCourseId) window.location.replace('dashboard.html');
})();

// --- HARDWARE & ON-SCREEN NAVIGATION---
window.goBackToDashboard = function() {
    window.location.replace('dashboard.html');
};

window.addEventListener('DOMContentLoaded', () => {
    history.pushState({ page: 'course-details' }, document.title, window.location.href);
});

window.addEventListener('popstate', function(event) {
    window.location.replace('dashboard.html');
});

document.addEventListener('backbutton', (e) => {
    e.preventDefault();
    window.location.replace('dashboard.html');
}, false);

// --- 2. THE MASTER BOOTLOADER WITH RETRY LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    initializePageData();
});

async function initializePageData() {
    // Force Skeleton ON, hide real UI and any existing modals
    document.getElementById('skeleton-ui').style.display = 'block';
    document.getElementById('real-ui').style.display = 'none';
    hideRetryModal();

    try {
        // 1. Fetch Course Info FIRST. We need the course text code to find "Related Courses"
        await fetchCourseInfo();

        // 2. Fetch the rest simultaneously now that we have the main course data
        await Promise.all([
            fetchAvailableYears(),
            fetchRelatedCourses()
        ]);

        // 3. Success! Reveal UI
        setTimeout(() => {
            document.getElementById('skeleton-ui').style.display = 'none';
            const realUI = document.getElementById('real-ui');
            realUI.style.display = 'block';
            realUI.style.opacity = '0';
            realUI.style.transition = 'opacity 0.4s ease';
            setTimeout(() => { realUI.style.opacity = '1'; }, 50);
        }, 800); 

    } catch (error) {
        console.error("Network or fetch error:", error);
        // If anything fails, show the retry modal
        showRetryModal(initializePageData);
    }
}

// --- 3. DATA FETCHING LOGIC ---
async function fetchCourseInfo() {
    const { data, error } = await supabaseClient
        .from('ss_courses')
        .select('*')
        .eq('id', currentCourseId) // Now querying by ID
        .single();

    if (error || !data) throw new Error("Failed to fetch course details");
    
    currentCourseData = data;

    document.getElementById('courseCodeText').innerText = data.code;
    if (data.icon) document.getElementById('courseIcon').setAttribute('name', data.icon);
}

async function fetchAvailableYears() {
    // Fetching ss_test_questions using the exact table name and course_id
    const [testRes, examRes] = await Promise.all([
        supabaseClient.from('ss_test_questions').select('year').eq('course_id', currentCourseId),
        supabaseClient.from('ss_exam_questions').select('year').eq('course_id', currentCourseId)
    ]);

    if (testRes.error) throw testRes.error;
    if (examRes.error) throw examRes.error;

    const allYears = new Set();
    if (testRes.data) testRes.data.forEach(q => allYears.add(q.year));
    if (examRes.data) examRes.data.forEach(q => allYears.add(q.year));

    const yearDropdown = document.getElementById('yearSelect');
    const typeDropdown = document.getElementById('typeSelect');
    yearDropdown.innerHTML = '';

    if (allYears.size === 0) {
        yearDropdown.placeholder = "No Questions Yet";
        yearDropdown.disabled = true;
        if(typeDropdown) typeDropdown.disabled = true;
    } else {
        yearDropdown.placeholder = "Select Year";
        const sortedYears = Array.from(allYears).sort((a, b) => b - a);
        
        sortedYears.forEach(year => {
            yearDropdown.innerHTML += `<ion-select-option value="${year}">${year}</ion-select-option>`;
        });
        
        // Restore last selected using the ID
        const savedYear = localStorage.getItem(`sp_last_year_${currentCourseId}`);
        const savedType = localStorage.getItem(`sp_last_type_${currentCourseId}`);

        if (savedYear && sortedYears.includes(Number(savedYear))) {
            yearDropdown.value = savedYear;
        } else {
            yearDropdown.value = sortedYears[0];
        }

        if (savedType && typeDropdown) {
            typeDropdown.value = savedType;
        }
    }
}

async function fetchRelatedCourses() {
    const grid = document.getElementById('relatedGridContainer');
    
    // Extract prefix from the code we fetched in fetchCourseInfo (e.g., "GENS" from "GENS102")
    const prefixMatch = currentCourseData.code.match(/[a-zA-Z]+/);
    if (!prefixMatch) return; 
    
    const prefix = prefixMatch[0];

    const { data: related, error } = await supabaseClient
        .from('ss_courses')
        .select('*')
        .ilike('code', `${prefix}%`)
        .neq('id', currentCourseId) // Exclude current using ID
        .limit(6); 

    if (error) throw error;

    grid.innerHTML = '';

    if (!related || related.length === 0) {
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--muted); font-size: 13px;">No related courses found.</p>`;
        return;
    }

    related.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        // Route to the new course using its ID
        card.onclick = () => window.location.href = `course-details.html?id=${course.id}`;
        
        const iconName = course.icon || 'book-outline';

        card.innerHTML = `
            <ion-icon name="${iconName}"></ion-icon>
            <span>${course.code}</span>
        `;
        grid.appendChild(card);
    });
}

// --- 4. THE FAST PASS ROUTER ---
window.launchFastPass = function(destination) {
    const year = document.getElementById('yearSelect').value;
    const typeDropdown = document.getElementById('typeSelect');
    const type = typeDropdown ? typeDropdown.value : null;

    if (!year) {
        showCustomAlert("No questions are currently available for this course.");
        return;
    }

    localStorage.setItem(`sp_last_year_${currentCourseId}`, year);
    if (type) localStorage.setItem(`sp_last_type_${currentCourseId}`, type);

    showLoading('Loading...');

    setTimeout(() => {
        // Passing the course ID instead of the string code to the study pages
        if (destination === 'cbt') {
            window.location.href = `cbt.html?id=${currentCourseId}&year=${year}&type=${type}&autoStart=true`;
        } 
        else if (destination === 'pastquestions') {
            window.location.href = `pastquestions.html?id=${currentCourseId}&year=${year}&type=${type}&autoStart=true`;
        } 
        else if (destination === 'report') {
            window.location.href = `report.html?id=${currentCourseId}&year=${year}&type=${type}`;
        }
    }, 500);
}

// --- 5. THEME INHERITANCE LOGIC ---
if (localStorage.getItem('sp_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-color-meta')?.setAttribute('content', '#121212');
}

// --- UTILITY MODALS ---
function showLoading(text) {
    const loader = document.getElementById('globalLoading');
    const textEl = document.getElementById('loadingText');
    if (textEl) textEl.innerText = text;
    if (loader) loader.style.display = 'flex';
}

function showCustomAlert(message) {
    let alertModal = document.getElementById('customAlertModal');
    if (!alertModal) {
        alertModal = document.createElement('div');
        alertModal.id = 'customAlertModal';
        alertModal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
                <div style="background: var(--bg-color, #fff); padding: 24px; border-radius: 12px; max-width: 320px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                    <p id="customAlertMessage" style="margin: 0 0 20px 0; color: var(--text-color, #333); font-size: 16px; font-weight: 500;"></p>
                    <button onclick="document.getElementById('customAlertModal').style.display='none'" style="background: var(--primary-color, #3880ff); color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 15px; font-weight: bold; width: 100%; cursor: pointer;">Got it</button>
                </div>
            </div>
        `;
        document.body.appendChild(alertModal);
    }
    document.getElementById('customAlertMessage').innerText = message;
    alertModal.style.display = 'block';
}

// THE NEW RETRY MODAL
function showRetryModal(retryCallback) {
    let retryModal = document.getElementById('networkRetryModal');
    if (!retryModal) {
        retryModal = document.createElement('div');
        retryModal.id = 'networkRetryModal';
        retryModal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
                <div style="background: var(--bg-color, #fff); padding: 24px; border-radius: 12px; max-width: 320px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                    <ion-icon name="wifi-outline" style="font-size: 48px; color: var(--muted, #888); margin-bottom: 10px;"></ion-icon>
                    <h3 style="margin: 0 0 10px 0; color: var(--text-color, #333);">Connection Failed</h3>
                    <p style="margin: 0 0 20px 0; color: var(--muted, #666); font-size: 14px;">We couldn't connect to the server. Please check your internet connection.</p>
                    <button id="retryButtonAction" style="background: var(--primary-color, #3880ff); color: #fff; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: bold; width: 100%; cursor: pointer;">Try Again</button>
                </div>
            </div>
        `;
        document.body.appendChild(retryModal);
    }
    
    // Attach the retry callback directly to the button
    document.getElementById('retryButtonAction').onclick = retryCallback;
    retryModal.style.display = 'block';
}

function hideRetryModal() {
    const retryModal = document.getElementById('networkRetryModal');
    if (retryModal) retryModal.style.display = 'none';
}