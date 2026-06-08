// --- 1. CORE CONFIG & AUTH GUARD ---
const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let authUser = null;
let isFreeUser = false;

(function protectPage() {
    const userString = localStorage.getItem('abupq_logged_in_user');
    if (!userString) window.location.replace('index.html'); 
    authUser = JSON.parse(userString);
})();

// --- GLOBAL STATE ---
let globalSessionId = null;
let hubData = []; 
let activeCourse = null; 
let activePhase = null; 
let cbtData = { questions: [], answers: [], flags: [], currentQ: 0, duration: 0 };
let timerId = null;

// The missing function that caused the CBT engine crash
function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true, "Checking Session...");
    await checkPremiumStatus();
    await initializeSystem();
});

// --- UI HELPERS ---
function showLoading(show, text="Loading...") {
    document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
    document.getElementById('loadText').textContent = text;
}

function switchView(viewId) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function showModal(title, msg, onOk = null, showCancel = true) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').setAttribute('name', title.toLowerCase().includes('error') ? 'warning-outline' : 'information-circle-outline');
    document.getElementById('modalIcon').setAttribute('color', title.toLowerCase().includes('error') ? 'danger' : 'primary');
    
    const btnContainer = document.getElementById('modalButtons');
    
    if (onOk) {
        btnContainer.innerHTML = `
            ${showCancel ? `<ion-button fill="outline" color="medium" style="flex:1;" onclick="document.getElementById('genericModal').style.display='none'">Cancel</ion-button>` : ''}
            <ion-button color="danger" style="flex:1;" id="dynamicOkBtn">Yes</ion-button>
        `;
        document.getElementById('dynamicOkBtn').onclick = () => {
            document.getElementById('genericModal').style.display = 'none';
            onOk();
        };
    } else {
        btnContainer.innerHTML = `<ion-button fill="outline" color="primary" expand="block" style="width: 100%" onclick="document.getElementById('genericModal').style.display='none'">OK</ion-button>`;
    }
    
    document.getElementById('genericModal').style.display = 'flex';
}

// --- 2. INITIALIZATION ---
async function checkPremiumStatus() {
    const [settingsRes, subRes] = await Promise.all([
        _sb.from('app_settings').select('payment_active').single(),
        _sb.from('profiles').select('subscription_end').eq('id', authUser.id).maybeSingle()
    ]);
    let isSwitchActive = settingsRes.data?.payment_active ?? true;
    let isPremium = false;
    if (subRes.data?.subscription_end && new Date(subRes.data.subscription_end) > new Date()) isPremium = true;
    isFreeUser = (isSwitchActive && !isPremium);
}

async function initializeSystem() {
    try {
        const { data, error } = await _sb.from('mock_sessions').select('*').eq('user_id', authUser.id).eq('is_active', true);
        if (error) throw error;

        if (data && data.length > 0) {
            globalSessionId = data[0].session_id;
            hubData = data.sort((a,b) => a.course_code.localeCompare(b.course_code));
            renderHub();
            switchView('view-hub');
        } else {
            await loadSetupPage();
        }
    } catch (err) {
        console.error(err);
        showModal('Error', 'Failed to connect to server.', null, false);
    }
    showLoading(false);
}

