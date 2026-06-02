// --- AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) window.location.replace('post-utme-login.html'); 
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');

document.addEventListener('DOMContentLoaded', () => {
    // Theme Inheritance
    const isDark = localStorage.getItem('post_utme_theme') === 'dark' || localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    if (isDark) {
        document.body.classList.add('dark');
        document.body.classList.add('dark-mode');
    }
    
    // Initialize Navigation Stack
    history.replaceState({ view: 'view-form' }, '', '');

    // UX: Fake Skeleton Load to ensure smooth transition consistency
    setTimeout(() => {
        document.getElementById('formSkeleton').style.display = 'none';
        document.getElementById('formContent').style.display = 'block';
    }, 400);
});

// --- LINEAR NAVIGATION ENGINE ---
window.addEventListener('popstate', (e) => {
    window.location.replace('post-utme-dashboard.html');
});

// --- UI HELPERS ---
function showLoading(show) {
    document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
}

function showModal(title, msg, onOk, showCancel = true) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMsg').innerHTML = msg;
    const cancelBtn = document.getElementById('modalCancel');
    cancelBtn.style.display = showCancel ? 'block' : 'none';

    const okBtn = document.getElementById('modalOk');
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.onclick = () => {
        hideModal();
        if (onOk) onOk();
    };
    document.getElementById('overlay').style.display = 'flex';
}
window.hideModal = () => document.getElementById('overlay').style.display = 'none';

// --- SUBMIT LOGIC ---
window.submitReport = async function() {
    const category = document.getElementById('issueCategory').value;
    const description = document.getElementById('issueDescription').value.trim();

    if (!category) {
        showModal('Error', 'Please select an Issue Category.', null, false);
        return;
    }
    
    if (!description || description.length < 10) {
        showModal('Error', 'Please provide a more detailed description (at least 10 characters).', null, false);
        return;
    }

    showLoading(true);

    try {
        const userObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user'));
        const authEmail = userObj.email;

        const { error } = await _sb.from('putme_reports').insert([{
            user_email: authEmail,
            category: category,
            description: description
        }]);

        if (error) throw error;

        showLoading(false);
        showModal('Success!', 'Thank you! Your message has been submitted. Our team will review it shortly.', () => {
            window.location.replace('post-utme-dashboard.html');
        }, false);

    } catch (err) {
        showLoading(false);
        console.error("Submission error:", err);
        showModal('Connection Error', 'Failed to submit report. Please check your internet connection and try again.', null, false);
    }
};