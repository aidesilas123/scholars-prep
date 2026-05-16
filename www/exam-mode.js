// --- AUTH GUARD & INIT ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) {
        window.location.replace('/'); 
    }
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('post_utme_theme') === 'dark') document.body.classList.add('dark');
    
    // Set initial history state to hook into hardware back button
    history.replaceState({ view: 'view-selection' }, '', '');
    loadExamSetup();
});

// --- STATE ---
let subjectsData = [];
let examData = {}; 
let activeSubjectId = null;
let durationSec = 7200; // 2 Hours default
let maxDurationSec = 7200;
let qLimitPerSubject = 50;
let timerId = null;
let globalSessionId = null;

function showLoading(show, text="Loading...") {
    document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
    document.getElementById('loadText').textContent = text;
}

// Linear Navigation Engine
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) {
        history.pushState({ view: viewId }, '', '');
    }
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        // Prevent backing out of the exam once started
        if (e.state.view === 'view-selection' && Object.keys(examData).length > 0 && timerId !== null) {
            history.pushState({ view: 'view-exam' }, '', '');
            confirmDashboardReturn();
        } else {
            switchView(e.state.view, false);
        }
    } else {
        window.location.replace('/post-utme-dashboard');
    }
});

// --- MATH FIXER ---
function fixMathText(text) {
    if (!text) return "";
    let fixed = text;
    const mathWords = ["frac", "sqrt", "int", "lim", "sum", "infty", "times", "div", "pm", "sin", "cos", "tan", "theta", "pi", "alpha"];
    mathWords.forEach(word => {
        const regex = new RegExp(`(?<!\\\\)\\b${word}\\b`, 'g');
        fixed = fixed.replace(regex, `\\${word}`);
    });
    fixed = fixed.replace(/\\\\/g, "\\");
    const isMathSymbol = /[\\][a-zA-Z]+/.test(fixed) || /[=^_{}<>]/.test(fixed);
    const hasDelimiters = fixed.includes("$") || fixed.includes("\\(") || fixed.includes("\\[");
    if (isMathSymbol && !hasDelimiters && fixed.length < 50) return `\\( ${fixed} \\)`;
    return fixed;
}

// --- 1. LOAD DATA ---
async function loadExamSetup() {
    showLoading(true, "Configuring Exam Environment...");
    
    // Fetch Settings
    const { data: settings } = await _sb.from('putme_exam_setting').select('*').limit(1).single();
    if (settings) {
        durationSec = (settings.duration_minutes || 120) * 60;
        maxDurationSec = durationSec;
        qLimitPerSubject = settings.question_limit || 50;
    }
    
    document.getElementById('instQCount').innerText = qLimitPerSubject;
    document.getElementById('instTime').innerText = `${Math.round(durationSec/60)} Minutes`;

    // Fetch Subjects & Available Years
    const { data: subjects } = await _sb.from('putme_subjects').select('*');
    const { data: qYears } = await _sb.from('putme_questions').select('subject_id, year');
    
    const container = document.getElementById('subjectListContainer');
    container.innerHTML = '';
    
    if(subjects) {
        subjects.forEach(sub => {
            subjectsData.push(sub);
            
            let yearsHTML = '<ion-select-option value="random">Random</ion-select-option>';
            if (qYears) {
                const subYears = [...new Set(qYears.filter(q => q.subject_id === sub.id).map(q => q.year))].sort((a,b)=>b-a);
                yearsHTML += subYears.map(y => `<ion-select-option value="${y}">${y}</ion-select-option>`).join('');
            }

            container.innerHTML += `
            <ion-card class="subject-card" id="card-${sub.id}" onclick="toggleSubject(${sub.id})">
                <ion-item lines="none" style="--background: transparent; cursor: pointer;">
                    <ion-icon name="${sub.icon}" slot="start" color="primary"></ion-icon>
                    <ion-label style="font-weight: bold;">${sub.name}</ion-label>
                    <ion-checkbox slot="end" id="chk-${sub.id}" style="pointer-events: none;"></ion-checkbox>
                </ion-item>
                <div class="config-area" onclick="event.stopPropagation()">
                    <ion-item fill="outline" style="--border-radius: 6px;">
                        <ion-label position="stacked">Select Year</ion-label>
                        <ion-select id="yr-${sub.id}" value="random">${yearsHTML}</ion-select>
                    </ion-item>
                </div>
            </ion-card>`;
        });
    }
    showLoading(false);
}