// --- 3. SETUP PAGE LOGIC ---
async function loadSetupPage() {
    try {
        const [savedRes, testYrsRes, examYrsRes, settingsRes] = await Promise.all([
            _sb.from('user_custom_courses').select('course_code').eq('user_id', authUser.id),
            _sb.from('ss_test_questions').select('course_code, year'),
            _sb.from('ss_exam_questions').select('course_code, year'),
            _sb.from('course_settings').select('course_code, credit_units')
        ]);

        if (savedRes.error) throw savedRes.error;
        const saved = savedRes.data;

        // Display the Add Courses Empty state if no courses found
        if (!saved || saved.length === 0) {
            document.getElementById('setupEmptyState').style.display = 'block';
            document.getElementById('setupListContainer').style.display = 'none';
            document.getElementById('setupNav').style.display = 'none';
            switchView('view-setup');
            return;
        }

        const yearMap = {};
        if (testYrsRes.data) testYrsRes.data.forEach(r => { if (!yearMap[r.course_code]) yearMap[r.course_code] = new Set(); yearMap[r.course_code].add(r.year); });
        if (examYrsRes.data) examYrsRes.data.forEach(r => { if (!yearMap[r.course_code]) yearMap[r.course_code] = new Set(); yearMap[r.course_code].add(r.year); });

        const container = document.getElementById('setupListContainer');
        container.innerHTML = '';
        
        saved.forEach(c => {
            const code = c.course_code;
            const cSetting = settingsRes.data?.find(s => s.course_code === code);
            const credits = cSetting ? cSetting.credit_units : 2;

            let yearsHTML = '<ion-select-option value="random">Random</ion-select-option>';
            if (yearMap[code] && yearMap[code].size > 0) {
                Array.from(yearMap[code]).sort((a,b) => b - a).forEach(y => yearsHTML += `<ion-select-option value="${y}">${y}</ion-select-option>`);
            }

            container.innerHTML += `
            <div class="subject-card" data-code="${code}">
                <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; font-size:16px; margin-bottom:12px; color:var(--ion-color-primary);">
                    <span>${code}</span>
                    <span style="font-size:13px; color:var(--muted);">${credits} Credits</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <ion-item fill="outline" style="--border-radius:8px; flex:1; --background:transparent;">
                        <ion-label position="stacked">Year</ion-label>
                        <ion-select class="yr-select" value="random">${yearsHTML}</ion-select>
                    </ion-item>
                    <ion-item fill="outline" style="--border-radius:8px; flex:1; --background:transparent;">
                        <ion-label position="stacked">Type</ion-label>
                        <ion-select class="mod-select" value="both">
                            <ion-select-option value="test">Test Only</ion-select-option>
                            <ion-select-option value="exam">Exam Only</ion-select-option>
                            <ion-select-option value="both">Test & Exam</ion-select-option>
                        </ion-select>
                    </ion-item>
                </div>
            </div>`;
        });

        document.getElementById('setupEmptyState').style.display = 'none';
        document.getElementById('setupListContainer').style.display = 'block';
        document.getElementById('setupNav').style.display = 'flex';
        switchView('view-setup');
    } catch (err) { console.error(err); }
}

window.generateSession = async function() {
    showLoading(true, "Generating Session...");
    globalSessionId = `MOCK_${Date.now()}`;
    const payload = [];
    
    document.querySelectorAll('#setupListContainer .subject-card').forEach(card => {
        const code = card.getAttribute('data-code');
        const mode = card.querySelector('.mod-select').value;
        payload.push({
            session_id: globalSessionId,
            user_id: authUser.id,
            course_code: code,
            year: card.querySelector('.yr-select').value,
            mode: mode,
            test_status: (mode === 'exam') ? 'skipped' : 'pending',
            exam_status: (mode === 'test') ? 'skipped' : 'pending' 
        });
    });

    try {
        const { data, error } = await _sb.from('mock_sessions').insert(payload).select();
        if (error) throw error;
        hubData = data;
        renderHub();
        switchView('view-hub');
    } catch (err) { showModal('Error', 'Could not create session.', null, false); }
    showLoading(false);
};

