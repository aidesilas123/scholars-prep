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
    
    history.replaceState({ view: 'view-profile' }, '', '');
    loadProfileData();
});

// --- NAVIGATION ENGINE ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.view-layer').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
    } else {
        window.location.replace('post-utme-dashboard.html');
    }
});

// --- LOAD PROFILE DATA ---
async function loadProfileData() {
    const userString = localStorage.getItem('post_utme_logged_in_user');
    const userObj = JSON.parse(userString);
    const authEmail = userObj.email;

    // 1. Set Identity & Avatar
    document.getElementById('userEmail').innerText = authEmail;
    
    // Extract Name from Email (e.g., john.doe@email.com -> John Doe)
    let displayName = authEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
    displayName = displayName.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize
    document.getElementById('userName').innerText = displayName;
    
    // Set Initial Avatar
    document.getElementById('userAvatar').innerText = displayName.charAt(0).toUpperCase();

    try {
        // 2. Fetch Subscription Data
        const { data: subData, error: subError } = await _sb.from('putme_subscriptions')
            .select('*').eq('user_email', authEmail).single();

        if (subData) {
            document.getElementById('subStatus').innerText = subData.plan_name;
            const endDate = new Date(subData.end_date);
            document.getElementById('subDates').innerText = `Expires: ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            
            // Highlight in red if expired
            if (endDate < new Date()) {
                document.getElementById('subStatus').classList.add('text-red');
                document.getElementById('subStatus').innerText = "Expired";
            } else {
                document.getElementById('subStatus').classList.add('text-green');
            }
        }

        // 3. Calculate Streak (Count distinct days they took a mock exam)
        const { data: historyData } = await _sb.from('putme_exam_results').select('created_at').eq('user_email', authEmail);
        
        if (historyData && historyData.length > 0) {
            // Get unique dates
            const uniqueDates = [...new Set(historyData.map(r => new Date(r.created_at).toDateString()))];
            document.getElementById('studyStreak').innerText = `${uniqueDates.length} Days`;
        }

    } catch (err) {
        console.error("Error loading specific profile stats:", err);
    } finally {
        document.getElementById('profileSkeleton').style.display = 'none';
        document.getElementById('profileStats').style.display = 'flex';
    }
}

// --- CHANGE PASSWORD ---
// --- UI MODAL HELPERS ---
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


// --- CHANGE PASSWORD ---
window.changePassword = async function() {
    const newPass = document.getElementById('newPassword').value;
    
    if (newPass.length < 6) {
        // Replaced alert()
        showModal('Weak Password', 'Your new password must be at least 6 characters long.', null, false);
        return;
    }

    document.getElementById('globalLoading').style.display = 'flex';

    try {
        const { error } = await _sb.auth.updateUser({ password: newPass });
        if (error) throw error;

        document.getElementById('globalLoading').style.display = 'none';
        
        // Replaced alert()
        showModal('Success!', 'Your password has been updated securely.', () => {
            document.getElementById('newPassword').value = '';
            history.back(); // Slide back to main profile
        }, false);

    } catch (err) {
        document.getElementById('globalLoading').style.display = 'none';
        console.error("Failed to update password", err);
        showModal('Update Failed', 'Ensure you are securely logged in, or contact support.', null, false);
    }
};


// --- LOG OUT ---
window.logoutUser = function() {
    showModal(
        'Log Out', 
        'Are you sure you want to log out of your account?', 
        () => {
            // This only runs if they click "Yes"
            localStorage.removeItem('post_utme_logged_in_user');
            window.location.replace('post-utme-login.html');
        }, 
        true // true means show the Cancel button
    );
};