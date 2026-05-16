//  1. KEYS & CONFIG
    const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
    const supabaseKey = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 
    
    // Create separate client to avoid conflicts
    const paymentClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    // State
    let isPaymentActive = true; // Default to true to lock doors on bad network
    let subscriptionEndDate = null;
    let currentUserEmail = '';
    let currentUserId = '';
    let isStatusLoaded = false; // Tracks if Supabase has finished loading

    // --- 2. LOAD STATUS (OPTIMIZED) ---
    async function loadUserStatus() {
        try {
            const { data: { user } } = await paymentClient.auth.getUser();
            if (!user) {
                isStatusLoaded = true;
                return;
            }

            currentUserEmail = user.email;
            currentUserId = user.id;

            // Fetch Settings and Profile at the same time
            const [settingsRes, profileRes] = await Promise.all([
                paymentClient.from('app_settings').select('payment_active').single(),
                paymentClient.from('profiles').select('subscription_end').eq('id', user.id).maybeSingle()
            ]);

            if (settingsRes.data) {
                isPaymentActive = settingsRes.data.payment_active;
                const container = document.getElementById('payment-plans-container');
                if (container) container.style.display = isPaymentActive ? 'block' : 'none';
            }

            if (profileRes.data && profileRes.data.subscription_end) {
                subscriptionEndDate = new Date(profileRes.data.subscription_end);
            }
        } catch (error) {
            console.error("Network error loading status", error);
        } finally {
            isStatusLoaded = true; 
        }
    }
    loadUserStatus();

    // --- 3. MODAL LOGIC ---
    window.showAccessModal = function() {
        document.getElementById('access-modal').style.display = 'flex';
    }

    window.closeModalAndScroll = function() {
        document.getElementById('access-modal').style.display = 'none';
        document.getElementById('payment-plans-container').scrollIntoView({ behavior: 'smooth' });
    }

    // --- 4. CHECK ACCESS (SECURE & SMART) ---
    window.checkPremiumAccess = function(targetPage) {
        // If user clicks before Supabase finishes, wait for it
        if (!isStatusLoaded) {
            showLoading('Verifying access...');
            const checkInterval = setInterval(() => {
                if (isStatusLoaded) {
                    clearInterval(checkInterval);
                    hideLoading();
                    window.checkPremiumAccess(targetPage); 
                }
            }, 500);
            return; 
        }

        const today = new Date();
        
        // If Free Mode OR Valid Subscription -> Go
        if (!isPaymentActive || (subscriptionEndDate && subscriptionEndDate > today)) {
            window.location.href = targetPage;
            return;
        }
        
        // Else -> Show Modal
        setTimeout(() => {
            const loader = document.getElementById('globalLoading');
            if (loader) loader.style.display = 'none';
            
            showAccessModal();
        }, 50); 
    }

    // --- 5. PAYMENT TRIGGER (FIXED WITH METADATA) ---
    window.triggerPaystack = function(planType, price) {
        
        // Define Success Handler Separately to satisfy "valid function" check
        function onPaymentSuccess(response) {
            console.log("Ref:", response.reference);
            showLoading('Finalizing activation...');
            
            // Logic to save to DB
            let newDate = (planType === 'semester') ? '2026-06-30' : '2026-12-31';

            paymentClient.from('profiles').upsert({ 
                id: currentUserId,
                email: currentUserEmail,
                plan_type: planType,
                subscription_end: newDate
            }).then(({ error }) => {
                if (!error) {
                    hideLoading();
                    alert("Subscription Active!"); 
                    window.location.reload();
                } else {
                    hideLoading();
                    alert("Payment received! Your profile is updating. Please wait a moment.");
                    window.location.reload();
                }
            });
        }

        // Initialize Paystack
        const handler = PaystackPop.setup({
            key: PAYSTACK_KEY,
            email: currentUserEmail,
            amount: price * 100, // Kobo
            currency: 'NGN', 
            ref: '' + Math.floor((Math.random() * 1000000000) + 1),
            
            // DATA FOR THE WEBHOOK
            metadata: {
                user_id: currentUserId,
                email: currentUserEmail,
                plan_type: planType
            },

            callback: onPaymentSuccess, // <--- PASSING THE FUNCTION NAME ONLY
            onClose: function() {
                alert('Payment window closed.');
            }
        });

        handler.openIframe();
    }


    // --- APP UPDATE LOGIC ---
    window.addEventListener('load', function() {
        // Detect if running in the App
        const isApp = navigator.userAgent.toLowerCase().includes('wv');
        const updateBtn = document.getElementById('update-btn');

        if (isApp && updateBtn) {
            // User is in the app, so SHOW the update button
            // We use 'flex' or 'block' depending on your layout. 'flex' centers content better.
            updateBtn.style.display = 'flex'; 
        }
    });

    // Function to force a reload from the server (Updates the code)
    function forceUpdateApp() {
        if (confirm("Update the app now? This will refresh the page.")) {
            // Reloads the page ignoring the cache
            window.location.reload(true);
        }
    }

    /******************************************************************
     * CORE FUNCTIONS
     ******************************************************************/
    // --- SIDEBAR FUNCTIONS ---

