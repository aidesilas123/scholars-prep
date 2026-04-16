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
    (async function checkLogin() {
        const savedUser = localStorage.getItem('abupq_logged_in_user');
        
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                const { data: sessionData, error } = await supabaseClient
                    .from('active_sessions')
                    .select('last_seen')
                    .eq('user_id', user.id)
                    .single();

                if (sessionData) {
                    const lastSeen = new Date(sessionData.last_seen).getTime();
                    const now = new Date().getTime();
                    const TIMEOUT_MINUTES = 15; 
                    const diffMinutes = (now - lastSeen) / 1000 / 60;

                    if (diffMinutes < TIMEOUT_MINUTES) {
                        window.location.href = 'dashboard.html';
                        return;
                    }
                }
                localStorage.removeItem('abupq_logged_in_user');
            } catch (err) {
                console.error("Session check failed:", err);
                localStorage.removeItem('abupq_logged_in_user');
            }
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

    // --- SUPABASE LOGIC ---
    const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // SIGNUP
    // SIGNUP
    document.getElementById('signupBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim().toLowerCase();
      const pw = document.getElementById('signupPassword').value;
      const confirmPw = document.getElementById('confirmPassword').value;

      if(!name || !email || !pw) { showModal('Error', 'Please fill all fields'); return; }
      if(pw !== confirmPw) { showModal('Error', 'Passwords do not match'); return; }

      // 1. FIRE LOADING UI
      showLoading();

      const { data, error } = await supabaseClient.auth.signUp({
        email, password: pw, options: { data: { full_name: name } }
      });

      // 2. HIDE LOADING UI WHEN DONE
      hideLoading();

      if(error){ 
        showModal('Error', error.message); 
      } else {
        showModal('Success', 'Account created! Please Login.', {autoClose: 4500});
        setTimeout(() => { document.querySelector('#toggleToLogin .toggle').click(); }, 2000);
      }
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

    // Reset Email
    // Reset Email
    document.getElementById('resetBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value.trim().toLowerCase();
        if (!email) { showModal('Error', 'Please enter your email'); return; }

        // 1. FIRE LOADING UI
        showLoading();

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/update-password.html',
        });

        // 2. HIDE LOADING UI WHEN DONE
        hideLoading();

        if (error) {
            showModal('Error', error.message);
        } else {
            showModal('Success', 'Check your email for the reset link!');
            setTimeout(() => { document.querySelector('#toggleToLogin .toggle').click(); }, 3000);
        }
    });

    // --- LOGIN ---
   // --- LOGIN ---
    document.getElementById('loginBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const pw = document.getElementById('loginPassword').value;

      if(!email || !pw){ showModal('Error', 'Please enter email and password'); return; }

      // 1. FIRE LOADING UI
      showLoading();

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

      if(error){ 
        // 2. HIDE LOADING ON ERROR
        hideLoading();
        showModal('Incorrect', error.message); 
        return;
      }

      const userId = data.user.id;
      
      try {
        const { data: sessionData } = await supabaseClient
            .from('active_sessions')
            .select('last_seen')
            .eq('user_id', userId)
            .single();

        if (sessionData) {
            const lastSeen = new Date(sessionData.last_seen).getTime();
            const now = new Date().getTime();
            const TIMEOUT_MINUTES = 5; 
            const diffMinutes = (now - lastSeen) / 1000 / 60;

            if (diffMinutes < TIMEOUT_MINUTES) {
                await supabaseClient.auth.signOut(); 
                // 3. HIDE LOADING ON SESSION LIMIT
                hideLoading();
                showModal('Limit Reached', 'Simultaneous limit reached. You are already logged in on another device.');
                return;
            }
        }

        await supabaseClient
            .from('active_sessions')
            .upsert({ user_id: userId, last_seen: new Date().toISOString() });

        const userObj = {
            id: userId,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || 'User',
            loggedAt: Date.now()
        };

        localStorage.setItem('abupq_logged_in_user', JSON.stringify(userObj));
        localStorage.setItem('isLoggedIn', 'true');
        
        // 4. KEEP SPINNER RUNNING UNTIL REDIRECT
        showModal('Success', 'Redirecting to dashboard...', {autoClose: 1000});
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);

      } catch (err) {
        console.error(err);
        window.location.href = 'dashboard.html';
      }
    });

    const stored = localStorage.getItem('abupq_logged_in_user');
    if(stored) {
        try {
            const u = JSON.parse(stored);
            document.getElementById('watermark').textContent = u.email;
        } catch(e) {}
    }
  