window.toggleSubject = function(id) {
    const card = document.getElementById(`card-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    
    // Enforce max 4 subjects
    const currentSelected = document.querySelectorAll('.subject-card.selected').length;
    if (!card.classList.contains('selected') && currentSelected >= 4) {
        alert("You can only select exactly 4 subjects for a full exam.");
        return;
    }

    card.classList.toggle('selected');
    chk.checked = card.classList.contains('selected');
    document.getElementById('selCount').innerText = document.querySelectorAll('.subject-card.selected').length;
};

function goToInstructions() {
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    if(selectedCards.length !== 4) {
        alert("Please select exactly 4 subjects to proceed.");
        return;
    }
    switchView('view-instructions');
}

// --- 2. START EXAM ---
async function startExam() {
    showLoading(true, "Generating Exam...");
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    
    examData = {};
    const tabsContainer = document.getElementById('examSubjectTabs');
    tabsContainer.innerHTML = '';
    
    // Generate unified session ID for database
    globalSessionId = `EXAM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    let isFirst = true;
    for(let card of selectedCards) {
        const subId = card.id.split('-')[1];
        const subName = subjectsData.find(s => s.id == subId).name;
        const yearOpt = document.getElementById(`yr-${subId}`).value;

        // Fetch query logic
        let query = _sb.from('putme_questions').select('*').eq('subject_id', subId);
        if (yearOpt !== 'random') {
            query = query.eq('year', yearOpt);
        }
        
        // Fetch extra to allow for random shuffling if 'random' is selected
        const fetchLimit = yearOpt === 'random' ? 200 : qLimitPerSubject;
        const { data: rawData } = await query.limit(fetchLimit);
        
        let finalQuestions = [];
        if (rawData && rawData.length > 0) {
            // Shuffle and slice
            finalQuestions = rawData.sort(() => 0.5 - Math.random()).slice(0, qLimitPerSubject);
            
            examData[subId] = {
                name: subName,
                questions: finalQuestions.map(q => {
                    const parsedOpts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                    return { 
                        q: fixMathText(q.question_text), 
                        opts: parsedOpts.map(o => fixMathText(o)), 
                        ans: parseInt(q.answer) 
                    };
                }),
                answers: Array(finalQuestions.length).fill(null),
                currentQ: 0
            };
            
            if(isFirst) { activeSubjectId = subId; isFirst = false; }
            tabsContainer.innerHTML += `<div class="tab-pill" id="tab-${subId}" onclick="switchSubject(${subId})">${subName}</div>`;
        }
    }
    
    switchSubject(activeSubjectId);
    startTimer();
    switchView('view-exam');
    showLoading(false);
}

// --- 3. EXAM UI LOGIC ---
window.switchSubject = function(subId) {
    activeSubjectId = subId;
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${subId}`).classList.add('active');
    renderGrid();
    renderQuestion();
};

function renderGrid() {
    const data = examData[activeSubjectId];
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';
    for(let i=0; i<data.questions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'qbtn';
        if(data.answers[i] !== null) btn.classList.add('answered');
        if(data.currentQ === i) btn.classList.add('current');
        btn.innerText = i + 1;
        btn.onclick = () => { data.currentQ = i; renderGrid(); renderQuestion(); };
        grid.appendChild(btn);
    }
}

function renderQuestion() {
    const data = examData[activeSubjectId];
    const q = data.questions[data.currentQ];
    const qTextEl = document.getElementById('qText');
    const qOptsEl = document.getElementById('qOptions');
    
    qTextEl.innerHTML = `Q${data.currentQ+1}. ${q.q}`;
    qOptsEl.innerHTML = q.opts.map((opt, idx) => {
        const isSel = data.answers[data.currentQ] === idx;
        return `
        <label class="opt ${isSel ? 'selected' : ''}">
            <input type="radio" name="cbtopt" value="${idx}" ${isSel ? 'checked' : ''} onchange="saveAnswer(${idx})">
            <span>${opt}</span>
        </label>
    `}).join('');
    
    if(window.MathJax) {
        MathJax.typesetClear([qTextEl, qOptsEl]);
        MathJax.typesetPromise([qTextEl, qOptsEl]).catch(err => console.error(err));
    }
}

window.saveAnswer = function(idx) {
    examData[activeSubjectId].answers[examData[activeSubjectId].currentQ] = idx;
    renderGrid();
    renderQuestion(); // Re-render to update the highlight class
};

window.nextQuestion = function() {
    if(examData[activeSubjectId].currentQ < examData[activeSubjectId].questions.length - 1) {
        examData[activeSubjectId].currentQ++;
        renderGrid(); renderQuestion();
    }
};

window.prevQuestion = function() {
    if(examData[activeSubjectId].currentQ > 0) {
        examData[activeSubjectId].currentQ--;
        renderGrid(); renderQuestion();
    }
};

// --- TIMER & SUBMIT ---
function startTimer() {
    timerId = setInterval(() => {
        durationSec--;
        if(durationSec <= 0) { clearInterval(timerId); submitExam(true); }
        
        const h = Math.floor(Math.max(0, durationSec) / 3600).toString().padStart(2, '0');
        const m = Math.floor((Math.max(0, durationSec) % 3600) / 60).toString().padStart(2, '0');
        const s = (Math.max(0, durationSec) % 60).toString().padStart(2, '0');
        
        document.getElementById('timerDisplay').innerText = `${h}:${m}:${s}`;
    }, 1000);
}

window.confirmSubmit = function() {
    if(confirm('Are you sure you want to submit? All answers will be finalized.')) {
        submitExam(false);
    }
};

window.confirmDashboardReturn = function() {
    if(confirm('Are you sure you want to quit? Your progress will be lost.')) {
        window.location.replace('/post-utme-dashboard');
    }
};

async function submitExam(auto) {
    clearInterval(timerId);
    showLoading(true, "Calculating Final Results...");
    
    let totalScore = 0;
    let timeSpentSec = maxDurationSec - Math.max(0, durationSec);
    let detailsHTML = '';
    
    // Database payload builder
    const userObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user'));
    const authEmail = userObj.email;
    const dbPayload = [];

    for(const subId in examData) {
        const d = examData[subId];
        let subScore = 0;
        let attempted = 0;
        
        d.questions.forEach((q, i) => {
            if(d.answers[i] !== null) {
                attempted++;
                if (d.answers[i] === q.ans) subScore++;
            }
        });
        
        // Scale to 100 per subject
        const scaledSubScore = Math.round((subScore / d.questions.length) * 100);
        totalScore += scaledSubScore;

        detailsHTML += `
            <tr>
                <td style="font-weight:bold; text-align:left;">${d.name}</td>
                <td>${attempted}/${d.questions.length}</td>
                <td style="font-weight:bold; color:var(--ion-color-primary);">${scaledSubScore}</td>
            </tr>
        `;

        dbPayload.push({
            user_email: authEmail,
            session_id: globalSessionId,
            subject_id: subId,
            subject_name: d.name,
            score: scaledSubScore,
            attempted: attempted,
            time_spent_seconds: timeSpentSec,
            created_at: new Date().toISOString()
        });
    }
    
    // Save to Database
    await _sb.from('putme_exam_results').insert(dbPayload).catch(err => console.log(err));

    // Render Pie Charts
    const scorePercent = Math.round((totalScore / 400) * 100);
    const scoreColor = scorePercent >= 50 ? '#10b981' : '#ef4444'; // Green if >= 50%, else Red
    
    document.getElementById('scoreDonutChart').style.background = `conic-gradient(${scoreColor} ${scorePercent}%, #d1d5db 0)`;
    document.getElementById('scoreDonutText').innerText = `${scorePercent}%`;
    document.getElementById('scoreDonutText').style.color = scoreColor;
    
    const timePercent = Math.round((timeSpentSec / maxDurationSec) * 100);
    document.getElementById('timeDonutChart').style.background = `conic-gradient(#f59e0b ${timePercent}%, #d1d5db 0)`;
    document.getElementById('timeDonutText').innerText = `${timePercent}%`;

    // Render Table
    document.getElementById('finalTotalScore').innerText = `${totalScore}/400`;
    document.getElementById('finalTimeSpent').innerText = `${Math.round(timeSpentSec/60)} min`;
    document.getElementById('detailsTableBody').innerHTML = detailsHTML;
    
    switchView('view-review');
    showLoading(false);
    
    if (auto) alert('Time Up! Your answers have been submitted automatically.');
}