function openSidebar() {
  document.getElementById("mySidebar").style.width = "250px";
}

function closeSidebar() {
  document.getElementById("mySidebar").style.width = "0";
}

// Close sidebar if user clicks outside of it on the main content
document.addEventListener('click', function(event) {
  const sidebar = document.getElementById('mySidebar');
  const menuBtn = document.querySelector('.menu-btn');
  
  // If sidebar is open, and click is NOT on sidebar and NOT on the menu button
  if (sidebar.style.width === "250px" && 
      !sidebar.contains(event.target) && 
      !menuBtn.contains(event.target)) {
    closeSidebar();
  }
});
    // Loading System
    // --- UPDATED LOADING UI FUNCTIONS ---
function showLoading(message = 'Loading...') {
  const loadingOverlay = document.getElementById('globalLoading');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
}

function hideLoading() {
  const loadingOverlay = document.getElementById('globalLoading');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

    // Navigation with loading
    function navigateWithLoading(event, url) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      if (!url) {
        console.error('No URL provided');
        hideLoading();
        return false;
      }
      
      showLoading('Navigating...');
      
      // Push state to history before navigation
      try {
        history.pushState({ loading: true }, '', window.location.href);
      } catch (e) {
        console.log('History push failed:', e);
      }
      
      // Use a timeout to ensure loading shows
      setTimeout(() => {
        try {
          window.location.href = url;
        } catch (error) {
          console.error('Navigation failed:', error);
          hideLoading();
          window.location.assign(url);
        }
      }, 100);
      
      return false;
    }

    // Modal and Dropdown Functions
    function toggleDropdown(dropdownId) {
      const dropdown = document.getElementById(dropdownId);
      dropdown.classList.toggle('show');
      
      // Close other dropdowns
      document.querySelectorAll('.dropdown-content').forEach(d => {
        if (d.id !== dropdownId) {
          d.classList.remove('show');
        }
      });
    }

    function closeAllDropdowns() {
      document.querySelectorAll('.dropdown-content').forEach(d => {
        d.classList.remove('show');
      });
    }

    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }
    // Open the modal
function openLogoutModal() {
    const modal = document.getElementById('logoutModal');
    modal.style.display = "flex"; // Shows the modal
}

// Close the modal
function closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    modal.style.display = "none"; // Hides the modal
}

// Actual Logout Trigger
function confirmLogout() {
    closeLogoutModal(); // Hide modal
    performLogout();    // Call your existing loading/logout function
}

// --- Your Existing Logic (No changes needed inside here) ---
async function logout() {
    // ... your existing logout code ...
    // ... localStorage.removeItem('abupq_logged_in_user'); ...
}

