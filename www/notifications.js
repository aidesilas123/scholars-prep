 const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let currentUser = null;

  document.addEventListener('DOMContentLoaded', async () => {
    // Check User Session
    const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
    
    if (!userData.id) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = userData;

    await loadNotifications();
  });

  async function loadNotifications() {
    const listEl = document.getElementById('notifList');
    const loadingEl = document.getElementById('loading');

    // Fetch notifications for this user
    const { data, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('receiver_id', currentUser.id)
        .order('created_at', { ascending: false });

    loadingEl.style.display = 'none';

    if (error) {
        console.error(error);
        listEl.innerHTML = '<div class="empty-state">Error loading notifications</div>';
        return;
    }

    if (!data || data.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <h3>All caught up!</h3>
                <p>You have no notifications at the moment.</p>
            </div>`;
        return;
    }

    // Render list
    listEl.innerHTML = data.map(n => {
        const date = new Date(n.created_at).toLocaleDateString() + ' ' + new Date(n.created_at).toLocaleTimeString();
        const unreadClass = n.is_read ? '' : 'unread';
        const newBadge = n.is_read ? '' : '<span class="badge-new">NEW</span>';

        return `
            <div class="notif-card ${unreadClass}">
                <div class="notif-header">
                    <div class="notif-title">${escapeHtml(n.title)} ${newBadge}</div>
                    <div class="notif-time">${date}</div>
                </div>
                <div class="notif-body">${escapeHtml(n.message)}</div>
            </div>
        `;
    }).join('');

    // Mark all as read after loading (Simple approach)
    // In a complex app, you might want to mark them read only when clicked
    markAsRead(data);
  }

  async function markAsRead(notifications) {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    
    if (unreadIds.length > 0) {
        await supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
