// --- AUTH GUARD ---
let authUser = null;
(function protectPage() {
    const userString = localStorage.getItem('abupq_logged_in_user');
    if (!userString) window.location.replace('index.html'); 
    authUser = JSON.parse(userString);
})();

const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// We store the grouped data globally so we can render it later
let bestSessionsData = {}; 

document.addEventListener('DOMContentLoaded', () => {
    // Theme Inheritance
    if (localStorage.getItem('sp_theme') === 'dark') document.body.classList.add('dark');
    
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
        window.location.replace('dashboard.html');
    }
});

// --- FETCH & DISPLAY LOGIC ---
async function fetchLeaderboard() {
    try {
        // 1. Fetch finished results and user names directly
        const [resultsRes, usersRes] = await Promise.all([
            _sb.from('user_final_results').select('*'),
            _sb.from('users').select('id, full_name')
        ]);

        if (resultsRes.error) throw resultsRes.error;
        const results = resultsRes.data || [];
        const users = usersRes.data || [];

        if (results.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // 2. Group the courses by User ID
        const groupedUsers = {};
        
        results.forEach(row => {
            const uid = row.auth_id;
            
            if (!groupedUsers[uid]) {
                const userObj = users.find(u => u.id === uid);
                let displayName = userObj && userObj.full_name ? userObj.full_name : 'Student';
                
                // Format the name nicely
                displayName = displayName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
                displayName = displayName.replace(/\b\w/g, l => l.toUpperCase()); 
                if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';

                groupedUsers[uid] = {
                    userId: uid,
                    name: displayName,
                    courses: [],
                    sumGpa: 0,
                    totalScoreSum: 0
                };
            }

            // Push the course directly as it comes from the DB
            groupedUsers[uid].courses.push({
                code: row.course_code,
                testScore: row.test_score !== null ? row.test_score : '-',
                examScore: row.exam_score !== null ? row.exam_score : '-',
                total: `${row.total_score}/100`,
                grade: row.grade, 
                gpa: row.gpa
            });

            // Tally up values for sorting purposes
            groupedUsers[uid].sumGpa += parseFloat(row.gpa) || 0;
            groupedUsers[uid].totalScoreSum += parseInt(row.total_score) || 0;
        });

        // 3. Map to array, determine overall GPA, sort, and slice Top 10
        const leaderboardArray = Object.values(groupedUsers).map(user => {
            // Average the GPA from all their rows for the leaderboard display
            const overallGpa = user.courses.length > 0 ? (user.sumGpa / user.courses.length) : 0;
            user.finalGpa = overallGpa; // Save for the transcript modal
            
            return {
                userId: user.userId,
                name: user.name,
                gpa: overallGpa,
                tieBreaker: user.totalScoreSum
            };
        })
        .sort((a, b) => {
            if (b.gpa === a.gpa) return b.tieBreaker - a.tieBreaker; // Use total score if GPAs tie
            return b.gpa - a.gpa;
        })
        .slice(0, 10); // Fetch only 10 highest GPAs

        bestSessionsData = groupedUsers; // Store globally for clicking into transcripts
        renderLeaderboard(leaderboardArray);

    } catch (err) {
        console.error("Failed to load leaderboard:", err);
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').innerHTML = `<p>Failed to load data. Check connection.</p>`;
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

        const isMeClass = (user.userId === authUser.id) ? 'is-me' : '';
        const initial = user.name.charAt(0).toUpperCase() || 'S';
        const displayGPA = user.gpa.toFixed(2);

        container.innerHTML += `
        <div class="rank-card ${rankClass} ${isMeClass}" onclick="openCompetitorTranscript('${user.userId}')">
            <div class="rank-left">
                <div class="rank-badge">${rank}</div>
                <div class="avatar-circle">${initial}</div>
                <div class="user-info">
                    <p class="user-name">${user.name}</p>
                    <p class="user-tag">${user.userId === authUser.id ? 'You' : 'Undergraduate'}</p>
                </div>
            </div>
            <div class="score-box">
                <div class="score-val">${displayGPA}</div>
                <div class="score-total">GPA</div>
            </div>
        </div>`;
    });
}

// --- DETAIL VIEW RENDERING (The Transcript) ---
window.openCompetitorTranscript = function(userId) {
    const userData = bestSessionsData[userId];
    if (!userData) return;

    // 1. Update Header Info
    document.getElementById('detailAvatar').innerText = userData.name.charAt(0).toUpperCase();
    document.getElementById('detailName').innerText = userData.name;

    // 2. Render GPA Donut Chart
    const displayGpa = userData.finalGpa;
    const gpaPercent = (displayGpa / 5.0) * 100;
    const gpaColor = displayGpa >= 2.5 ? '#10b981' : '#ef4444'; 
    
    const gpaChart = document.getElementById('gpaDonutChart');
    const gpaText = document.getElementById('gpaDonutText');
    gpaChart.style.background = `conic-gradient(${gpaColor} ${gpaPercent}%, #d1d5db 0)`;
    gpaText.innerText = displayGpa.toFixed(2);
    gpaText.style.color = gpaColor;

    // 3. Render Subject Breakdown Table
    const tableBody = document.getElementById('detailsTableBody');
    tableBody.innerHTML = '';
    
    userData.courses.forEach(course => {
        // Set color strictly based on the DB's grade
        const isGoodGrade = ['A', 'A+', 'B', 'B+'].includes(course.grade);
        const gradeColor = isGoodGrade ? 'text-green' : 'text-red';
        
        tableBody.innerHTML += `
            <tr>
                <td style="text-align: left; color: var(--muted);">${course.code}</td>
                <td>${course.testScore}</td>
                <td>${course.examScore}</td>
                <td style="font-weight: bold;">${course.total}</td>
                <td style="font-weight: bold;" class="${gradeColor}">${course.grade}</td>
            </tr>
        `;
    });

    // Slide into view
    switchView('view-details');
};