// --- 4. HUB PAGE LOGIC (Strict Progress Triggers) ---
function renderHub() {
    const container = document.getElementById('hubListContainer');
    container.innerHTML = '';
    
    // Check if ALL required tests across all courses are marked 'completed' or 'skipped'
    const allTestsCompleted = hubData.every(r => r.mode === 'exam' || r.test_status === 'completed');
    let allPhasesCompleted = true;

    hubData.forEach(row => {
        let cardHTML = `<div class="hub-card"><h3 style="margin:0; font-weight:bold; color:var(--ion-color-primary);">${row.course_code}</h3>`;

        // Render Test Row
        if (row.mode === 'test' || row.mode === 'both') {
            if (row.test_status === 'pending') {
                // Outline Button Design
                cardHTML += `<div class="hub-row">
                    <span style="font-weight:bold; color:var(--ion-text-color);">CA Test</span>
                    <ion-button size="small" fill="outline" color="primary" onclick="preparePhase('${row.course_code}', 'test')">START TEST</ion-button>
                </div>`;
                allPhasesCompleted = false;
            } else {
                cardHTML += `<div class="hub-row">
                    <span style="font-weight:bold; color:var(--ion-text-color);"> CA Test</span>
                    <span class="badge-completed">Score: ${row.test_score}/40</span>
                </div>`;
            }
        }

        // Render Exam Row (ONLY if tests are done)
        if (row.mode === 'exam' || row.mode === 'both') {
            if (!allTestsCompleted) {
                // Locks entirely until CA is complete
                cardHTML += `<div class="hub-row">
                    <span style="font-weight:bold; color:var(--ion-text-color);">Exam</span>
                    <span class="badge-locked"><ion-icon name="lock-closed"></ion-icon> Locked</span>
                </div>`;
                allPhasesCompleted = false;
            } else if (row.exam_status === 'pending') {
                cardHTML += `<div class="hub-row">
                    <span style="font-weight:bold; color:var(--ion-text-color);">Exam</span>
                    <ion-button size="small" fill="outline" color="primary" onclick="preparePhase('${row.course_code}', 'exam')">START EXAM</ion-button>
                </div>`;
                allPhasesCompleted = false;
            } else {
                cardHTML += `<div class="hub-row">
                    <span style="font-weight:bold; color:var(--ion-text-color);">Exam</span>
                    <span class="badge-completed">Score: ${row.exam_score}/60</span>
                </div>`;
            }
        }

        cardHTML += `</div>`;
        container.innerHTML += cardHTML;
    });

    document.getElementById('navViewResults').style.display = allPhasesCompleted ? 'flex' : 'none';
}

window.executeRestart = async function() {
    showLoading(true, "Archiving...");
    await _sb.from('mock_sessions').update({ is_active: false }).eq('session_id', globalSessionId);
    globalSessionId = null; hubData = [];
    await loadSetupPage();
    showLoading(false);
}

window.promptRestart = function() {
    showModal('Abandon Session?', 'Are you sure you want to restart? This will abandon your current progress.', executeRestart);
};

// --- 5. CBT ENGINE PREP ---
function fixMathText(text) {
    if (!text) return "";
    if (/<\/?[a-z][\s\S]*>/i.test(text)) return text;
    let fixed = text.replace(/(?<!\\\\)\b(frac|sqrt|int|lim|sum|infty|times|div|pm|sin|cos|tan|theta|pi|alpha)\b/g, '\\$1').replace(/\\\\/g, "\\");
    if ((/[\\][a-zA-Z]+/.test(fixed) || /[=^_{}<>]/.test(fixed)) && !fixed.includes("$") && !fixed.includes("\\(") && fixed.length < 50) return `\\( ${fixed} \\)`;
    return fixed;
}

