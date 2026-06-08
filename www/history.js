// --- AUTH GUARD ---
let authUser = null;
(function protectPage() {
    const userString = localStorage.getItem('abupq_logged_in_user');
    if (!userString) window.location.replace('index.html'); 
    authUser = JSON.parse(userString);
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');
let groupedHistory = {}; // Stores all sessions mapped by session_id

document.addEventListener('DOMContentLoaded', () => {
    // --- THEME INHERITANCE ---
    const savedTheme = localStorage.getItem('sp_theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.body.classList.add('dark');
        document.documentElement.classList.add('dark');
    }
    
    history.replaceState({ view: 'view-list' }, '', '');
    fetchHistory();
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

// --- DATA FETCHING & GROUPING ---
async function fetchHistory() {
    try {
        // Fetch archived mock sessions AND course settings for the credit units
        const [historyRes, settingsRes] = await Promise.all([
            _sb.from('mock_sessions')
               .select('*')
               .eq('user_id', authUser.id)
               .eq('is_active', false) // Only fetch completed/archived sessions
               .order('created_at', { ascending: false }),
            _sb.from('course_settings').select('course_code, credit_units')
        ]);

        if (historyRes.error) throw historyRes.error;
        const data = historyRes.data;
        const settings = settingsRes.data;

        if (!data || data.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // Group the subjects by their shared session_id and calculate GPA
        data.forEach(row => {
            if (!groupedHistory[row.session_id]) {
                groupedHistory[row.session_id] = {
                    date: new Date(row.created_at),
                    totalQualityPoints: 0,
                    totalCredits: 0,
                    courses: []
                };
            }
            
            // --- Exact Math from mock-exam.js ---
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

            groupedHistory[row.session_id].totalQualityPoints += (points * credits);
            groupedHistory[row.session_id].totalCredits += credits;

            groupedHistory[row.session_id].courses.push({
                code: row.course_code,
                testScore: row.mode === 'exam' ? '-' : testVal,
                examScore: row.mode === 'test' ? '-' : examVal,
                total: `${totalScore}/${maxScore}`,
                grade: grade,
                points: points
            });
        });

        renderHistoryList();

    } catch (err) {
        console.error("Failed to load history:", err);
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <ion-icon name="warning-outline" style="font-size: 64px; opacity: 0.5; color: #ef4444;"></ion-icon>
            <p style="margin-top: 16px; font-size: 16px;">Failed to load history.<br>Please check your connection.</p>
        `;
    } finally {
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
        
        // Calculate the Final GPA for this specific session
        const finalGPA = session.totalCredits > 0 ? (session.totalQualityPoints / session.totalCredits).toFixed(2) : 0.00;
        const gpaColor = finalGPA >= 2.5 ? 'text-green' : 'text-red';
        
        container.innerHTML += `
        <div class="history-card" onclick="openDetails('${session.id}')">
            <div>
                <h3 style="margin: 0 0 4px 0; font-size: 16px;">Mock Exam</h3>
                <span style="font-size: 12px; color: var(--muted);">${formattedDate}</span>
            </div>
            <div style="text-align: right;">
                <div class="${gpaColor}" style="font-weight: bold; font-size: 18px;">${finalGPA}</div>
                <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Final GPA</div>
            </div>
        </div>`;
    });
}

// --- DETAIL VIEW RENDERING ---
window.openDetails = function(sessionId) {
    const session = groupedHistory[sessionId];

    // 1. Calculate and Render GPA Donut Chart
    const finalGPA = session.totalCredits > 0 ? (session.totalQualityPoints / session.totalCredits).toFixed(2) : 0.00;
    const gpaPercent = (finalGPA / 5.0) * 100;
    const gpaColor = finalGPA >= 2.5 ? '#10b981' : '#ef4444'; 
    
    const gpaChart = document.getElementById('gpaDonutChart');
    const gpaText = document.getElementById('gpaDonutText');
    gpaChart.style.background = `conic-gradient(${gpaColor} ${gpaPercent}%, #d1d5db 0)`;
    gpaText.innerText = finalGPA;
    gpaText.style.color = gpaColor;

    // 2. Render Subject Breakdown Table
    const tableBody = document.getElementById('detailsTableBody');
    tableBody.innerHTML = '';
    
    session.courses.forEach(course => {
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