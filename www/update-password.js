// Initialize Supabase Client
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
const supabaseKey = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Dynamically load Ionicons
const ionModule = document.createElement('script');
ionModule.type = 'module';
ionModule.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js';
document.head.appendChild(ionModule);

const ionNoModule = document.createElement('script');
ionNoModule.setAttribute('nomodule', '');
ionNoModule.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js';
document.head.appendChild(ionNoModule);

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('updatePasswordForm');
    const btn = document.getElementById('updateBtn');

    // Dynamically create the Modal UI
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(12, 20, 40, 0.6); z-index:100; align-items:center; justify-content:center; backdrop-filter:blur(5px); transition: opacity 0.3s ease;';
    
    const modalBox = document.createElement('div');
    modalBox.style.cssText = 'background:#ffffff; padding:30px; border-radius:18px; text-align:center; max-width:90%; width:340px; box-shadow:0 15px 35px rgba(0,0,0,0.2); font-family:Inter, sans-serif;';
    
    const modalIcon = document.createElement('div');
    modalIcon.style.cssText = 'margin-bottom: 10px; display: flex; justify-content: center;';
    
    const modalMessage = document.createElement('p');
    modalMessage.style.cssText = 'color:#21324a; font-size:16px; font-weight:600; margin-bottom:24px; margin-top:0;';
    
    const modalBtn = document.createElement('button');
    modalBtn.style.cssText = 'background: linear-gradient(180deg, #044908, #02270a); color:#fff; border:none; padding:12px 20px; border-radius:10px; cursor:pointer; font-weight:600; width:100%; font-size:15px;';
    
    modalBox.appendChild(modalIcon);
    modalBox.appendChild(modalMessage);
    modalBox.appendChild(modalBtn);
    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    // Modal control function
    function showModal(message, type = 'error') {
        if(type === 'success') {
            modalIcon.innerHTML = '<ion-icon name="checkmark-circle" style="color: #044908; font-size: 56px;"></ion-icon>';
            modalMessage.innerText = 'Done, open app and login.';
            modalBtn.innerText = 'Okay';
            
            // Redirect to the web login just in case they are on a PC
            modalBtn.onclick = () => {
                window.location.href = '/login.html'; 
            };
        } else {
            modalIcon.innerHTML = '<ion-icon name="alert-circle" style="color: #d32f2f; font-size: 56px;"></ion-icon>';
            modalMessage.innerText = message;
            modalBtn.innerText = 'Try Again';
            modalBtn.onclick = () => modalOverlay.style.display = 'none';
        }
        
        modalOverlay.style.display = 'flex';
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        // Basic Validation
        if (newPassword !== confirmPassword) {
            showModal('Passwords do not match. Please ensure both fields are identical.');
            return;
        }

        if (newPassword.length < 6) {
            showModal('Password must be at least 6 characters long.');
            return;
        }

        // Loading state
        btn.disabled = true;
        btn.innerHTML = '<ion-icon name="sync" style="animation: spin 1s linear infinite; margin-right: 8px;"></ion-icon> Updating...';
        btn.style.opacity = '0.7';

        // Add CSS for the loading spinner
        const style = document.createElement('style');
        style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);

        try {
            // Call Supabase to update the user's password
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                showModal(error.message || 'Failed to update password. Your session may have expired.');
            } else {
                showModal('', 'success'); // The text is hardcoded in the showModal function
                form.reset();
            }
        } catch (err) {
            showModal('An unexpected error occurred. Please check your connection and try again.');
        } finally {
            // Reset button state
            btn.disabled = false;
            btn.innerText = 'Update Password';
            btn.style.opacity = '1';
        }
    });
});