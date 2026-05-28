// --- PREMIUM LOADING UI ---
function showLoading() {
  document.getElementById('globalLoading').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('globalLoading').style.display = 'none';
}

// Check for existing POST UTME session
(function checkLogin() {
  const savedUser = localStorage.getItem('post_utme_logged_in_user');
  if (savedUser) {
      window.location.href = 'post-utme-dashboard.html';
  }
})();

// --- MODAL UTILITY ---
function showModal(title, message, {autoClose=3000} = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <h3>${title}</h3>
        <p>${message}</p>
        <div style="text-align:right;"><button id="modalClose" style="padding:8px 12px;border-radius:8px;border:0;background:#eee;cursor:pointer;">Close</button></div>
      </div>
    </div>
  `;
  root.style.display = 'block';
  document.getElementById('modalClose').addEventListener('click', hideModal);
  if (autoClose) { setTimeout(hideModal, autoClose); }
}

function hideModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  root.style.display = 'none';
}

// --- PHASE 2: NATIVE NAVIGATION STACK ---
function renderView(viewId) {
  // Hide all views
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('view-signup').style.display = 'none';
  document.getElementById('view-reset').style.display = 'none';

  // Show requested view
  document.getElementById(`view-${viewId}`).style.display = 'block';

  // Update Headers
  const title = document.getElementById('formTitle');
  const sub = document.getElementById('formSubtitle');

  if (viewId === 'login') {
    title.textContent = 'POST UTME Portal';
    sub.textContent = 'Sign in to your candidate dashboard';
  } else if (viewId === 'signup') {
    title.textContent = 'Candidate Registration';
    sub.textContent = 'Register for POST UTME CBT Prep';
  } else if (viewId === 'reset') {
    title.textContent = 'Reset Password';
    sub.textContent = 'Enter your email to receive a reset link';
  }
}

// Called by the HTML buttons to move forward in the stack
function navigateTo(viewId) {
  history.pushState({ view: viewId }, '', '#' + viewId);
  renderView(viewId);
}

// Listens to the Phone's physical Back Button
window.addEventListener('popstate', (event) => {
  const view = event.state ? event.state.view : 'login';
  renderView(view);
});

// Initialize first state
// --- AUTO-FILL REFERRAL CODE FROM LINK ---
if (!history.state) {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode) {
      document.getElementById('signupReferral').value = refCode.toUpperCase();
      history.replaceState({ view: 'signup' }, '', '#signup');
      renderView('signup');
  } else {
      history.replaceState({ view: 'login' }, '', '#login');
      renderView('login');
  }
}

// --- SUPABASE LOGIC ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- NEW: AUTO-LOGIN LISTENER FOR EMAIL LINKS ---
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        const userObj = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || 'Candidate',
            loggedAt: Date.now()
        };
        localStorage.setItem('post_utme_logged_in_user', JSON.stringify(userObj));
        window.location.href = 'post-utme-dashboard.html';
    }
});

// 1. SIGNUP & REFERRAL TRACKING
document.getElementById('signupBtn').addEventListener('click', async () => {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pw = document.getElementById('signupPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;
  const enteredRefCode = document.getElementById('signupReferral').value.trim().toUpperCase();

  if(!name || !email || !pw) { showModal('Error', 'Please fill all required fields'); return; }
  if(pw !== confirmPw) { showModal('Error', 'Passwords do not match'); return; }

  showLoading();

  let referrerEmail = null;

  // A. Verify the Referral Code BEFORE creating the account
  if (enteredRefCode) {
      const { data: refUser, error: refError } = await supabaseClient
          .from('post-utme-users')
          .select('email')
          .eq('referral_code', enteredRefCode)
          .single();

      if (refUser) {
          referrerEmail = refUser.email;
      } else {
          hideLoading();
          showModal('Invalid Code', 'The referral code you entered does not exist. You can leave it blank or try again.');
          return;
      }
  }
  
  // B. Create User in standard Auth table
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email, password: pw, options: { data: { full_name: name, role: 'post_utme' } }
  });

  if(authError){ 
    hideLoading();
    showModal('Error', authError.message); 
    return;
  }

  // --- NEW: DUPLICATE EMAIL CHECK ---
  if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
      hideLoading();
      showModal('Error', 'This email is already in use.');
      return;
  }

  // C. Generate a permanent 8-digit code for this new user
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let myNewRefCode = '';
  for (let i = 0; i < 8; i++) myNewRefCode += chars.charAt(Math.floor(Math.random() * chars.length));

  if (authData.user) {
    // Insert into POST UTME table with their new referral code
    const { error: dbError } = await supabaseClient
      .from('post-utme-users')
      .insert([
        { user_id: authData.user.id, full_name: name, email: email, referral_code: myNewRefCode }
      ]);
      
    // D. If they used a valid code, reward the referrer!
    if (referrerEmail) {
        await supabaseClient.from('putme_referrals').insert([
            { referrer_email: referrerEmail, referred_email: email }
        ]);
    }
  }

  hideLoading();
  // --- NEW: VERIFY EMAIL MODAL ---
  showModal('Verify Email', 'Registration successful! Please check your email inbox to verify your account before logging in.', {autoClose: 5000});
  setTimeout(() => { navigateTo('login'); }, 4000);
});

// 2. LOGIN & FETCH DATA
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;

  if(!email || !pw){ showModal('Error', 'Please enter email and password'); return; }

  showLoading();

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

  if(error){ 
    hideLoading();
    // --- NEW: UNVERIFIED EMAIL CATCH ---
    if(error.message.includes("Email not confirmed")) {
        showModal('Verification Required', 'Please check your email and click the verification link before logging in.', {autoClose: 5000});
    } else {
        showModal('Incorrect', error.message); 
    }
    return;
  }

  // Fetch their profile AND their referral code
  const { data: profileData, error: profileError } = await supabaseClient
    .from('post-utme-users')
    .select('id, referral_code')
    .eq('user_id', data.user.id)
    .single();

  if (profileError) {
    hideLoading();
    await supabaseClient.auth.signOut();
    showModal('Access Denied', 'This portal is for POST UTME candidates only.');
    return;
  }

  try {
    const userObj = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || 'Candidate',
        loggedAt: Date.now()
    };

    // Save login session
    localStorage.setItem('post_utme_logged_in_user', JSON.stringify(userObj));
    
    // Save their permanent referral code for the Dashboard to use
    if (profileData.referral_code) {
        localStorage.setItem('my_referral_code', profileData.referral_code);
    }
    
    showModal('Success', 'Redirecting to dashboard...', {autoClose: 1000});
    setTimeout(() => { window.location.href = 'post-utme-dashboard.html'; }, 1000);

  } catch (err) {
    console.error(err);
    window.location.href = 'post-utme-dashboard.html';
  }
});

// 3. RESET PASSWORD
document.getElementById('resetBtn').addEventListener('click', async () => {
  const email = document.getElementById('resetEmail').value.trim().toLowerCase();
  if (!email) { showModal('Error', 'Please enter your email'); return; }

  showLoading();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/update-password.html',
  });
  hideLoading();

  if (error) {
      showModal('Error', error.message);
  } else {
      showModal('Success', 'Check your email for the reset link!');
      setTimeout(() => { navigateTo('login'); }, 3000);
  }
});