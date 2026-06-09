function showLoading() { document.getElementById('globalLoading').style.display = 'flex'; }
function hideLoading() { document.getElementById('globalLoading').style.display = 'none'; }

(function checkLogin() {
  const savedUser = localStorage.getItem('post_utme_logged_in_user');
  if (savedUser) window.location.href = 'post-utme-dashboard.html';
})();

function showModal(title, message, {autoClose=3000} = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal"><h3>${title}</h3><p>${message}</p><div style="text-align:right;"><button id="modalClose" style="padding:8px 12px;border-radius:8px;border:0;background:#eee;cursor:pointer;">Close</button></div></div></div>`;
  root.style.display = 'block';
  document.getElementById('modalClose').addEventListener('click', () => root.style.display = 'none');
  if (autoClose) { setTimeout(() => root.style.display = 'none', autoClose); }
}
function hideModal(){ document.getElementById('modalRoot').style.display = 'none'; }

function renderView(viewId) {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('view-signup').style.display = 'none';
  document.getElementById('view-verify').style.display = 'none';
  document.getElementById('view-reset').style.display = 'none';
  
  document.getElementById(`view-${viewId}`).style.display = 'block';

  const title = document.getElementById('formTitle');
  const sub = document.getElementById('formSubtitle');

  if (viewId === 'login') { title.textContent = 'POST UTME Practice Portal'; sub.textContent = 'Sign in to your dashboard'; }
  else if (viewId === 'signup') { title.textContent = 'Aspirant Registration'; sub.textContent = 'Register for POST UTME Practice'; }
  else if (viewId === 'verify') { title.textContent = 'Verify Email'; sub.textContent = 'Enter the 6-digit code sent to your inbox'; }
  else if (viewId === 'reset') { title.textContent = 'Reset Password'; sub.textContent = 'Enter your email to receive a reset link'; }
}

function navigateTo(viewId) {
  history.pushState({ view: viewId }, '', '#' + viewId);
  renderView(viewId);
}

window.addEventListener('popstate', (event) => {
  const view = event.state ? event.state.view : 'login';
  renderView(view);
});

if (!history.state) {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  if (refCode) {
      document.getElementById('signupReferral').value = refCode.toUpperCase();
      history.replaceState({ view: 'signup' }, '', '#signup'); renderView('signup');
  } else {
      history.replaceState({ view: 'login' }, '', '#login'); renderView('login');
  }
}

// --- SUPABASE LOGIC ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// We need to hold the user's email temporarily while they check their inbox
let unverifiedEmail = '';

// 1. SIGNUP & SEND OTP
document.getElementById('signupBtn').addEventListener('click', async () => {
  const surname = document.getElementById('signupSurname').value.trim();
  const lastname = document.getElementById('signupLastname').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pw = document.getElementById('signupPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;
  const enteredRefCode = document.getElementById('signupReferral').value.trim().toUpperCase();

  if(!surname || !lastname || !email || !pw) { showModal('Error', 'Please fill all required fields'); return; }
  if(pw !== confirmPw) { showModal('Error', 'Passwords do not match'); return; }
  if(pw.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }

  showLoading();

  let referrerEmail = null;

  if (enteredRefCode) {
      const { data: refUser } = await supabaseClient.from('post-utme-users').select('email').eq('referral_code', enteredRefCode).single();
      if (refUser) { referrerEmail = refUser.email; } 
      else { hideLoading(); showModal('Invalid Code', 'The referral code does not exist. Leave blank or try again.'); return; }
  }

  // FIXED: Changed .single() to .maybeSingle() to stop the 406 Error
  const { data: existingUser } = await supabaseClient.from('post-utme-users').select('id').eq('email', email).maybeSingle();
  if(existingUser) { hideLoading(); showModal('Error', 'This email is already registered. Please log in.'); return; }
  
  // FIXED: Generate the referral code HERE so the SQL trigger can use it
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let myNewRefCode = '';
  for (let i = 0; i < 8; i++) myNewRefCode += chars.charAt(Math.floor(Math.random() * chars.length));

  // Creates user and triggers the SQL Database Insert automatically
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email: email,
    password: pw,
    options: {
      data: { 
          full_name: `${surname} ${lastname}`, 
          role: 'post_utme',
          referrer_email: referrerEmail,
          app_type: 'post_utme',         // Triggers the Post UTME routing
          referral_code: myNewRefCode    // Prevents the 500 error!
      }
    }
  });

  hideLoading();
  if(authError){ showModal('Error', authError.message); } 
  else {
    unverifiedEmail = email;
    showModal('Check Your Email', 'A 6-digit code has been sent to your email. Please enter it to continue.', {autoClose: 4000});
    navigateTo('verify');
  }
});