function performLogout() {
    if(typeof showLoading === 'function') {
        showLoading('Logging out...');
    }
    logout();
}

    /******************************************************************
     * SUPABASE INTEGRATION
     ******************************************************************/
    let supabaseClient = null; 
    let currentUser = null;
    let adminUserId = null;

    // Initialize Supabase
    function initSupabase() {
      if (window.supabase && window.supabase.createClient) {
        const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
        const supabaseKey = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
        
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('Supabase initialized');
      }
    }

    // Update user activity
    async function updateUserActivity() {
      if (!supabaseClient || !currentUser || !currentUser.id) return;
      
      try {
        await supabaseClient
          .from('users')
          .update({ 
            last_active: new Date().toISOString(),
            is_online: true 
          })
          .eq('id', currentUser.id);
      } catch (error) {
        console.error('Error updating activity:', error);
      }
    }

    // Find admin user
    async function findAdminUser() {
      if (!supabaseClient) return;
      
      try {
        const { data, error } = await supabaseClient
          .from('users')
          .select('id')
          .eq('email', 'admin@example.com') // Change to your admin email
          .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          adminUserId = data[0].id;
        }
      } catch (error) {
        console.error('Error finding admin user:', error);
      }
    }

    /******************************************************************
     * NOTIFICATION SYSTEM
     ******************************************************************/
    async function loadNotificationPreview() {
      if (!supabaseClient || !currentUser) return;
      
      try {
        const { data, error } = await supabaseClient
          .from('notifications')
          .select('*')
          .eq('receiver_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (error) throw error;
        
        const notificationPreview = document.getElementById('notificationPreview');
        if (!notificationPreview) return;
        
        if (!data || data.length === 0) {
          notificationPreview.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">No notifications</div>';
        } else {
          // FIX: Use is_read boolean check
          notificationPreview.innerHTML = data.map(notification => `
            <div class="notification-preview ${notification.is_read ? '' : 'unread'}" 
                 onclick="viewNotification('${notification.id}')">
              <div class="notification-title">${notification.title}</div>
              <div class="notification-message">${notification.message.length > 40 ? notification.message.substring(0, 40) + '...' : notification.message}</div>
              <div class="notification-time">${formatTime(notification.created_at)}</div>
            </div>
          `).join('');
        }
        
        // Update badge count
        // FIX: Count !is_read
        const unreadCount = data?.filter(n => !n.is_read).length || 0;
        const notificationBadge = document.getElementById('notificationBadge');
        if (notificationBadge) {
          if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notificationBadge.style.display = 'flex';
          } else {
            notificationBadge.style.display = 'none';
          }
        }
        
      } catch (error) {
        console.error('Error loading notification preview:', error);
        document.getElementById('notificationPreview').innerHTML = 
          '<div style="padding: 10px; color: #666; text-align: center;">Error loading notifications</div>';
      }
    }

    async function viewNotification(notificationId) {
      if (!supabaseClient) return;
      
      try {
        // Mark as read
        // FIX: Update is_read column
        await supabaseClient
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
        
        // Close dropdown and navigate
        closeAllDropdowns();
        navigateWithLoading(null, 'notifications.html');
        
      } catch (error) {
        console.error('Error viewing notification:', error);
      }
    }

    /******************************************************************
     * MESSAGE SYSTEM
     ******************************************************************/
    async function loadMessagePreview() {
      if (!supabaseClient || !currentUser) return;
      
      try {
        const { data, error } = await supabaseClient
          .from('messages')
          .select(`
            *,
            sender:users!sender_id(email)
          `)
          .eq('receiver_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (error) throw error;
        
        const messagePreview = document.getElementById('messagePreview');
        if (!messagePreview) return;
        
        if (!data || data.length === 0) {
          messagePreview.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">No messages</div>';
        } else {
          // FIX: Use is_read for messages too (matching admin panel logic)
          messagePreview.innerHTML = data.map(message => `
            <div class="message-preview ${message.is_read ? '' : 'unread'}" 
                 onclick="viewMessage('${message.id}')">
              <div class="message-sender">From: ${message.sender?.email || 'Admin'}</div>
              <div class="message-text">${message.message.length > 40 ? message.message.substring(0, 40) + '...' : message.message}</div>
              <div class="message-time">${formatTime(message.created_at)}</div>
            </div>
          `).join('');
        }
        
        // Update badge count
        // FIX: Count !is_read
        const unreadCount = data?.filter(m => !m.is_read).length || 0;
        const messageBadge = document.getElementById('messageBadge');
        if (messageBadge) {
          if (unreadCount > 0) {
            messageBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            messageBadge.style.display = 'flex';
          } else {
            messageBadge.style.display = 'none';
          }
        }
        
      } catch (error) {
        console.error('Error loading message preview:', error);
        document.getElementById('messagePreview').innerHTML = 
          '<div style="padding: 10px; color: #666; text-align: center;">Error loading messages</div>';
      }
    }

    async function viewMessage(messageId) {
      if (!supabaseClient) return;
      
      try {
        // Mark as read
        // FIX: Update is_read column
        await supabaseClient
          .from('messages')
          .update({ is_read: true })
          .eq('id', messageId);
        
        // Close dropdown and navigate
        closeAllDropdowns();
        navigateWithLoading(null, 'messages.html');
        
      } catch (error) {
        console.error('Error viewing message:', error);
      }
    }

    /******************************************************************
     * MESSAGE ADMIN FUNCTION
     ******************************************************************/
    function openMessageAdminModal() {
      document.getElementById('adminMessage').value = '';
      document.getElementById('messageAdminModal').style.display = 'flex';
      closeAllDropdowns();
    }

    async function sendMessageToAdmin() {
      const message = document.getElementById('adminMessage').value.trim();
      
      if (!message) {
        alert('Please enter a message');
        return;
      }
      
      if (!supabaseClient || !currentUser || !adminUserId) {
        alert('System not ready. Please try again.');
        return;
      }
      
      showLoading('Sending message...');
      
      try {
        // FIX: Use is_read instead of status
        const { error } = await supabaseClient
          .from('messages')
          .insert({
            sender_id: currentUser.id,
            receiver_id: adminUserId,
            message,
            is_read: false
          });
        
        if (error) throw error;
        
        hideLoading();
        alert('Message sent to admin successfully!');
        closeModal('messageAdminModal');
        
        // Reload message preview
        await loadMessagePreview();
        
      } catch (error) {
        console.error('Error sending message:', error);
        hideLoading();
        alert('Failed to send message. Please try again.');
      }
    }

    /******************************************************************
     * UTILITY FUNCTIONS
     ******************************************************************/
    function formatTime(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    }

    /******************************************************************
     * SETTINGS FUNCTIONS (from your original)
     ******************************************************************/
    function openProfileSettings() {
      const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
      document.getElementById('profileEmail').value = userData.email || '';
      
      const subscription = JSON.parse(localStorage.getItem('user_subscription') || '{"status":"active","expiry":"2024-12-31"}');
      document.getElementById('subscriptionStatus').textContent = subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);
      document.getElementById('subscriptionExpiry').textContent = `Expires: ${subscription.expiry}`;
      
      document.getElementById('profileModal').style.display = 'flex';
      closeAllDropdowns();
    }

    function openNotificationSettings() {
      const settings = JSON.parse(localStorage.getItem('notification_settings') || '{"cbt":true,"materials":true,"subscription":true,"scores":true"}');
      
      document.getElementById('notifyCBT').checked = settings.cbt;
      document.getElementById('notifyMaterials').checked = settings.materials;
      document.getElementById('notifySubscription').checked = settings.subscription;
      document.getElementById('notifyScores').checked = settings.scores;
      
      document.getElementById('notificationModal').style.display = 'flex';
      closeAllDropdowns();
    }

    function openThemeSettings() {
      const currentTheme = localStorage.getItem('selected_theme') || 'default';
      document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('onclick').includes(currentTheme)) {
          option.classList.add('selected');
        }
      });
      
      document.getElementById('themeModal').style.display = 'flex';
      closeAllDropdowns();
    }

    function openReportIssue() {
      document.getElementById('reportModal').style.display = 'flex';
      closeAllDropdowns();
    }

    function selectTheme(theme) {
      document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('selected');
      });
      event.target.classList.add('selected');
    }

    function applyTheme() {
      const selectedTheme = document.querySelector('.theme-option.selected').getAttribute('onclick').split("'")[1];
      localStorage.setItem('selected_theme', selectedTheme);
      showLoading('Applying theme...');
      setTimeout(() => {
        hideLoading();
        alert('Theme applied! Refresh to see changes.');
        closeModal('themeModal');
      }, 1000);
    }

    function saveNotificationSettings() {
      const settings = {
        cbt: document.getElementById('notifyCBT').checked,
        materials: document.getElementById('notifyMaterials').checked,
        subscription: document.getElementById('notifySubscription').checked,
        scores: document.getElementById('notifyScores').checked
      };
      
      localStorage.setItem('notification_settings', JSON.stringify(settings));
      showLoading('Saving preferences...');
      setTimeout(() => {
        hideLoading();
        alert('Notification preferences saved!');
        closeModal('notificationModal');
      }, 500);
    }

    function updateProfile() {
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (newPassword && newPassword !== confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
      
      if (newPassword) {
        showLoading('Updating profile...');
        setTimeout(() => {
          hideLoading();
          alert('Profile updated successfully!');
          closeModal('profileModal');
          // Clear password fields
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
        }, 1000);
      } else {
        closeModal('profileModal');
      }
    }

    function submitIssueReport() {
      const issue = document.getElementById('issueDescription').value;
      const issueType = document.getElementById('issueType').value;
      
      if (issue.trim()) {
        const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
        const reports = JSON.parse(localStorage.getItem('issue_reports') || '[]');
        
        reports.push({
          issue: issue,
          type: issueType,
          user: userData.email,
          timestamp: new Date().toISOString(),
          status: 'pending'
        });
        
        localStorage.setItem('issue_reports', JSON.stringify(reports));
        showLoading('Submitting report...');
        setTimeout(() => {
          hideLoading();
          alert('Issue reported successfully! We will address it soon.');
          closeModal('reportModal');
          document.getElementById('issueDescription').value = '';
        }, 1000);
      } else {
        alert('Please describe the issue');
      }
    }

    /******************************************************************
     * AUTHENTICATION
     ******************************************************************/
    async function logout() {
        const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
        if(userData.id && supabaseClient) {
            try {
                // Remove from database so they can log in again immediately
                await supabaseClient.from('active_sessions').delete().eq('user_id', userData.id);
            } catch(e) { console.log("Logout cleanup error", e); }
        }
        
        localStorage.removeItem('abupq_logged_in_user');
        
        if(supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        window.location.replace('/');
    }

    function performLogout() {
      showLoading('Logging out...');
      // Just call the main logout function
      logout();
    }

    /******************************************************************
     * INITIALIZATION
     ******************************************************************/
    window.addEventListener('DOMContentLoaded', async () => {
      hideLoading();
      
      // Check if user is logged in
      const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
      if (!userData.email) {
        window.location.replace('/');
        return;
      }
      
      // Display user email
     // Display user email (Desktop and Mobile Sidebar)
currentUser = userData;
const emailText = userData.email || 'User';
if(document.getElementById('userEmail')) 
    document.getElementById('userEmail').textContent = emailText;
if(document.getElementById('mobileUserEmail')) 
    document.getElementById('mobileUserEmail').textContent = emailText;
      
      // Initialize Supabase
      initSupabase();
      
      if (supabaseClient) {
        // Update user activity
        await updateUserActivity();
        
        // Find admin user
        await findAdminUser();
        
        // Load initial data
        await Promise.all([
          loadNotificationPreview(),
          loadMessagePreview()
        ]);
        
        // Setup realtime listeners
        setupRealtimeListeners();
      }
      
      // Load user settings
      loadUserSettings();
      
      // Setup navigation guards
      setupNavigationGuards();
      
      // Close dropdowns when clicking outside
      document.addEventListener('click', (event) => {
        if (!event.target.matches('.action-btn, .dropdown-content, .dropdown-content *')) {
          closeAllDropdowns();
        }
      });
    });

    function loadUserSettings() {
      const savedTheme = localStorage.getItem('selected_theme');
      if (savedTheme) {
        console.log('Applying theme:', savedTheme);
      }
    }

    // Setup realtime listeners
    function setupRealtimeListeners() {
      if (!supabaseClient || !currentUser) return;
      
      // Listen for new notifications
      supabaseClient
        .channel('user-notifications')
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `receiver_id=eq.${currentUser.id}` // Corrected filter based on your SQL
          },
          () => {
            loadNotificationPreview();
          }
        )
        .subscribe();
      
      // Listen for new messages
      supabaseClient
        .channel('user-messages')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `receiver_id=eq.${currentUser.id}`
          },
          () => {
            loadMessagePreview();
          }
        )
        .subscribe();
    }

    // Navigation guards setup
    function setupNavigationGuards() {
      // Intercept all anchor clicks for internal navigation
      document.querySelectorAll('a[href]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          // Only intercept internal links (not external or # links)
          if (href && !href.startsWith('#') && !href.startsWith('http') && 
              !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            
            // Check if it's a logout or special link
            if (href === 'index.html' || href.includes('logout')) {
              return; // Let it proceed normally
            }
            
            e.preventDefault();
            navigateWithLoading(e, href);
          }
        });
      });
    }

    // Handle browser back/forward navigation
   // --- MOBILE BACK BUTTON TRAP (EXIT MODAL) ---

