// --- 1. CORE CONFIG & AUTH GUARD ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(function protectPage() {
    if (!localStorage.getItem('abupq_logged_in_user')) window.location.replace('index.html'); 
})();

if (localStorage.getItem('sp_theme') === 'dark') document.body.classList.add('dark');

// URL Params for Fast Pass Pre-filling
const urlParams = new URLSearchParams(window.location.search);
const fpCourse = urlParams.get('course');
const fpYear = urlParams.get('year');
const fpType = urlParams.get('type') || 'exam';
const fpAutoStart = urlParams.get('autoStart');

let isFastPass = false;

document.addEventListener('DOMContentLoaded', () => {
    // UX: Fake Skeleton Load to ensure smooth transition consistency
    setTimeout(() => {
        document.getElementById('formSkeleton').style.display = 'none';
        document.getElementById('formContent').style.display = 'block';
        
        // Fast Pass Auto-Fill Logic
        if (fpAutoStart === 'true' && fpCourse) {
            isFastPass = true;
            document.getElementById('issueCategory').value = 'Question/Answer Error';
            
            let autoText = `Reporting an error regarding:\nCourse: ${fpCourse}\nType: ${fpType}\n`;
            if (fpYear) autoText += `Year: ${fpYear}\n`;
            autoText += `\nDescription of the error:\n`;
            
            document.getElementById('issueDescription').value = autoText;
        }
        
    }, 400);
});

// --- NAVIGATION ENGINE ---
window.handleBackNavigation = function() {
    if (isFastPass) {
        // Return exactly to the Course Details hub they came from
        window.location.replace(`course-details.html?course=${fpCourse}`);
    } else {
        // Return to the dashboard
        window.location.replace('dashboard.html');
    }
};

window.addEventListener('popstate', (e) => {
    handleBackNavigation();
});

// --- MODAL ENGINE ---
window.showGenericModal = function(title, message, isError = false, onSuccessRedirect = null) {
    document.getElementById('genericModalTitle').innerText = title;
    document.getElementById('genericModalMessage').innerText = message;
    
    const icon = document.getElementById('genericModalIcon');
    icon.setAttribute('name', isError ? 'warning-outline' : 'checkmark-circle-outline');
    icon.setAttribute('color', isError ? 'warning' : 'primary');
    
    const btnContainer = document.getElementById('genericModalButtons');
    
    if (onSuccessRedirect) {
        btnContainer.innerHTML = `<ion-button class="green-outline-btn" expand="block" style="width: 100%" onclick="window.location.replace('${onSuccessRedirect}')">OK</ion-button>`;
    } else {
        btnContainer.innerHTML = `<ion-button class="green-outline-btn" expand="block" style="width: 100%" onclick="document.getElementById('genericModal').style.display='none'">OK</ion-button>`;
    }
    
    document.getElementById('genericModal').style.display = 'flex';
};

// --- SUBMIT LOGIC ---
window.submitReport = async function() {
    const category = document.getElementById('issueCategory').value;
    const description = document.getElementById('issueDescription').value.trim();

    if (!category) {
        showGenericModal('Error', 'Please select an Issue Category.', true);
        return;
    }
    
    if (!description || description.length < 10) {
        showGenericModal('Error', 'Please provide a more detailed description (at least 10 characters).', true);
        return;
    }

    document.getElementById('globalLoading').style.display = 'flex';

    try {
        const userObj = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
        const authEmail = userObj.email;

        const { error } = await _sb.from('putme_reports').insert([{
            user_email: authEmail,
            category: category,
            description: description
        }]);

        if (error) throw error;

        document.getElementById('globalLoading').style.display = 'none';
        
        // Define redirect based on where they came from
        const targetRedirect = isFastPass ? `course-details.html?course=${fpCourse}` : 'dashboard.html';
        
        showGenericModal('Success!', 'Thank you! Your message has been submitted. Our team will review it shortly.', false, targetRedirect);

    } catch (err) {
        document.getElementById('globalLoading').style.display = 'none';
        console.error("Submission error:", err);
        showGenericModal('Connection Error', 'Failed to submit report. Please check your internet connection and try again.', true);
    }
};