// 2. VERIFY 6-DIGIT CODE (IN-APP)
document.getElementById('verifyBtn').addEventListener('click', async () => {
  const code = document.getElementById('verifyCode').value.trim();
  if (!code || code.length < 6) { showModal('Error', 'Please enter the 6-digit code sent to your email.'); return; }
  if (!unverifiedEmail) { showModal('Error', 'Session lost. Please try logging in to trigger a new code.'); navigateTo('login'); return; }

  showLoading();

  // Validate the code with Supabase
  const { data: verifyData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      email: unverifiedEmail,
      token: code,
      type: 'signup'
  });

  if (verifyError) {
      hideLoading(); showModal('Invalid Code', 'The code is incorrect or has expired. Please try again.'); return;
  }

  // Verification Success! 
  const user = verifyData.user;
  const metadata = user.user_metadata;

  // Reward the Referrer (If they used a code)
  if (metadata.referrer_email) {
      await supabaseClient.from('putme_referrals').insert([{ 
          referrer_email: metadata.referrer_email, 
          referred_email: user.email 
      }]);
  }

  // Finalize Session & Go to Dashboard
  const userObj = { id: user.id, email: user.email, name: metadata.full_name || 'Candidate', loggedAt: Date.now() };
  localStorage.setItem('post_utme_logged_in_user', JSON.stringify(userObj));
  
  // FIXED: Read the referral code directly from metadata
  localStorage.setItem('my_referral_code', metadata.referral_code);

  hideLoading();
  showModal('Success!', 'Account verified! Redirecting to dashboard...', {autoClose: 1500});
  setTimeout(() => { window.location.href = 'post-utme-dashboard.html'; }, 1500);
});

// 3. LOGIN
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;

  if(!email || !pw){ showModal('Error', 'Please enter email and password'); return; }
  showLoading();

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });
  
  if(error){ 
    hideLoading(); 
    if(error.message.includes("Email not confirmed")) {
        unverifiedEmail = email;
        showModal('Verification Required', 'You have not verified your email yet. Please check your inbox or request a new code.', {autoClose: 5000});
        navigateTo('verify');
    } else {
        showModal('Incorrect', error.message); 
    }
    return; 
  }

  const { data: profileData, error: profileError } = await supabaseClient.from('post-utme-users').select('id, referral_code').eq('user_id', data.user.id).single();

  if (profileError) { hideLoading(); await supabaseClient.auth.signOut(); showModal('Access Denied', 'This portal is for POST UTME candidates only.'); return; }

  const userObj = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || 'Candidate', loggedAt: Date.now() };
  localStorage.setItem('post_utme_logged_in_user', JSON.stringify(userObj));
  if (profileData.referral_code) localStorage.setItem('my_referral_code', profileData.referral_code);
  
  showModal('Success', 'Redirecting to dashboard...', {autoClose: 1000});
  setTimeout(() => { window.location.href = 'post-utme-dashboard.html'; }, 1000);
});

// 4. RESET PASSWORD
document.getElementById('resetBtn').addEventListener('click', async () => {
  const email = document.getElementById('resetEmail').value.trim().toLowerCase();
  if (!email) { showModal('Error', 'Please enter your email'); return; }

  showLoading();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/update-password.html' });
  hideLoading();

  if (error) showModal('Error', error.message);
  else { showModal('Success', 'Check your email for the reset link!'); setTimeout(() => { navigateTo('login'); }, 3000); }
});