window.preparePhase = async function(code, phase) {
    activeCourse = code;
    activePhase = phase;
    showLoading(true, "Fetching Course Data...");

    try {
        const { data: settings } = await _sb.from('course_settings').select('*').eq('course_code', code).maybeSingle();
        const durationMins = settings ? (phase === 'test' ? settings.test_duration_mins : settings.exam_duration_mins) : (phase === 'test' ? 45 : 60);
        const limit = settings ? (phase === 'test' ? settings.test_q_count : settings.exam_q_count) : (phase === 'test' ? 20 : 30);
        
        cbtData.duration = durationMins * 60;
        
        const rowData = hubData.find(r => r.course_code === code);
        const table = phase === 'test' ? 'ss_test_questions' : 'ss_exam_questions';
        
        let query = _sb.from(table).select('*').eq('course_code', code);
        if (rowData.year !== 'random') query = query.eq('year', rowData.year);
        
        let { data: qData, error } = await query;
        if (error) throw error;

        if (!qData || qData.length === 0) {
            showModal("Empty Bank", `No ${phase} questions found for ${code}.`, null, false);
            showLoading(false); return;
        }

        // Apply shuffle correctly!
        qData = shuffleArray(qData).slice(0, limit); 

        cbtData.questions = qData.map(q => {
            const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            return { q: fixMathText(q.question_text||q.question), opts: parsed.map(o=>fixMathText(o)), ans: parseInt(q.answer) };
        });
        cbtData.answers = Array(cbtData.questions.length).fill(null);
        cbtData.flags = Array(cbtData.questions.length).fill(false);
        cbtData.currentQ = 0;

        document.getElementById('instCourseTitle').innerText = `${code}`;
        document.getElementById('instPhaseName').innerText = phase === 'test' ? 'Continuous Assessment (Test)' : 'Examination';
        document.getElementById('instQCount').innerText = cbtData.questions.length;
        document.getElementById('instTime').innerText = `${durationMins} Minutes`;

        switchView('view-instructions');
    } catch (err) { 
        console.error(err);
        showModal('Error', 'Failed to load CBT engine.', null, false); 
    }
    showLoading(false);
};

window.beginExam = function() {
    switchView('view-exam');
    renderCbtGrid();
    renderCbtQuestion();
    startCbtTimer();
};

// --- 6. ACTIVE CBT UI ---
function renderCbtGrid() {
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';
    for(let i=0; i<cbtData.questions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'qbtn';
        if(cbtData.answers[i] !== null) btn.classList.add('answered');
        if(cbtData.flags[i]) btn.classList.add('flag'); 
        if(cbtData.currentQ === i) btn.classList.add('current');
        btn.innerText = i + 1;
        btn.onclick = () => { 
            if (isFreeUser && i >= 10) { document.getElementById('examTrapModal').style.display = 'flex'; return; }
            cbtData.currentQ = i; renderCbtGrid(); renderCbtQuestion(); 
        };
        grid.appendChild(btn);
    }
}

function renderCbtQuestion() {
    const q = cbtData.questions[cbtData.currentQ];
    document.getElementById('qText').innerHTML = `Q${cbtData.currentQ+1}. ${q.q}`;
    document.getElementById('qOptions').innerHTML = q.opts.map((opt, idx) => {
        const isSel = cbtData.answers[cbtData.currentQ] === idx;
        return `
        <label class="opt ${isSel ? 'selected' : ''}">
            <input type="radio" name="cbtopt" value="${idx}" ${isSel ? 'checked' : ''} onchange="saveAnswer(${idx})" style="display:none;">
            <span>${String.fromCharCode(65 + idx)}) ${opt}</span>
        </label>
    `}).join('');
    if(window.MathJax) { MathJax.typesetClear(); MathJax.typesetPromise(); }
}

window.saveAnswer = function(idx) {
    if (isFreeUser && cbtData.answers.filter(a => a !== null).length >= 10 && cbtData.answers[cbtData.currentQ] === null) {
        document.getElementById('examTrapModal').style.display = 'flex'; return; 
    }
    cbtData.answers[cbtData.currentQ] = idx;
    renderCbtGrid(); renderCbtQuestion(); 
};

window.toggleFlag = function() {
    cbtData.flags[cbtData.currentQ] = !cbtData.flags[cbtData.currentQ];
    renderCbtGrid();
};

window.nextQuestion = function() {
    if (isFreeUser && cbtData.currentQ + 1 >= 10) { document.getElementById('examTrapModal').style.display = 'flex'; return; }
    if(cbtData.currentQ < cbtData.questions.length - 1) { cbtData.currentQ++; renderCbtGrid(); renderCbtQuestion(); }
};

