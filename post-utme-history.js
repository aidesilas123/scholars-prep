// --- AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) {
        window.location.replace('/'); 
    }
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');
let groupedHistory = {}; // Stores all sessions mapped by session_id

document.addEventListener('DOMContentLoaded', () => {
    // --- BULLETPROOF THEME INHERITANCE ---
    const isDark = 
        localStorage.getItem('post_utme_theme') === 'dark' || 
        localStorage.getItem('theme') === 'dark' || 
        localStorage.getItem('abupq_theme') === 'dark' ||
        document.documentElement.classList.contains('dark');
        
    if (isDark) {
        document.body.classList.add('dark');
        document.body.classList.add('dark-mode'); // Added both to ensure CSS catches it
    }
    
    // Initialize Navigation Stack
    history.replaceState({ view: 'view-list' }, '', '');
    fetchHistory();
});

// --- LINEAR NAVIGATION ENGINE ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.view-layer').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) {
        history.pushState({ view: viewId }, '', '');
    }
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
    } else {
        window.location.replace('/post-utme-dashboard');
    }
});

// --- DATA FETCHING & GROUPING ---
async function fetchHistory() {
    try {
        // Safely parse the user object
        const userString = localStorage.getItem('post_utme_logged_in_user');
        if (!userString) throw new Error("User not logged in.");
        
        const userObj = JSON.parse(userString);
        const authEmail = userObj.email;

        if (!authEmail) throw new Error("No email found in session.");

        const { data, error } = await _sb.from('putme_exam_results')
            .select('*')
            .eq('user_email', authEmail)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // If no data exists, show the empty state natively
        if (!data || data.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // Group the 4 subjects by their shared session_id
        data.forEach(row => {
            if (!groupedHistory[row.session_id]) {
                groupedHistory[row.session_id] = {
                    date: new Date(row.created_at),
                    totalScore: 0,
                    timeSpentSec: row.time_spent_seconds || 0, 
                    subjects: []
                };
            }
            groupedHistory[row.session_id].totalScore += (row.score || 0);
            groupedHistory[row.session_id].subjects.push({
                name: row.subject_name,
                score: row.score || 0,
                attempted: row.attempted || 0
            });
        });

        renderHistoryList();

    } catch (err) {
        console.error("Failed to load history:", err);
        
        // Show a visual error state instead of a blank screen
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <ion-icon name="warning-outline" style="font-size: 64px; opacity: 0.5; color: var(--ion-color-danger);"></ion-icon>
            <p style="margin-top: 16px; font-size: 16px;">Failed to load history.<br>Please check your connection.</p>
        `;
    } finally {
        // THE FIX: This absolutely guarantees the skeleton dies, even if the DB crashes
        document.getElementById('historySkeleton').style.display = 'none';
    }
}

function renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';

    // Convert grouped object to array and sort by newest first
    const sessions = Object.keys(groupedHistory).map(id => ({ id, ...groupedHistory[id] }));
    sessions.sort((a, b) => b.date - a.date);

    sessions.forEach(session => {
        const formattedDate = session.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
        const scoreColor = session.totalScore >= 200 ? 'text-green' : 'text-red';
        
        container.innerHTML += `
        <div class="history-card" onclick="openDetails('${session.id}')">
            <div>
                <h3 style="margin: 0 0 4px 0; font-size: 16px;">Mock Exam</h3>
                <span style="font-size: 12px; color: var(--muted);">${formattedDate}</span>
            </div>
            <div style="text-align: right;">
                <div class="${scoreColor}" style="font-weight: bold; font-size: 18px;">${session.totalScore}/400</div>
                <ion-icon name="chevron-forward-outline" style="color: var(--muted); margin-top: 4px;"></ion-icon>
            </div>
        </div>`;
    });
}

// --- DETAIL VIEW RENDERING ---
window.openDetails = function(sessionId) {
    const session = groupedHistory[sessionId];
    const maxDurationSec = 7200; // 2 hours

    // 1. Calculate and Render Pie Charts
    const scorePercent = Math.round((session.totalScore / 400) * 100);
    const scoreColor = scorePercent >= 50 ? '#10b981' : '#ef4444'; // Green or Red
    
    const scoreChart = document.getElementById('scoreDonutChart');
    const scoreText = document.getElementById('scoreDonutText');
    scoreChart.style.background = `conic-gradient(${scoreColor} ${scorePercent}%, #d1d5db 0)`;
    scoreText.innerText = `${scorePercent}%`;
    scoreText.style.color = scoreColor;
    
    // Safety check for time to prevent NaN errors if a record is missing it
    const safeTimeSpent = session.timeSpentSec || 0;
    const timePercent = Math.round((safeTimeSpent / maxDurationSec) * 100);
    document.getElementById('timeDonutChart').style.background = `conic-gradient(#f59e0b ${timePercent}%, #d1d5db 0)`;
    document.getElementById('timeDonutText').innerText = `${timePercent}%`;

    // 2. Render Totals
    const totalScoreEl = document.getElementById('finalTotalScore');
    totalScoreEl.innerText = `${session.totalScore}/400`;
    totalScoreEl.className = session.totalScore >= 200 ? 'text-green' : 'text-red';
    
    document.getElementById('finalTimeSpent').innerText = `${Math.round(safeTimeSpent / 60)} min`;

    // 3. Render Subject Breakdown Table
    const tableBody = document.getElementById('detailsTableBody');
    tableBody.innerHTML = '';
    
    session.subjects.forEach(sub => {
        const subScoreColor = sub.score >= 50 ? 'text-green' : 'text-red';
        tableBody.innerHTML += `
            <tr>
                <td style="text-align: left; color: var(--muted);">${sub.name}</td>
                <td>${sub.attempted}/50</td>
                <td style="text-align: right;" class="${subScoreColor}">${sub.score}</td>
            </tr>
        `;
    });

    // Slide into view
    switchView('view-details');
};