function showLoading() { document.getElementById('globalLoading').style.display = 'flex'; }
function hideLoading() { document.getElementById('globalLoading').style.display = 'none'; }
function showModal(title, message, {autoClose=3000} = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal"><h3>${title}</h3><p>${message}</p><div style="text-align:right;"><button id="modalClose" style="padding:8px 12px;border-radius:8px;border:0;background:#eee;cursor:pointer;">Close</button></div></div></div>`;
  root.style.display = 'block';
  document.getElementById('modalClose').addEventListener('click', () => root.style.display = 'none');
  if (autoClose) { setTimeout(() => root.style.display = 'none', autoClose); }
}

const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Ensure the user actually came from the email link
async function checkAccess() {
    showLoading();
    const { data: { session } } = await supabaseClient.auth.getSession();
    hideLoading();
    // If they aren't logged in via the link, kick them back to login
    if (!session || !session.user.user_metadata?.requires_password_setup) {
        window.location.href = 'post-utme-login.html';
    }
}
checkAccess();

document.getElementById('savePasswordBtn').addEventListener('click', async () => {
    const pw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;

    if(!pw || !confirmPw) { showModal('Error', 'Please fill all fields'); return; }
    if(pw !== confirmPw) { showModal('Error', 'Passwords do not match'); return; }
    if(pw.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }

    showLoading();

    // 1. Assign the password and remove the setup flag
    const { data: updateData, error: updateError } = await supabaseClient.auth.updateUser({
        password: pw,
        data: { requires_password_setup: false } // Remove flag so they don't get sent here again!
    });

    if (updateError) {
        hideLoading(); showModal('Error', updateError.message); return;
    }

    const user = updateData.user;
    const metadata = user.user_metadata;

    // 2. Generate permanent Referral Code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let myNewRefCode = '';
    for (let i = 0; i < 8; i++) myNewRefCode += chars.charAt(Math.floor(Math.random() * chars.length));

    // 3. Save to POST UTME Database
    await supabaseClient.from('post-utme-users').insert([{
        user_id: user.id,
        full_name: metadata.full_name,
        email: user.email,
        referral_code: myNewRefCode
    }]);

    // 4. Reward the Referrer (If they used a code)
    if (metadata.referrer_email) {
        await supabaseClient.from('putme_referrals').insert([{ 
            referrer_email: metadata.referrer_email, 
            referred_email: user.email 
        }]);
    }

    // 5. Finalize Session & Go to Dashboard
    const userObj = { id: user.id, email: user.email, name: metadata.full_name || 'Candidate', loggedAt: Date.now() };
    localStorage.setItem('post_utme_logged_in_user', JSON.stringify(userObj));
    localStorage.setItem('my_referral_code', myNewRefCode);

    hideLoading();
    showModal('Success!', 'Your account is fully secured. Taking you to your dashboard...', {autoClose: 2000});
    setTimeout(() => { window.location.href = 'post-utme-dashboard.html'; }, 2000);
});