window.prevQuestion = function() {
    if(cbtData.currentQ > 0) { cbtData.currentQ--; renderCbtGrid(); renderCbtQuestion(); }
};

function startCbtTimer() {
    timerId = setInterval(() => {
        cbtData.duration--;
        if(cbtData.duration <= 0) { clearInterval(timerId); processSubmission(true); }
        const h = Math.floor(Math.max(0, cbtData.duration) / 3600).toString().padStart(2, '0');
        const m = Math.floor((Math.max(0, cbtData.duration) % 3600) / 60).toString().padStart(2, '0');
        const s = (Math.max(0, cbtData.duration) % 60).toString().padStart(2, '0');
        document.getElementById('timerDisplay').innerText = h !== '00' ? `${h}:${m}:${s}` : `${m}:${s}`;
    }, 1000);
}

window.promptSubmit = function() {
    showModal('Submit Phase', 'Are you sure you want to submit this section?', () => processSubmission(false));
};

window.forceSubmit = function() { document.getElementById('examTrapModal').style.display = 'none'; processSubmission(false); };

// --- 7. SCORING & HUB UPDATE ---
async function processSubmission(isAuto) {
    clearInterval(timerId);
    showLoading(true, "Scoring Section...");

    let rawScore = 0;
    cbtData.questions.forEach((q, i) => { if (cbtData.answers[i] === q.ans) rawScore++; });
    
    // Scale: Test over 40, Exam over 60
    const maxScore = activePhase === 'test' ? 40 : 60;
    const finalScaled = Math.round((rawScore / cbtData.questions.length) * maxScore);

    const row = hubData.find(r => r.course_code === activeCourse);
    if (activePhase === 'test') {
        row.test_score = finalScaled;
        row.test_status = 'completed';
    } else {
        row.exam_score = finalScaled;
        row.exam_status = 'completed';
    }

    await _sb.from('mock_sessions').update({
        test_score: row.test_score, test_status: row.test_status,
        exam_score: row.exam_score, exam_status: row.exam_status
    }).eq('id', row.id);

    renderHub();
    switchView('view-hub');
    showLoading(false);
    if (isAuto) showModal('Time Up', 'Your time expired. Answers auto-submitted.', null, false);
}

// --- 8. CALCULATE GPA ---
// --- REPLACE ONLY YOUR calculateAndShowResults FUNCTION ---
window.calculateAndShowResults = async function() {
    showLoading(true, "Calculating GPA...");
    try {
        const { data: settings } = await _sb.from('course_settings').select('course_code, credit_units');
        let totalQualityPoints = 0; let totalCredits = 0; let tableHTML = '';

        hubData.forEach(row => {
            const credits = settings?.find(s => s.course_code === row.course_code)?.credit_units || 2;
            const testVal = parseFloat(row.test_score) || 0;
            const examVal = parseFloat(row.exam_score) || 0;
            const totalScore = testVal + examVal;
            
            let grade = 'F', points = 0;
            if (totalScore >= 70) { grade = 'A'; points = 5; }
            else if (totalScore >= 60) { grade = 'B'; points = 4; }
            else if (totalScore >= 50) { grade = 'C'; points = 3; }
            else if (totalScore >= 45) { grade = 'D'; points = 2; }
            else if (totalScore >= 40) { grade = 'E'; points = 1; }

            totalQualityPoints += (points * credits);
            totalCredits += credits;

            tableHTML += `<tr>
                <td style="font-weight:bold; text-align:left;">${row.course_code}</td>
                <td>${testVal}</td>
                <td>${examVal}</td>
                <td style="font-weight:bold;">${totalScore}</td>
                <td style="font-weight:bold; color:${points >= 3 ? '#10b981' : '#d32f2f'}">${grade}</td>
            </tr>`;
        });

        const finalGPA = totalCredits > 0 ? (totalQualityPoints / totalCredits).toFixed(2) : 0.00;
        const gpaPercent = (finalGPA / 5.0) * 100;
        const gpaColor = finalGPA >= 2.5 ? '#10b981' : '#d32f2f';

        // SAFE DOM UPDATES (Prevents crashing if HTML IDs don't perfectly match)
        const gpaTextEl = document.getElementById('gpaText');
        if (gpaTextEl) {
            gpaTextEl.innerText = finalGPA;
            gpaTextEl.style.color = gpaColor;
        }
        
        const donutEl = document.getElementById('gpaDonut');
        if (donutEl) donutEl.style.background = `conic-gradient(${gpaColor} ${gpaPercent}%, #d1d5db 0)`;
        
        const tableBodyEl = document.getElementById('detailsTableBody') || document.getElementById('resultsTableBody');
        if (tableBodyEl) tableBodyEl.innerHTML = tableHTML;

        // Auto-abandon session so they get a fresh start next time
        await _sb.from('mock_sessions').update({ is_active: false }).eq('session_id', globalSessionId);

        switchView('view-results');
    } catch (err) { 
        console.error("Calculation Error:", err);
        showModal('Error', `Failed to calculate results: ${err.message}`, null, false); 
    }
    showLoading(false);
};

