const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let globalCourses = [];
let addedCourseCodes = []; 
const MAX_COURSES = 13;

(function protectPage() {
    if (!localStorage.getItem('abupq_logged_in_user')) window.location.replace('index.html'); 
})();

if (localStorage.getItem('sp_theme') === 'dark') document.body.classList.add('dark');

document.addEventListener('DOMContentLoaded', async () => {
    const savedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));

    try {
        // Query the new user_custom_courses table instead of profiles
        const [coursesRes, customCoursesRes] = await Promise.all([
            supabaseClient.from('ss_courses').select('*').order('code', { ascending: true }),
            supabaseClient.from('user_custom_courses').select('course_code').eq('user_id', savedUser.id)
        ]);

        if (coursesRes.error) throw coursesRes.error;

        globalCourses = coursesRes.data;
        
        // Extract just the course codes into our array
        addedCourseCodes = customCoursesRes.data ? customCoursesRes.data.map(row => row.course_code) : [];

        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('contentArea').style.display = 'block';

        renderLists();

    } catch (err) {
        console.error("Fetch Error:", err);
        alert("Failed to load data.");
    }
});

function renderLists(searchTerm = "") {
    const availableList = document.getElementById('availableList');
    const addedList = document.getElementById('addedList');
    
    availableList.innerHTML = '';
    addedList.innerHTML = '';

    document.getElementById('addedCount').innerText = `(${addedCourseCodes.length}/${MAX_COURSES})`;

    // Filter available courses
    const availableFiltered = globalCourses.filter(c => 
        !addedCourseCodes.includes(c.code) && 
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    availableFiltered.forEach(course => {
        availableList.innerHTML += `
            <ion-item class="course-item">
                <ion-icon name="${course.icon || 'book-outline'}" slot="start" color="medium"></ion-icon>
                <ion-label style="font-weight: bold;">${course.code}</ion-label>
                <ion-button id="add-btn-${course.code}" fill="clear" color="primary" slot="end" onclick="addCourse('${course.code}')">
    <ion-icon name="add" style="font-size: 24px;"></ion-icon>
</ion-button>
            </ion-item>
        `;
    });

    // Render added courses
    addedCourseCodes.forEach(code => {
        // Find icon from global
        const courseObj = globalCourses.find(c => c.code === code);
        const iconName = courseObj ? (courseObj.icon || 'book-outline') : 'book-outline';

        addedList.innerHTML += `
            <ion-item class="course-item" style="--border-color: var(--ion-color-primary);">
                <ion-icon name="${iconName}" slot="start" color="primary"></ion-icon>
                <ion-label style="font-weight: bold; color: var(--ion-color-primary);">${code}</ion-label>
                <ion-button fill="clear" color="danger" slot="end" onclick="removeCourse('${code}')">
                    <ion-icon name="close" style="font-size: 24px;"></ion-icon>
                </ion-button>
            </ion-item>
        `;
    });

    if(availableFiltered.length === 0) availableList.innerHTML = `<p style="text-align: center; color: var(--muted); font-size: 13px;">No courses found.</p>`;
    if(addedCourseCodes.length === 0) addedList.innerHTML = `<p style="text-align: center; color: var(--muted); font-size: 13px;">No courses added yet.</p>`;
}

window.addCourse = function(code) {
    if (addedCourseCodes.length >= MAX_COURSES) {
        alert("You have reached the maximum limit of 13 courses.");
        return;
    }
    
    // 1. Target the button and swap the '+' icon for a green spinner
    const btn = document.getElementById(`add-btn-${code}`);
    if (btn) {
        btn.innerHTML = `<ion-spinner name="crescent" color="primary" style="width: 24px; height: 24px;"></ion-spinner>`;
    }

    // 2. Add a slight delay (500ms) so the user actually sees the loading animation
    setTimeout(() => {
        addedCourseCodes.push(code);
        renderLists(document.getElementById('searchBar').value);
        showToast(`${code} added`);
    }, 500);
}

window.removeCourse = function(code) {
    addedCourseCodes = addedCourseCodes.filter(c => c !== code);
    renderLists(document.getElementById('searchBar').value);
}

document.getElementById('searchBar').addEventListener('input', (e) => {
    renderLists(e.target.value);
});

window.saveCoursesAndExit = async function() {
    const savedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('contentArea').style.display = 'none';

    try {
        // 1. Wipe the user's old saved courses from the table to prevent duplicates
        await supabaseClient.from('user_custom_courses').delete().eq('user_id', savedUser.id);

        // 2. If they have courses selected, insert them all as new rows
        if (addedCourseCodes.length > 0) {
            const insertData = addedCourseCodes.map(code => ({
                user_id: savedUser.id,
                course_code: code
            }));
            
            const { error } = await supabaseClient.from('user_custom_courses').insert(insertData);
            if (error) throw error;
        }

        window.location.replace('dashboard.html');
    } catch (err) {
        console.error("Save Error", err);
        alert("Failed to save your courses.");
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('contentArea').style.display = 'block';
    }
}
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.opacity = '1';
    
    // Disappear after 3 seconds
    setTimeout(() => { 
        toast.style.opacity = '0'; 
    }, 3000);
}