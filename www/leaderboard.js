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

// We store the best session for each user globally so we can render it later
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

// --- DATA CRUNCHING LOGIC ---
async function fetchLeaderboard() {
    try {
        // 1. Fetch ALL required tables concurrently, including user_final_results
        const [historyRes, settingsRes, profilesRes, finalResultsRes] = await Promise.all([
            _sb.from('mock_sessions').select('session_id, user_id, course_code, mode, test_score, exam_score').eq('is_active', false),
            _sb.from('course_settings').select('course_code, credit_units'),
            _sb.from('profiles').select('id, full_name'),
            _sb.from('user_final_results').select('auth_id, course_code, gpa') // New Fetch for CPA
        ]);

        if (historyRes.error) throw historyRes.error;
        const data = historyRes.data;
        const settings = settingsRes.data;
        const profiles = profilesRes.data || [];
        const finalResults = finalResultsRes.data || [];

        if (!data || data.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // 2. Calculate actual CPA per user from user_final_results
        const userCPAData = {};
        finalResults.forEach(row => {
            const uid = row.auth_id;
            const credits = settings?.find(s => s.course_code === row.course_code)?.credit_units || 2;
            const courseGpa = parseFloat(row.gpa) || 0;
            
            if (!userCPAData[uid]) userCPAData[uid] = { totalPoints: 0, totalCredits: 0 };
            
            userCPAData[uid].totalPoints += (courseGpa * credits);
            userCPAData[uid].totalCredits += credits;
        });

        // 3. Group by session_id to calculate the GPA for EVERY session
        const sessionGPAs = {};
        data.forEach(row => {
            if (!sessionGPAs[row.session_id]) {
                sessionGPAs[row.session_id] = {
                    user_id: row.user_id,
                    totalQualityPoints: 0,
                    totalCredits: 0,
                    courses: []
                };
            }
            
            const credits = settings?.find(s => s.course_code === row.course_code)?.credit_units || 2;
            const testVal = row.mode === 'exam' ? 0 : (parseFloat(row.test_score) || 0);
            const examVal = row.mode === 'test' ? 0 : (parseFloat(row.exam_score) || 0);
            
            const totalScore = testVal + examVal;
            const maxScore = row.mode === 'both' ? 100 : (row.mode === 'test' ? 40 : 60);
            const percentage = (totalScore / maxScore) * 100;
            
            let grade = 'F', points = 0;
            if (percentage >= 70) { grade = 'A'; points = 5; }
            else if (percentage >= 60) { grade = 'B'; points = 4; }
            else if (percentage >= 50) { grade = 'C'; points = 3; }
            else if (percentage >= 45) { grade = 'D'; points = 2; }
            else if (percentage >= 40) { grade = 'E'; points = 1; }

            sessionGPAs[row.session_id].totalQualityPoints += (points * credits);
            sessionGPAs[row.session_id].totalCredits += credits;

            sessionGPAs[row.session_id].courses.push({
                code: row.course_code,
                testScore: row.mode === 'exam' ? '-' : testVal,
                examScore: row.mode === 'test' ? '-' : examVal,
                total: `${totalScore}/${maxScore}`,
                grade: grade,
                points: points
            });
        });

        // 4. Group by user to find their MAX GPA
        Object.values(sessionGPAs).forEach(session => {
            const finalGPA = session.totalCredits > 0 ? (session.totalQualityPoints / session.totalCredits) : 0.00;
            const uId = session.user_id;

            if (!bestSessionsData[uId] || finalGPA > bestSessionsData[uId].gpa) {
                const userProfile = profiles.find(p => p.id === uId);
                const rawName = userProfile ? userProfile.full_name : 'Student';
                
                let displayName = rawName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
                displayName = displayName.replace(/\b\w/g, l => l.toUpperCase()); 
                if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';

                // Resolve CPA
                const calculatedCPA = userCPAData[uId] && userCPAData[uId].totalCredits > 0 
                    ? (userCPAData[uId].totalPoints / userCPAData[uId].totalCredits) 
                    : 0.00;

                bestSessionsData[uId] = {
                    gpa: finalGPA,
                    cpa: calculatedCPA, // Map the CPA here
                    displayName: displayName,
                    courses: session.courses
                };
            }
        });

        // 5. Convert to Array, Sort Descending by Mock GPA, and Limit to Top 20
        const leaderboardArray = Object.keys(bestSessionsData).map(uId => ({
            userId: uId,
            name: bestSessionsData[uId].displayName,
            gpa: bestSessionsData[uId].gpa,
            cpa: bestSessionsData[uId].cpa
        }))
        .sort((a, b) => b.gpa - a.gpa)
        .slice(0, 20);

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
        const displayCPA = user.cpa > 0 ? user.cpa.toFixed(2) : '--'; // Fallback if no final results exist

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
                <div class="score-total">Mock GPA</div>
                <div style="font-size: 11px; font-weight: bold; color: var(--ion-color-primary); margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--table-border);">
                    CPA: ${displayCPA}
                </div>
            </div>
        </div>`;
    });
}

// --- DETAIL VIEW RENDERING (The Transcript) ---
window.openCompetitorTranscript = function(userId) {
    const sessionData = bestSessionsData[userId];
    if (!sessionData) return;

    // 1. Update Header Info
    document.getElementById('detailAvatar').innerText = sessionData.displayName.charAt(0).toUpperCase();
    document.getElementById('detailName').innerText = sessionData.displayName;

    // 2. Render GPA Donut Chart
    const gpaPercent = (sessionData.gpa / 5.0) * 100;
    const gpaColor = sessionData.gpa >= 2.5 ? '#10b981' : '#ef4444'; 
    
    const gpaChart = document.getElementById('gpaDonutChart');
    const gpaText = document.getElementById('gpaDonutText');
    gpaChart.style.background = `conic-gradient(${gpaColor} ${gpaPercent}%, #d1d5db 0)`;
    gpaText.innerText = sessionData.gpa.toFixed(2);
    gpaText.style.color = gpaColor;

    // 3. Render Subject Breakdown Table
    const tableBody = document.getElementById('detailsTableBody');
    tableBody.innerHTML = '';
    
    sessionData.courses.forEach(course => {
        const gradeColor = course.points >= 3 ? 'text-green' : 'text-red';
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