// --- CALCULATOR & DRAG ---
window.toggleCalc = () => { const c = document.getElementById('calc'); c.style.display = c.style.display === 'block' ? 'none' : 'block'; };
window.ins = (ch) => document.getElementById('calcInput').value += ch;
window.clr = () => { document.getElementById('calcInput').value=''; document.getElementById('calcOut').innerText='—'; };
window.evalCalc = () => {
    try { 
        const input = document.getElementById('calcInput').value;
        if(!/^[0-9+\-*/().\s]+$/.test(input)) throw new Error();
        document.getElementById('calcOut').innerText = new Function('return ' + input)(); 
    } catch(e) { document.getElementById('calcOut').innerText = 'Error'; }
};

const calcEl = document.getElementById('calc');
if(calcEl) {
    const calcHeader = document.getElementById('calcHeader');
    let isDragging = false, startX, startY, initialX, initialY;
    calcHeader.addEventListener('mousedown', dragStart);
    calcHeader.addEventListener('touchstart', dragStart, {passive: false});

    function dragStart(e) {
        if(e.target.tagName === 'SPAN') return; 
        isDragging = true;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const rect = calcEl.getBoundingClientRect();
        initialX = rect.left; initialY = rect.top; startX = clientX; startY = clientY;
        calcEl.style.right = 'auto'; calcEl.style.bottom = 'auto'; calcEl.style.margin = '0';
        document.addEventListener('mousemove', drag); document.addEventListener('touchmove', drag, {passive: false});
        document.addEventListener('mouseup', dragEnd); document.addEventListener('touchend', dragEnd);
    }
    function drag(e) {
        if (!isDragging) return; e.preventDefault(); 
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        calcEl.style.left = `${initialX + (clientX - startX)}px`; calcEl.style.top = `${initialY + (clientY - startY)}px`;
    }
    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', drag); document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', dragEnd); document.removeEventListener('touchend', dragEnd);
    }
}

// --- PAYSTACK ---
window.triggerPaystack = function() {
    document.getElementById('examTrapModal').style.display = 'none';
    let handler = PaystackPop.setup({
        key: PAYSTACK_KEY, email: authUser.email, amount: 2500 * 100, currency: 'NGN', 
        ref: 'SP_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: { user_id: authUser.id, email: authUser.email, plan_type: 'semester' },
        callback: function(response) {
            showLoading(true, "Verifying Payment...");
            setTimeout(() => {
                isFreeUser = false; showLoading(false);
                document.getElementById('examTrapModal').style.display = 'none';
                showModal("Success", "Payment successful! Your Mock Hub is unlocked. You may continue.", null, false); 
            }, 3000);
        }, onClose: function() {}
    });
    handler.openIframe();
};