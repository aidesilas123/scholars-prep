// --- AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    // Change '/' to 'index.html'
    if (!putmeUser) window.location.replace('index.html'); 
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');
let alertsData = []; 

document.addEventListener('DOMContentLoaded', () => {
    // Theme Inheritance
    const isDark = localStorage.getItem('post_utme_theme') === 'dark' || localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    if (isDark) {
        document.body.classList.add('dark');
        document.body.classList.add('dark-mode');
    }
    
    // Initialize Navigation Stack
    history.replaceState({ view: 'view-list' }, '', '');
    fetchAlerts();
});

// --- LINEAR NAVIGATION ENGINE ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.view-layer').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
    } else {
        window.location.replace('post-utme-dashboard.html');
    }
});

// --- DATA FETCHING ---
async function fetchAlerts() {
    try {
        const { data, error } = await _sb.from('putme_notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        alertsData = data;
        renderAlertsList();

        // Optional: Save the latest alert ID to local storage so the Dashboard knows the user has "seen" them
        localStorage.setItem('post_utme_last_seen_alert', data[0].id);

    } catch (err) {
        console.error("Failed to load alerts:", err);
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <ion-icon name="warning-outline" style="font-size: 64px; opacity: 0.5; color: #ef4444;"></ion-icon>
            <p style="margin-top: 16px; font-size: 16px;">Failed to load alerts.<br>Check your connection.</p>
        `;
    } finally {
        document.getElementById('alertSkeleton').style.display = 'none';
    }
}

function renderAlertsList() {
    const container = document.getElementById('alertListContainer');
    container.innerHTML = '';

    alertsData.forEach((alert, index) => {
        const dateObj = new Date(alert.created_at);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        container.innerHTML += `
        <div class="alert-card" onclick="openDetail(${index})">
            <div class="alert-icon-box">
                <ion-icon name="notifications"></ion-icon>
            </div>
            <div class="alert-content">
                <h3 class="alert-title">${alert.title}</h3>
                <div class="alert-preview">${alert.message.replace(/<[^>]*>?/gm, '')}</div>
                <span class="alert-time">${formattedDate}, ${formattedTime}</span>
            </div>
            <ion-icon name="chevron-forward-outline" style="color: var(--muted);"></ion-icon>
        </div>`;
    });
}

// --- DETAIL VIEW RENDERING ---
window.openDetail = function(index) {
    const alert = alertsData[index];
    const dateObj = new Date(alert.created_at);
    
    document.getElementById('detailDate').innerText = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' at ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('detailTitle').innerText = alert.title;
    
    // Parse Markdown safely if you decide to send bold text or lists from Supabase
    document.getElementById('detailMessage').innerHTML = window.marked ? marked.parse(alert.message) : alert.message;

    switchView('view-details');
};