
  // This ensures the Supabase library is fully loaded before we use it
  window.onload = function() {
    const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const updateForm = document.getElementById('updatePasswordForm');
    const statusDiv = document.getElementById('status');

    updateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      const btn = document.getElementById('updateBtn');

      if (newPassword !== confirmPassword) {
        statusDiv.style.color = "#ffcccc";
        statusDiv.textContent = "Passwords do not match!";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Updating...";

      const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });

      if (error) {
        statusDiv.style.color = "#ffcccc";
        statusDiv.textContent = error.message;
        btn.disabled = false;
        btn.textContent = "Update Password";
      } else {
        statusDiv.style.color = "#ccffcc";
        statusDiv.textContent = "Password updated! Redirecting to login...";
        
        // Clear everything to ensure a clean new login
        localStorage.clear();
        
        setTimeout(() => {
          window.location.href = 'index.html'; 
        }, 3000);
      }
    });
  };
