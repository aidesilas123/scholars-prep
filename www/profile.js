// --- 1. CORE CONFIG & AUTH GUARD ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(function protectPage() {
    if (!localStorage.getItem('abupq_logged_in_user')) window.location.replace('index.html'); 
})();

document.addEventListener('DOMContentLoaded', () => {
    // Theme setup
    if (localStorage.getItem('sp_theme') === 'dark') document.body.classList.add('dark');
    
    // Setup history for navigation
    history.replaceState({ view: 'view-profile' }, '', '');
    
    // Load data
    loadProfileData();
});

// --- 2. NAVIGATION ENGINE ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.view-layer').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
    } else {
        window.location.replace('dashboard.html');
    }
});

// --- 3. UI MODALS ---
window.showGenericModal = function(title, message, isError = false, buttonsHTML = null) {
    document.getElementById('genericModalTitle').innerText = title;
    document.getElementById('genericModalMessage').innerText = message;
    
    const icon = document.getElementById('genericModalIcon');
    icon.setAttribute('name', isError ? 'warning-outline' : 'checkmark-circle-outline');
    icon.setAttribute('color', isError ? 'danger' : 'primary');
    
    const btnContainer = document.getElementById('genericModalButtons');
    if (buttonsHTML) {
        btnContainer.innerHTML = buttonsHTML;
    } else {
        btnContainer.innerHTML = `<ion-button class="green-outline-btn" expand="block" style="width: 100%" onclick="document.getElementById('genericModal').style.display='none'">OK</ion-button>`;
    }
    document.getElementById('genericModal').style.display = 'flex';
};

// --- 4. LOAD PROFILE DATA ---
async function loadProfileData() {
    const userString = localStorage.getItem('abupq_logged_in_user');
    const userObj = JSON.parse(userString);
    const authEmail = userObj.email;

    // 1. Set Identity & Avatar
    document.getElementById('userEmail').innerText = authEmail;
    
    // Use the explicitly saved name, or generate one from the email
    let displayName = userObj.name || authEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
    displayName = displayName.replace(/\b\w/g, l => l.toUpperCase()); 
    
    document.getElementById('userName').innerText = displayName;
    document.getElementById('userAvatar').innerText = displayName.charAt(0).toUpperCase();

    try {
        // 2. Fetch Subscription Data using maybeSingle() for free users
        // We match by ID for maximum security
        const { data: subData, error: subError } = await _sb.from('profiles')
            .select('subscription_end, plan_type')
            .eq('id', userObj.id)
            .maybeSingle();

        if (subData && subData.subscription_end) {
            const endDate = new Date(subData.subscription_end);
            document.getElementById('subDates').innerText = `Expires: ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            
            if (endDate > new Date()) {
                document.getElementById('subStatus').classList.add('text-green');
                document.getElementById('subStatus').classList.remove('text-red');
                
                // Format plan_type (e.g. "semester" -> "Semester")
                const planName = subData.plan_type ? ` (${subData.plan_type.charAt(0).toUpperCase() + subData.plan_type.slice(1)})` : '';
                document.getElementById('subStatus').innerText = "Active" + planName;
            } else {
                document.getElementById('subStatus').classList.add('text-red');
                document.getElementById('subStatus').classList.remove('text-green');
                document.getElementById('subStatus').innerText = "Expired";
            }
        } else {
            // User is not in profiles table, meaning they are a free user
            document.getElementById('subStatus').classList.remove('text-green', 'text-red');
            document.getElementById('subStatus').innerText = "Free Plan";
            document.getElementById('subDates').innerText = "Expires: N/A";
        }

        // 3. Fetch Exam History (Streak)
        const { data: historyData } = await _sb.from('exam_history').select('created_at').eq('user_id', userObj.id);
        
        if (historyData && historyData.length > 0) {
            const uniqueDates = [...new Set(historyData.map(r => new Date(r.created_at).toDateString()))];
            document.getElementById('studyStreak').innerText = `${uniqueDates.length} Days`;
        } else {
            document.getElementById('studyStreak').innerText = `0 Days`;
        }

    } catch (err) {
        console.error("Error loading specific profile stats:", err);
    } finally {
        document.getElementById('profileSkeleton').style.display = 'none';
        document.getElementById('profileStats').style.display = 'flex';
    }
}

// --- 5. CHANGE PASSWORD ---
window.changePassword = async function() {
    const newPass = document.getElementById('newPassword').value;
    
    if (newPass.length < 6) {
        showGenericModal('Weak Password', 'Your new password must be at least 6 characters long.', true);
        return;
    }

    document.getElementById('globalLoading').style.display = 'flex';
    document.getElementById('loadingText').innerText = "Updating...";

    try {
        const { error } = await _sb.auth.updateUser({ password: newPass });
        if (error) throw error;

        document.getElementById('globalLoading').style.display = 'none';
        
        showGenericModal('Success!', 'Your password has been updated securely.', false, 
            `<ion-button class="green-outline-btn" expand="block" style="width: 100%" onclick="document.getElementById('newPassword').value=''; history.back(); document.getElementById('genericModal').style.display='none'">OK</ion-button>`
        );

    } catch (err) {
        document.getElementById('globalLoading').style.display = 'none';
        console.error("Failed to update password", err);
        showGenericModal('Update Failed', 'Ensure you are securely logged in, or contact support.', true);
    }
};

// --- 6. LOG OUT ---
window.confirmLogoutUser = function() {
    showGenericModal('Log Out', 'Are you sure you want to log out of your account?', true,
        `<ion-button class="green-outline-btn" style="flex:1" onclick="document.getElementById('genericModal').style.display='none'">Cancel</ion-button>
         <ion-button color="danger" fill="solid" style="flex:1; font-weight: bold;" onclick="executeLogout()">Yes, Log Out</ion-button>`
    );
};

window.executeLogout = async function() {
    document.getElementById('genericModal').style.display = 'none';
    document.getElementById('globalLoading').style.display = 'flex';
    document.getElementById('loadingText').innerText = "Signing Out...";
    
    await _sb.auth.signOut();
    localStorage.removeItem('abupq_logged_in_user');
    window.location.replace('index.html');
};