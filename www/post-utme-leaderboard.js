// --- AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) window.location.replace('post-utme-login.html'); 
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');
let myEmail = "";
window.bestSessionsData = {}; // Stores the detailed breakdown for each user globally

document.addEventListener('DOMContentLoaded', () => {
    // Theme Inheritance
    const isDark = localStorage.getItem('post_utme_theme') === 'dark' || localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    if (isDark) {
        document.body.classList.add('dark');
        document.body.classList.add('dark-mode');
    }
    
    // Auth Check for Highlighting
    const userString = localStorage.getItem('post_utme_logged_in_user');
    if (userString) {
        myEmail = JSON.parse(userString).email;
    }

    history.replaceState({ view: 'view-list' }, '', '');
    fetchLeaderboard();
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

// --- DATA CRUNCHING LOGIC ---
async function fetchLeaderboard() {
    try {
        // Fetch all necessary columns including subject breakdowns
        const { data, error } = await _sb.from('putme_exam_results')
            .select('user_email, session_id, score, subject_name, attempted');

        if (error) throw error;

        if (!data || data.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // STEP 1: Group by session_id to get total scores and collect subjects
        const sessionTotals = {};
        data.forEach(row => {
            if (!sessionTotals[row.session_id]) {
                sessionTotals[row.session_id] = { email: row.user_email, score: 0, subjects: [] };
            }
            sessionTotals[row.session_id].score += (row.score || 0);
            sessionTotals[row.session_id].subjects.push({
                name: row.subject_name,
                score: row.score || 0,
                attempted: row.attempted || 0
            });
        });

        // STEP 2: Group by user to find their MAX score and save the full session
        Object.values(sessionTotals).forEach(session => {
            const email = session.email;
            if (!window.bestSessionsData[email] || session.score > window.bestSessionsData[email].score) {
                window.bestSessionsData[email] = session; // Save entire breakdown
            }
        });

        // STEP 3: Convert to Array, Sort Descending, and Limit to Top 20
        const leaderboardArray = Object.keys(window.bestSessionsData).map(email => ({
            email: email,
            score: window.bestSessionsData[email].score
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

        renderLeaderboard(leaderboardArray);

    } catch (err) {
        console.error("Failed to load leaderboard:", err);
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').innerHTML = `<p>Failed to load data.</p>`;
    } finally {
        document.getElementById('leaderboardSkeleton').style.display = 'none';
    }
}

// --- RENDER UI ---
function renderLeaderboard(rankedUsers) {
    const container = document.getElementById('leaderboardContainer');
    container.innerHTML = '';

    rankedUsers.forEach((user, index) => {
        const rank = index + 1;
        let rankClass = '';
        if (rank === 1) rankClass = 'rank-1';
        if (rank === 2) rankClass = 'rank-2';
        if (rank === 3) rankClass = 'rank-3';

        const isMeClass = (user.email === myEmail) ? 'is-me' : '';

        // Extract Name from Email securely
        let displayName = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
        displayName = displayName.replace(/\b\w/g, l => l.toUpperCase()); 
        if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';

        const initial = displayName.charAt(0).toUpperCase();

        // ADDED onclick to open the transcript
        container.innerHTML += `
        <div class="rank-card ${rankClass} ${isMeClass}" onclick="openCompetitorTranscript('${user.email}')">
            <div class="rank-left">
                <div class="rank-badge">${rank}</div>
                <div class="avatar-circle">${initial}</div>
                <div class="user-info">
                    <p class="user-name">${displayName}</p>
                    <p class="user-tag">${user.email === myEmail ? 'You' : 'Aspirant'}</p>
                </div>
            </div>
            <div class="score-box">
                <div class="score-val">${user.score}</div>
                <div class="score-total">/400</div>
            </div>
        </div>`;
    });
}

// --- DETAIL VIEW RENDERING (The Transcript) ---
window.openCompetitorTranscript = function(email) {
    const sessionData = window.bestSessionsData[email];
    if (!sessionData) return;

    // Build the display name exactly like the card
    let displayName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
    displayName = displayName.replace(/\b\w/g, l => l.toUpperCase()); 
    if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';

    // Update Header
    document.getElementById('detailAvatar').innerText = displayName.charAt(0).toUpperCase();
    document.getElementById('detailName').innerText = displayName;

    // Render Donut Chart Math
    const scorePercent = Math.round((sessionData.score / 400) * 100);
    const scoreColor = scorePercent >= 50 ? '#10b981' : '#ef4444'; 
    
    const chartEl = document.getElementById('scoreDonutChart');
    const textEl = document.getElementById('scoreDonutText');
    chartEl.style.background = `conic-gradient(${scoreColor} ${scorePercent}%, #d1d5db 0)`;
    textEl.innerText = `${scorePercent}%`;
    textEl.style.color = scoreColor;

    // Render Subject Breakdown Table
    const tableBody = document.getElementById('detailsTableBody');
    tableBody.innerHTML = '';
    
    sessionData.subjects.forEach(course => {
        const gradeColor = course.score >= 50 ? 'text-green' : 'text-red';
        tableBody.innerHTML += `
            <tr>
                <td style="text-align: left; color: var(--muted);">${course.name}</td>
                <td>${course.attempted}/50</td>
                <td style="font-weight: bold; text-align: right;" class="${gradeColor}">${course.score}</td>
            </tr>
        `;
    });

    // Slide into view
    switchView('view-details');
};