// 1. Push an initial state into the browser history when the dashboard loads
window.addEventListener('DOMContentLoaded', () => {
    history.pushState({ page: 'dashboard' }, document.title, window.location.href);
});

// 2. Intercept the back button
window.addEventListener('popstate', function(event) {
    // Push the state back immediately so the app doesn't actually close
    history.pushState({ page: 'dashboard' }, document.title, window.location.href);
    
    // Close any open sidebars or dropdowns first
    closeSidebar();
    closeAllDropdowns();
    
    // Show the exit confirmation modal
    document.getElementById('exitConfirmModal').style.display = 'flex';
});

// 3. Modal Actions
window.cancelExit = function() {
    document.getElementById('exitConfirmModal').style.display = 'none';
};

window.confirmExit = function() {
    // If running inside Capacitor (Android/iOS App)
    if (window.Capacitor && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
    } else {
        // If on the web, kick them to login
        window.location.replace('/');
    }
};

    // Function to load dashboard content (if you need dynamic loading)
    function loadDashboardContent() {
      // You can add any dashboard-specific initialization here
      console.log('Dashboard loaded via browser navigation');
      
      // Ensure user is still logged in
      const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
      if (!userData.email) {
        window.location.replace('/');
      }
    }

    // Handle when page becomes visible again (user returns to tab)
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        // Page is visible again
        console.log('Page visible - checking state');
        hideLoading(); // Ensure loading is hidden
        
        // Check if we need to verify user session
        const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
        if (!userData.email && !window.location.href.includes('index.html')) {
          // User not logged in, redirect to login
          window.location.replace('/');
        }
      }
    });

    // Handle page load for browser navigation
    window.addEventListener('pageshow', function(event) {
      // Check if page was loaded from cache (browser back/forward)
      if (event.persisted) {
        console.log('Page loaded from cache (browser navigation)');
        hideLoading(); // Hide any lingering loading overlay
      }
    });

    // Handle page unload
    window.addEventListener('pagehide', function() {
      // Optional: Save state before leaving
      console.log('Page unloading');
    });

    // --- HEARTBEAT: Keep session alive ---
    setInterval(async () => {
        const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
        // FIX 3: Check supabaseClient existence here too
        if (userData.id && supabaseClient) {
            try {
                await supabaseClient
                    .from('active_sessions')
                    .upsert({ user_id: userData.id, last_seen: new Date().toISOString() });
            } catch(e) { console.log('Heartbeat error', e); }
        }
    }, 5 * 60 * 1000); // Update every 5 minutes

    // Make functions globally available
    window.navigateWithLoading = navigateWithLoading;
    window.toggleDropdown = toggleDropdown;
    window.openMessageAdminModal = openMessageAdminModal;
    window.sendMessageToAdmin = sendMessageToAdmin;
    window.viewNotification = viewNotification;
    window.viewMessage = viewMessage;
    window.logout = logout;
    window.performLogout = performLogout;
    window.openProfileSettings = openProfileSettings;
    window.openNotificationSettings = openNotificationSettings;
    window.openThemeSettings = openThemeSettings;
    window.openReportIssue = openReportIssue;
    window.selectTheme = selectTheme;
    window.applyTheme = applyTheme;
    window.saveNotificationSettings = saveNotificationSettings;
    window.updateProfile = updateProfile;
    window.submitIssueReport = submitIssueReport;
    window.closeModal = closeModal;
    // --- TRIGGER LOADING ON DASHBOARD CARDS & BUTTONS ---
document.addEventListener('DOMContentLoaded', () => {
    // Grab all the clickable cards on the dashboard
    const actionCards = document.querySelectorAll('.card');
    
    actionCards.forEach(card => {
        card.addEventListener('click', function() {
            // Don't show loading for the Premium plans container or WhatsApp
            if (!this.classList.contains('glass-btn') && !this.innerHTML.includes('WhatsApp')) {
                showLoading();
            }
        });
    });
});