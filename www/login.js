// --- PREMIUM LOADING UI FUNCTIONS ---
function showLoading() {
  const loader = document.getElementById('globalLoading');
  if (loader) loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('globalLoading');
  if (loader) loader.style.display = 'none';
}

// It checks if 'abupq_logged_in_user' exists. If yes, go straight to dashboard.
(function checkLogin() {
    const savedUser = localStorage.getItem('abupq_logged_in_user');
    if (savedUser) {
        window.location.href = 'dashboard.html';
    }
})();

// --- Utility: modal ---
function showModal(title, message, {autoClose=3000} = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal" role="dialog" aria-modal="true">
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

// Toggle forms
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const toggleToSignup = document.getElementById('toggleToSignup');
const toggleToLogin = document.getElementById('toggleToLogin');

document.querySelector('#toggleToSignup .toggle')?.addEventListener('click', () => {
  loginForm.style.display = 'none';
  signupForm.style.display = 'block';
  document.getElementById('formTitle').textContent = 'Create Account';
  document.getElementById('formSubtitle').textContent = 'Sign up to access ABU PQ & Answers';
  toggleToSignup.style.display = 'none';
  toggleToLogin.style.display = 'block';
});

document.querySelector('#toggleToLogin .toggle')?.addEventListener('click', () => {
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';
  document.getElementById('formTitle').textContent = 'Welcome Back';
  document.getElementById('formSubtitle').textContent = 'Sign in to access your study resources';
  toggleToSignup.style.display = 'block';
  toggleToLogin.style.display = 'none';
});

// Toggle to Reset
document.getElementById('forgotPwdLink').addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'none';
    document.getElementById('resetForm').style.display = 'block';
    document.getElementById('formTitle').textContent = 'Reset Password';
    document.getElementById('formSubtitle').textContent = 'Enter your email to receive a reset link';
    toggleToSignup.style.display = 'none';
    toggleToLogin.style.display = 'block';
});

// --- SUPABASE LOGIC ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- GLOBAL AUTH LISTENER ---
// Automatically catches users returning from clicking Email Verification links
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        const userObj = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'User',
            loggedAt: Date.now()
        };
        localStorage.setItem('abupq_logged_in_user', JSON.stringify(userObj));
        localStorage.setItem('isLoggedIn', 'true');
        
        hideLoading();
        window.location.href = 'dashboard.html';
    }
});

// SIGNUP
document.getElementById('signupBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pw = document.getElementById('signupPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;

  if(!name || !email || !pw) { showModal('Error', 'Please fill all fields'); return; }
  if(pw !== confirmPw) { showModal('Error', 'Passwords do not match'); return; }

  showLoading();
  const { data, error } = await supabaseClient.auth.signUp({
    email, password: pw, options: { data: { full_name: name } }
  });
  hideLoading();

  if(error){ 
    showModal('Error', error.message); 
  } else {
    // Check if email is already used
    if (data.user && data.user.identities && data.user.identities.length === 0) {
       showModal('Error', 'This email is already in use.');
    } else {
       showModal('Verify Email', 'Account created! Please check your email inbox to verify your account.', {autoClose: 5000});
       setTimeout(() => { document.querySelector('#toggleToLogin .toggle').click(); }, 3000);
    }
  }
});

// Reset Email
document.getElementById('resetBtn').addEventListener('click', async (e) => {
    e.preventDefault();
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
        setTimeout(() => { document.querySelector('#toggleToLogin .toggle').click(); }, 3000);
    }
});

// --- LOGIN ---
document.getElementById('loginBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;

  if(!email || !pw){ showModal('Error', 'Please enter email and password'); return; }

  showLoading();

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

  if(error){ 
    hideLoading();
    if(error.message.includes("Email not confirmed")) {
        showModal('Verification Required', 'Please check your email and click the verification link before logging in.');
    } else {
        showModal('Incorrect', error.message); 
    }
    return;
  }
  
  // The onAuthStateChange listener at the top will automatically catch the successful login
});

const stored = localStorage.getItem('abupq_logged_in_user');
if(stored) {
    try {
        const u = JSON.parse(stored);
        const watermark = document.getElementById('watermark');
        if(watermark) watermark.textContent = u.email;
    } catch(e) {}
}