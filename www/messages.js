
    // Clean Supabase initialization
    const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    
    // FIX: Renamed variable to 'supabaseClient' to avoid conflict with window.supabase
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    let currentUser = null;
    let adminUserId = null;
    let adminUserDetails = null;
    let pollingInterval = null;
    
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('Messages page loading...');
        
        // Get user from localStorage
        const storageKey = 'abupq_logged_in_user';
        const rawData = localStorage.getItem(storageKey);
        console.log('1. Raw Storage Data:', rawData);

        const userData = JSON.parse(rawData || '{}');
        console.log('2. Parsed User Data:', userData);
        
        if (!userData.email || !userData.id) {
            console.error('❌ VALIDATION FAILED: Missing email or id');
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = userData;
        console.log('Current user:', currentUser.email);
        
        // Find admin user using admin_users table
        await findAdminUser();
        
        if (!adminUserId) {
            showError('Admin user not found. Please contact support.');
            return;
        }
        
        // Load messages
        await loadMessages();
        
        // Setup polling for new messages
        startMessagePolling();
        
        // Setup event listeners
        setupEventListeners();
        
        document.getElementById('chatInput').focus();
        
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        });
    });
    
    async function findAdminUser() {
        try {
            console.log('Looking for admin user from admin_users table...');
            
            // Step 1: Try to get active admin from admin_users table
            const { data: adminData, error: adminError } = await supabaseClient
                .from('admin_users')
                .select(`
                    user_id,
                    is_active,
                    users:user_id(id, email, name)
                `)
                .eq('is_active', true)
                .neq('user_id', currentUser.id)
                .limit(1)
                .maybeSingle();
            
            console.log('Admin query result from admin_users table:', { adminData, adminError });
            
            if (!adminError && adminData && adminData.users) {
                adminUserId = adminData.user_id;
                adminUserDetails = adminData.users;
                console.log('✅ Found admin from admin_users table:', adminUserDetails);
                return;
            }
            
            // Step 2: If admin_users table doesn't exist or has no active admins,
            // check the users table for backward compatibility
            console.log('No active admin in admin_users table, checking users table...');
            
            const { data: legacyAdmin, error: legacyError } = await supabaseClient
                .from('users')
                .select('id, email, name, is_admin')
                .eq('is_admin', true)
                .neq('id', currentUser.id)
                .limit(1)
                .maybeSingle();
            
            console.log('Legacy admin query result:', { legacyAdmin, legacyError });
            
            if (!legacyError && legacyAdmin) {
                adminUserId = legacyAdmin.id;
                adminUserDetails = legacyAdmin;
                console.log('✅ Found legacy admin from users table:', adminUserDetails);
                
                // Add this admin to admin_users table for future use
                await addAdminToTable(legacyAdmin.id);
                return;
            }
            
            // Step 3: Final fallback - get oldest user (excluding current user)
            console.log('No admin found, using oldest user as fallback...');
            
            const { data: oldestUser, error: oldestError } = await supabaseClient
                .from('users')
                .select('id, email, name')
                .neq('id', currentUser.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            
            if (!oldestError && oldestUser) {
                adminUserId = oldestUser.id;
                adminUserDetails = oldestUser;
                console.log('✅ Using oldest user as admin:', oldestUser);
                
                // Add this admin to admin_users table
                await addAdminToTable(oldestUser.id);
                return;
            }
            
            console.error('❌ No admin user could be found at all');
            return null;
            
        } catch (error) {
            console.error('Error finding admin user:', error);
            return null;
        }
    }
    
    async function addAdminToTable(userId) {
        try {
            // Check if admin already exists in admin_users table
            const { data: existingAdmin, error: checkError } = await supabaseClient
                .from('admin_users')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
                console.error('Error checking admin existence:', checkError);
                return;
            }
            
            // If admin doesn't exist, add them
            if (!existingAdmin) {
                const { error: insertError } = await supabaseClient
                    .from('admin_users')
                    .insert([{ 
                        user_id: userId,
                        is_active: true
                    }]);
                
                if (insertError) {
                    console.error('Error adding admin to table:', insertError);
                } else {
                    console.log('✅ Admin added to admin_users table:', userId);
                }
            }
        } catch (error) {
            console.error('Error in addAdminToTable:', error);
        }
    }
    
    async function loadMessages() {
        const chatMessages = document.getElementById('chatMessages');
        
        try {
            // Only show loading on initial load, not polling
            if(chatMessages.innerHTML.includes('Loading messages')) {
                 chatMessages.innerHTML = '<div class="loading">Loading messages...</div>';
            }
            
            if (!adminUserId) {
                showError('Admin not available');
                return;
            }
            
            console.log(`Loading messages between user ${currentUser.id} and admin ${adminUserId}`);
            
            // Get messages between current user and admin
            // Using a more precise query to avoid getting unrelated messages
            const { data, error } = await supabaseClient
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${adminUserId}),and(sender_id.eq.${adminUserId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            
            console.log(`Retrieved ${data ? data.length : 0} messages`);
            
            // Mark messages from admin as read
            await markMessagesAsRead(data || []);
            
            // Render messages
            renderMessages(data || []);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            if(chatMessages.innerHTML.includes('Loading messages')) {
                showError('Error loading messages. Please try again.');
            }
        }
    }
    
    async function markMessagesAsRead(messages) {
        try {
            const unreadMessages = messages.filter(msg => 
                msg.sender_id === adminUserId && !msg.is_read
            );
            
            if (unreadMessages.length > 0) {
                const messageIds = unreadMessages.map(msg => msg.id);
                console.log(`Marking ${messageIds.length} messages as read`);
                
                const { error } = await supabaseClient
                    .from('messages')
                    .update({ is_read: true })
                    .in('id', messageIds);
                
                if (error) console.error('Error marking messages as read:', error);
                else console.log('✅ Messages marked as read');
            }
        } catch (error) {
            console.error('Error in markMessagesAsRead:', error);
        }
    }
    
    function renderMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (!messages || messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="empty-state">
                    <h3>No messages yet</h3>
                    <p>Start a conversation with the admin!</p>
                </div>
            `;
            return;
        }
        
        // Save scroll position
        const isScrolledToBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 50;

        chatMessages.innerHTML = messages.map(msg => {
            const isUser = msg.sender_id === currentUser.id;
            const time = new Date(msg.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Use admin name if available, otherwise just "Admin"
            const senderName = isUser ? 'You' : (adminUserDetails?.name || 'Admin');
            
            return `
                <div class="message ${isUser ? 'sent' : 'received'}">
                    <div class="message-sender">${senderName}</div>
                    <div>${escapeHtml(msg.message || '')}</div>
                    <div class="message-time">
                        ${time}
                        ${isUser ? `<span class="message-status">${msg.is_read ? '✓✓ Read' : '✓ Sent'}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Only scroll to bottom if previously at bottom or first load
        if (isScrolledToBottom || chatMessages.scrollTop === 0) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    async function sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) {
            alert('Please enter a message');
            return;
        }
        
        if (!adminUserId) {
            alert('Cannot send message. Admin not configured.');
            return;
        }
        
        const sendBtn = document.getElementById('sendBtn');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '...';
        chatInput.disabled = true;
        
        try {
            const newMessage = {
                sender_id: currentUser.id,
                sender_role: 'user',
                receiver_id: adminUserId,
                receiver_role: 'admin',
                message: message,
                is_read: false,
                created_at: new Date().toISOString()
            };
            
            console.log('Sending message:', newMessage);
            
            const { error } = await supabaseClient
                .from('messages')
                .insert([newMessage]);
            
            if (error) throw error;
            
            console.log('✅ Message sent successfully');
            chatInput.value = '';
            
            // Reload messages to show the new one
            await loadMessages();
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
            chatInput.disabled = false;
            chatInput.focus();
        }
    }
    
    function setupEventListeners() {
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        
        sendBtn.addEventListener('click', sendChatMessage);
        
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendChatMessage();
            }
        });
    }
    
    function startMessagePolling() {
        // Clear any existing interval
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        // Poll for new messages every 3 seconds
        pollingInterval = setInterval(async () => {
            try {
                // Check if window is visible to save resources
                if (!document.hidden) {
                    await loadMessages();
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000);
    }
    
    function showError(message) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="empty-state">
                <h3>⚠️ Connection Issue</h3>
                <p>${escapeHtml(message)}</p>
                <div style="margin-top: 20px;">
                    <button onclick="location.reload()" style="
                        padding: 10px 20px; 
                        background: #4CAF50; 
                        color: white; 
                        border: none; 
                        border-radius: 5px; 
                        cursor: pointer; 
                        margin-right: 10px;">
                        Refresh Page
                    </button>
                    <button onclick="window.location.href='dashboard.html'" style="
                        padding: 10px 20px; 
                        background: #666; 
                        color: white; 
                        border: none; 
                        border-radius: 5px; 
                        cursor: pointer;">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        `;
    }
    
    // Utility function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
  