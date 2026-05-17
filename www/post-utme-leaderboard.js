// --- AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) window.location.replace('/post-utme-login'); 
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');
let myEmail = "";

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
window.addEventListener('popstate', (e) => {
    window.location.replace('/post-utme-dashboard');
});

// --- DATA CRUNCHING LOGIC ---
async function fetchLeaderboard() {
    try {
        // Fetch only the columns we need to keep the payload light
        const { data, error } = await _sb.from('putme_exam_results')
            .select('user_email, session_id, score');

        if (error) throw error;

        if (!data || data.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // STEP 1: Group by session_id to get total scores per exam
        const sessionTotals = {};
        data.forEach(row => {
            if (!sessionTotals[row.session_id]) {
                sessionTotals[row.session_id] = { email: row.user_email, score: 0 };
            }
            sessionTotals[row.session_id].score += (row.score || 0);
        });

        // STEP 2: Group by user to find their MAX score
        const bestScores = {};
        Object.values(sessionTotals).forEach(session => {
            const email = session.email;
            if (!bestScores[email] || session.score > bestScores[email]) {
                bestScores[email] = session.score;
            }
        });

        // STEP 3: Convert to Array, Sort Descending, and Limit to Top 20
        const leaderboardArray = Object.keys(bestScores).map(email => ({
            email: email,
            score: bestScores[email]
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
        
        // Ensure name isn't too long for mobile screens
        if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';

        const initial = displayName.charAt(0).toUpperCase();

        container.innerHTML += `
        <div class="rank-card ${rankClass} ${isMeClass}">
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