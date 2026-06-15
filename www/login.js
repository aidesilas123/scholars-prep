// --- PREMIUM LOADING UI FUNCTIONS (STRICT TERMINATION) ---
function showLoading() {
  const loader = document.getElementById('globalLoading');
  if (loader) loader.style.display = 'flex';
}

function hideLoading() {
  return new Promise((resolve) => {
    const loader = document.getElementById('globalLoading');
    if (loader) {
      loader.style.display = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    } else {
      resolve();
    }
  });
}

(function checkLogin() {
    const savedUser = localStorage.getItem('abupq_logged_in_user');
    if (savedUser) window.location.href = 'dashboard.html';
})();

function showModal(title, message, {autoClose=3000} = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3><p>${message}</p><div style="text-align:right;"><button id="modalClose" style="padding:8px 12px;border-radius:8px;border:0;background:#eee;cursor:pointer;">Close</button></div></div></div>`;
  root.style.display = 'block';
  document.getElementById('modalClose').addEventListener('click', hideModal);
  if (autoClose) { setTimeout(hideModal, autoClose); }
}

function hideModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  root.style.display = 'none';
}

// --- VIEW ROUTER ---
function renderView(viewId) {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('view-signup').style.display = 'none';
  document.getElementById('view-reset').style.display = 'none';
  
  const activeView = document.getElementById(`view-${viewId}`);
  if (activeView) activeView.style.display = 'block';

  const title = document.getElementById('formTitle');
  const sub = document.getElementById('formSubtitle');

  if (viewId === 'login') { 
    title.textContent = 'Welcome Back'; 
    sub.textContent = 'Sign in to access your study resources'; 
  } else if (viewId === 'signup') { 
    title.textContent = 'Create Account'; 
    sub.textContent = 'Sign up to access ABU PQ & Answers'; 
  } else if (viewId === 'reset') { 
    title.textContent = 'Reset Password'; 
    sub.textContent = 'Enter your email to receive a reset link'; 
  }
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
  const hash = window.location.hash.replace('#', '') || 'login';
  history.replaceState({ view: hash }, '', '#' + hash); 
  renderView(hash);
}

// --- SUPABASE LOGIC ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// SIGNUP
document.getElementById('signupBtn').addEventListener('click', async () => {
  const surname = document.getElementById('signupSurname').value.trim();
  const lastname = document.getElementById('signupLastname').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pw = document.getElementById('signupPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;
  const refCode = document.getElementById('signupReferral').value.trim().toUpperCase();

  if(!surname || !lastname || !email || !pw) { showModal('Error', 'Please fill all required fields'); return; }
  if(pw !== confirmPw) { showModal('Error', 'Passwords do not match'); return; }
  if(pw.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }

  showLoading();
  const { data, error } = await supabaseClient.auth.signUp({
    email, 
    password: pw, 
    options: { 
        data: { 
            full_name: `${surname} ${lastname}`,
            app_type: 'main',
            referral_code: refCode
        } 
    }
  });
  
  if(error){ 
    await hideLoading();
    showModal('Error', error.message); 
  } else {
    if (data.user && data.user.identities && data.user.identities.length === 0) {
       await hideLoading();
       showModal('Error', 'This email is already in use. Please log in.');
    } else {
       // FIXED: Explicitly handle session saving and redirecting
       const user = data.user;
       const userObj = {
           id: user.id,
           email: user.email,
           name: user.user_metadata?.full_name || 'User',
           loggedAt: Date.now()
       };
       localStorage.setItem('abupq_logged_in_user', JSON.stringify(userObj));
       localStorage.setItem('isLoggedIn', 'true');

       await hideLoading();
       showModal('Success!', 'Account created! Redirecting...', {autoClose: 1500});
       setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    }
  }
});

// LOGIN
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;

  if(!email || !pw){ showModal('Error', 'Please enter email and password'); return; }

  showLoading();

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

  if(error){ 
    await hideLoading(); 
    showModal('Incorrect', error.message); 
    return;
  }
  
  // FIXED: Explicitly handle session saving and redirecting
  const user = data.user;
  const userObj = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || 'User',
      loggedAt: Date.now()
  };
  localStorage.setItem('abupq_logged_in_user', JSON.stringify(userObj));
  localStorage.setItem('isLoggedIn', 'true');

  await hideLoading();
  showModal('Success', 'Redirecting to dashboard...', {autoClose: 1000});
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
});

// RESET EMAIL
document.getElementById('resetBtn').addEventListener('click', async () => {
    const email = document.getElementById('resetEmail').value.trim().toLowerCase();
    if (!email) { showModal('Error', 'Please enter your email'); return; }

    showLoading();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/update-password.html',
    });
    
    await hideLoading();

    if (error) {
        showModal('Error', error.message);
    } else {
        showModal('Success', 'Check your email for the reset link!');
        setTimeout(() => { navigateTo('login'); }, 3000);
    }
});

// RESTORE SESSION VISUALS
const stored = localStorage.getItem('abupq_logged_in_user');
if(stored) {
    try {
        const u = JSON.parse(stored);
        const watermark = document.getElementById('watermark');
        if(watermark) watermark.textContent = u.email;
    } catch(e) {}
}