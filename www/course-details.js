// --- 1. CORE CONFIG ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Extract Course Code from URL (e.g., ?course=GENS102)
const urlParams = new URLSearchParams(window.location.search);
const currentCourseCode = urlParams.get('course');

// Variables to hold data
let currentCourseData = null;

// Ensure user is logged in & course code exists
(function protectPage() {
    const savedUser = localStorage.getItem('abupq_logged_in_user');
    if (!savedUser) window.location.replace('index.html'); 
    
    // If somehow a user reaches this page without a course code, kick them back
    if (!currentCourseCode) window.location.replace('dashboard.html');
})();

// --- HARDWARE & ON-SCREEN NAVIGATION---
window.goBackToDashboard = function() {
    window.location.replace('dashboard.html');
};

// Push state to intercept hardware back button
window.addEventListener('DOMContentLoaded', () => {
    history.pushState({ page: 'course-details' }, document.title, window.location.href);
});

window.addEventListener('popstate', function(event) {
    // When Android back button or browser back is clicked
    window.location.replace('dashboard.html');
});

document.addEventListener('backbutton', (e) => {
    e.preventDefault();
    window.location.replace('dashboard.html');
}, false);

// --- 2. THE MASTER BOOTLOADER ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Force Skeleton ON
    document.getElementById('skeleton-ui').style.display = 'block';
    document.getElementById('real-ui').style.display = 'none';

    // 2. Fetch Data Simultaneously
    await Promise.all([
        fetchCourseInfo(),
        fetchAvailableYears(),
        fetchRelatedCourses()
    ]);

    // 3. Minimum delay to allow the loading skeleton to shine, preventing glitches
    setTimeout(() => {
        document.getElementById('skeleton-ui').style.display = 'none';
        
        const realUI = document.getElementById('real-ui');
        realUI.style.display = 'block';
        realUI.style.opacity = '0';
        realUI.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { realUI.style.opacity = '1'; }, 50);
    }, 800); 
});

// --- 3. DATA FETCHING LOGIC ---

async function fetchCourseInfo() {
    try {
        const { data, error } = await supabaseClient
            .from('ss_courses')
            .select('*')
            .eq('code', currentCourseCode)
            .single();

        if (error || !data) throw error;
        
        currentCourseData = data;

        // Update the Mini Course Card UI
        document.getElementById('courseCodeText').innerText = data.code;
        if (data.icon) document.getElementById('courseIcon').setAttribute('name', data.icon);

    } catch (err) {
        console.error("Course fetch error:", err);
        document.getElementById('courseCodeText').innerText = currentCourseCode;
    }
}

async function fetchAvailableYears() {
    try {
        const [testRes, examRes] = await Promise.all([
            supabaseClient.from('ss_test_questions').select('year').eq('course_code', currentCourseCode),
            supabaseClient.from('ss_exam_questions').select('year').eq('course_code', currentCourseCode)
        ]);

        const allYears = new Set();
        if (testRes.data) testRes.data.forEach(q => allYears.add(q.year));
        if (examRes.data) examRes.data.forEach(q => allYears.add(q.year));

        const yearDropdown = document.getElementById('yearSelect');
        yearDropdown.innerHTML = '';

        if (allYears.size === 0) {
            yearDropdown.placeholder = "No Questions Yet";
            yearDropdown.disabled = true;
            document.getElementById('typeSelect').disabled = true;
        } else {
            yearDropdown.placeholder = "Select Year";
            const sortedYears = Array.from(allYears).sort((a, b) => b - a);
            
            
            sortedYears.forEach(year => {
                yearDropdown.innerHTML += `<ion-select-option value="${year}">${year}</ion-select-option>`;
            });
            
            // Automatically select the most recent year
            yearDropdown.value = sortedYears[0];
        }
    } catch (err) {
        console.error("Year fetch error:", err);
    }
}

async function fetchRelatedCourses() {
    const grid = document.getElementById('relatedGridContainer');
    
    try {
        // Extract the alphabetic prefix (e.g., "GENS" from "GENS102")
        const prefixMatch = currentCourseCode.match(/[a-zA-Z]+/);
        if (!prefixMatch) throw new Error("Invalid course code format");
        
        const prefix = prefixMatch[0];

        // Fetch courses starting with that prefix, excluding the current one
        const { data: related, error } = await supabaseClient
            .from('ss_courses')
            .select('*')
            .ilike('code', `${prefix}%`)
            .neq('code', currentCourseCode)
            .limit(6); // Limit to 6 so it doesn't clutter

        if (error) throw error;

        grid.innerHTML = '';

        if (!related || related.length === 0) {
            grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--muted); font-size: 13px;">No related courses found.</p>`;
            return;
        }

        related.forEach(course => {
            const card = document.createElement('div');
            card.className = 'course-card';
            // Notice: Clicking this reloads the exact same page with the NEW course code in the URL
            card.onclick = () => window.location.href = `course-details.html?course=${course.code}`;
            
            const iconName = course.icon || 'book-outline';

            card.innerHTML = `
                <ion-icon name="${iconName}"></ion-icon>
                <span>${course.code}</span>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error("Related courses fetch error:", err);
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--muted); font-size: 13px;">Unable to load related courses.</p>`;
    }
}

// --- 4. THE FAST PASS ROUTER ---
window.launchFastPass = function(destination) {
    const year = document.getElementById('yearSelect').value;
    const type = document.getElementById('typeSelect').value;

    if (!year) {
        alert("No questions are currently available for this course.");
        return;
    }

    showLoading('Loading...');

    setTimeout(() => {
        // Construct the URLs with the query parameters and the autoStart trigger
        if (destination === 'cbt') {
            window.location.href = `cbt.html?course=${currentCourseCode}&year=${year}&type=${type}&autoStart=true`;
        } 
        else if (destination === 'pastquestions') {
            window.location.href = `pastquestions.html?course=${currentCourseCode}&year=${year}&type=${type}&autoStart=true`;
        } 
        else if (destination === 'report') {
            // Report doesn't need autoStart, it just needs the context
            window.location.href = `report.html?course=${currentCourseCode}&year=${year}&type=${type}`;
        }
    }, 500);
}

// --- 5. THEME INHERITANCE LOGIC ---
// Ensure the page respects the user's dashboard theme preference immediately
if (localStorage.getItem('sp_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-color-meta').setAttribute('content', '#121212');
}

// --- UTILITY ---
function showLoading(text) {
    const loader = document.getElementById('globalLoading');
    document.getElementById('loadingText').innerText = text;
    if (loader) loader.style.display = 'flex';
}