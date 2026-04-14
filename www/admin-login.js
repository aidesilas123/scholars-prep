
    const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const loginForm = document.getElementById('adminLoginForm');
    const errorBox = document.getElementById('errorBox');
    const loginBtn = document.getElementById('loginBtn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError(null);
        setLoading(true);

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        try {
            // 1. Check credentials against admin_users table
            const { data, error } = await supabaseClient
                .from('admin_users')
                .select('*')
                .eq('email', email)
                .eq('password', password) // Direct string match (Note: In production use hashing)
                .single();

            if (error || !data) {
                throw new Error("Invalid admin credentials");
            }

            // 2. Save session to a UNIQUE key (completely separate from users)
            const adminSession = {
                id: data.id,
                email: data.email,
                role: 'admin',
                loginTime: Date.now()
            };
            
            // KEY CHANGE: Using 'abupq_admin_session' instead of 'abupq_logged_in_user'
            localStorage.setItem('abupq_admin_session', JSON.stringify(adminSession));

            // 3. Redirect
            window.location.href = 'admin-dashboard.html';

        } catch (error) {
            console.error(error);
            showError("Access Denied: Invalid email or password");
        } finally {
            setLoading(false);
        }
    });

    function showError(msg) {
        if (msg) {
            errorBox.style.display = 'block';
            errorBox.textContent = msg;
        } else {
            errorBox.style.display = 'none';
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Verifying...';
        } else {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
        }
    }
  