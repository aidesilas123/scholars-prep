// --- GLOBAL CONTENT PROTECTION ---
(function initContentProtection() {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => e.preventDefault());
    document.addEventListener('dragstart', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); return false; }
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        if (isCtrlOrCmd) {
            const key = e.key.toLowerCase();
            if (['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(key)) { e.preventDefault(); return false; }
            if (e.shiftKey && ['i', 'j', 'c'].includes(key)) { e.preventDefault(); return false; }
        }
    }, { capture: true }); 
})();

// --- AUTH GUARD & INIT ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) window.location.replace('index.html'); 
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('post_utme_theme') === 'dark') document.body.classList.add('dark');
    history.replaceState({ view: 'view-selection' }, '', '');
    loadExamSetup();
});

// --- ADVANCED NETWORK & SPEED MONITOR ---
(function initNetworkMonitor() {
    function checkNetworkQuality() {
        if (!navigator.onLine) {
            // Your exact original modal for offline states
            showModal('Network Error', '⚠️ You have lost internet connection. Please check your network to ensure your results save properly.', hideModal, false);
            return;
        }

        if (navigator.connection) {
            const networkType = navigator.connection.effectiveType; 
            
            // If the connection drops to 2G speeds
            if (networkType === 'slow-2g' || networkType === '2g') {
                showModal('Slow Connection', '🐢 Your network is currently very slow. The app might take a moment to load elements or submit your exam.', hideModal, false);
            }
        }
    }

    // Trigger when connection is completely lost
    window.addEventListener('offline', checkNetworkQuality);

    // Trigger when connection is restored
    window.addEventListener('online', () => {
        hideModal(); // Clear the error modal
        setTimeout(checkNetworkQuality, 1500); // Verify the new connection is actually fast
    });
})();

// --- CUSTOM MODAL SYSTEM ---
function showModal(title, msg, onOk, showCancel = true) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMsg').innerHTML = msg; 
    const cancelBtn = document.getElementById('modalCancel');
    cancelBtn.style.display = showCancel ? 'block' : 'none';

    const okBtn = document.getElementById('modalOk');
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.onclick = () => {
        hideModal();
        if (onOk) onOk();
    };
    document.getElementById('overlay').style.display = 'flex';
}
window.hideModal = () => document.getElementById('overlay').style.display = 'none';

// --- ROBUST RANDOMIZATION (Fisher-Yates Shuffle) ---
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

// --- STATE ---
let subjectsData = [];
let examData = {}; 
let activeSubjectId = null;
let durationSec = 7200; 
let maxDurationSec = 7200;
let qLimitPerSubject = 50;
let timerId = null;
let globalSessionId = null;

// --- FREEMIUM STATE ---
let isFreeUser = false;
let authEmail = '';
let lastAttemptTimestamp = 0;

function showLoading(show, text="Loading...") {
    document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
    document.getElementById('loadText').textContent = text;
}

function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        if (e.state.view === 'view-selection' && Object.keys(examData).length > 0 && timerId !== null) {
            history.pushState({ view: 'view-exam' }, '', '');
            confirmDashboardReturn();
        } else {
            switchView(e.state.view, false);
        }
    } else {
        window.location.replace('post-utme-dashboard.html');
    }
});

function fixMathText(text) {
    if (!text) return "";
    if (/<\/?[a-z][\s\S]*>/i.test(text)) return text;

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

// --- 1. ASYNC LOAD DATA ---
async function loadExamSetup() {
    try {
        const userObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user'));
        authEmail = userObj.email;

        const [settingsRes, switchRes, subStatusRes, attemptRes] = await Promise.all([
            _sb.from('putme_exam_setting').select('*').limit(1).single(),
            _sb.from('putme_settings').select('is_payment_active').maybeSingle(),
            _sb.from('putme_subscriptions').select('end_date').eq('user_email', authEmail).maybeSingle(),
            _sb.from('putme_free_attempts').select('last_attempt_time').eq('user_email', authEmail).maybeSingle()
        ]);

        if (settingsRes.data) {
            durationSec = (settingsRes.data.duration_minutes || 120) * 60;
            maxDurationSec = durationSec;
            qLimitPerSubject = settingsRes.data.question_limit || 50;
            
            document.getElementById('instQCount').innerText = qLimitPerSubject;
            document.getElementById('instTime').innerText = `${Math.round(durationSec/60)} Minutes`;
        }

        let isSwitchActive = switchRes.data?.is_payment_active ?? true;
        let isPremium = false;
        if (subStatusRes.data?.end_date && new Date(subStatusRes.data.end_date) > new Date()) isPremium = true;
        isFreeUser = (isSwitchActive && !isPremium);

        if (attemptRes.data?.last_attempt_time) {
            lastAttemptTimestamp = new Date(attemptRes.data.last_attempt_time).getTime();
        }

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
    } catch (err) { console.error("Setup load failed:", err); }
}

window.filterSubjects = function(event) {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll('.subject-card').forEach(card => {
        const subjectName = card.querySelector('ion-label').innerText.toLowerCase();
        card.style.display = subjectName.includes(query) ? 'block' : 'none';
    });
};

window.toggleSubject = function(id) {
    const card = document.getElementById(`card-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    const currentSelected = document.querySelectorAll('.subject-card.selected').length;
    
    if (!card.classList.contains('selected') && currentSelected >= 4) {
        showModal("Limit Reached", "You can only select exactly 4 subjects for a full exam.", null, false);
        return;
    }

    card.classList.toggle('selected');
    chk.checked = card.classList.contains('selected');
    document.getElementById('selCount').innerText = document.querySelectorAll('.subject-card.selected').length;
};

window.goToInstructions = function() {
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    if(selectedCards.length !== 4) {
        showModal("Selection Error", "Please select exactly 4 subjects to proceed.", null, false);
        return;
    }
    switchView('view-instructions');
};

// --- 2. START EXAM ---
window.startExam = async function() {
    if (isFreeUser) {
        const now = Date.now();
        const diffSec = Math.floor((now - lastAttemptTimestamp) / 1000);
        if (lastAttemptTimestamp > 0 && diffSec < 3600) {
            const minLeft = Math.ceil((3600 - diffSec) / 60);
            showModal("Anti-Spam Cooldown", `Free practice limit reached. Please wait <b>${minLeft} minutes</b> before starting another session, or activate the app for unlimited Mock Exams.`, null, false);
            return; 
        }
    }

    showLoading(true, "Generating Exam...");
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    
    examData = {};
    const tabsContainer = document.getElementById('examSubjectTabs');
    tabsContainer.innerHTML = '';
    globalSessionId = `EXAM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    let isFirst = true;
    for(let card of selectedCards) {
        const subId = card.id.split('-')[1];
        const subName = subjectsData.find(s => s.id == subId).name;
        const yearOpt = document.getElementById(`yr-${subId}`).value;

        // THE FIX: Call the secure backend function
        const { data: finalQuestions, error } = await _sb.rpc('get_random_questions', {
            p_subject_id: parseInt(subId),
            p_year: yearOpt,
            p_limit: qLimitPerSubject
        });
        
        if (error) console.error("Database fetch error:", error);

        if (finalQuestions && finalQuestions.length > 0) {
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
                flags: Array(finalQuestions.length).fill(false), 
                currentQ: 0
            };
            
            if(isFirst) { activeSubjectId = subId; isFirst = false; }
            tabsContainer.innerHTML += `<div class="tab-pill" id="tab-${subId}" onclick="switchSubject('${subId}')">${subName}</div>`;
        }
    }
    
    if(!activeSubjectId) { 
        showLoading(false); 
        showModal("Error", "No questions found for the selected setup.", null, false);
        return; 
    }

    if (isFreeUser) {
        _sb.from('putme_free_attempts').upsert({ user_email: authEmail, last_attempt_time: new Date().toISOString() }).then();
        lastAttemptTimestamp = Date.now();
    }
    
    switchSubject(activeSubjectId);
    startTimer();
    switchView('view-exam');
    showLoading(false);
};

// --- 3. EXAM UI LOGIC ---
window.switchSubject = function(subId) {
    activeSubjectId = subId;
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${subId}`).classList.add('active');
    renderGrid();
    renderQuestion();
};

function triggerTrapModal() {
    const trapModal = document.getElementById('examTrapModal');
    if(trapModal) {
        trapModal.style.display = 'flex';
    } else {
        alert("Free Limit Reached! Please activate the app to continue.");
    }
}

function renderGrid() {
    const data = examData[activeSubjectId];
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';
    for(let i=0; i<data.questions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'qbtn';
        if(data.answers[i] !== null) btn.classList.add('answered');
        if(data.flags[i]) btn.classList.add('flag'); 
        if(data.currentQ === i) btn.classList.add('current');
        btn.innerText = i + 1;
        btn.onclick = () => { 
            // PREVENT VIEWING 11TH QUESTION IF FREE USER
            if (isFreeUser && i >= 10) {
                triggerTrapModal();
                return;
            }
            data.currentQ = i; 
            renderGrid(); 
            renderQuestion(); 
        };
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
    if (isFreeUser) {
        let totalAnswers = 0;
        for (const subId in examData) {
            totalAnswers += examData[subId].answers.filter(a => a !== null).length;
        }
        
        const currentSub = examData[activeSubjectId];
        const isAlreadyAnswered = currentSub.answers[currentSub.currentQ] !== null;
        
        // Block answering if global total is 10
        if (!isAlreadyAnswered && totalAnswers >= 10) {
            triggerTrapModal();
            const radios = document.getElementsByName('cbtopt');
            radios.forEach(r => r.checked = false);
            return; 
        }
    }

    examData[activeSubjectId].answers[examData[activeSubjectId].currentQ] = idx;
    renderGrid();
    renderQuestion(); 
};

window.toggleFlag = function() {
    const d = examData[activeSubjectId];
    d.flags[d.currentQ] = !d.flags[d.currentQ];
    renderGrid();
};

window.nextQuestion = function() {
    // PREVENT VIEWING 11TH QUESTION VIA NEXT BUTTON
    if (isFreeUser && examData[activeSubjectId].currentQ + 1 >= 10) {
        triggerTrapModal();
        return;
    }

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

// --- TIMER & SUBMIT LOGIC ---
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
    showModal('Submit Exam', 'Are you sure you want to submit? All answers will be finalized.', () => submitExam(false));
};

window.confirmDashboardReturn = function() {
    showModal('Quit Exam?', 'Are you sure you want to quit? Your progress will be lost.', () => { window.location.replace('post-utme-dashboard.html'); });
};

async function submitExam(auto) {
    clearInterval(timerId);
    showLoading(true, "Calculating Final Results...");
    
    let totalScore = 0;
    let timeSpentSec = maxDurationSec - Math.max(0, durationSec);
    let detailsHTML = '';
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
            subject_id: parseInt(subId),
            subject_name: d.name,
            score: scaledSubScore,
            attempted: attempted,
            time_spent_seconds: timeSpentSec,
            created_at: new Date().toISOString()
        });
    }
    
    try {
        const { error: dbError } = await _sb.from('putme_exam_results').insert(dbPayload);
        if (dbError) console.error("Database Insert Error:", dbError);
    } catch (err) { console.error("Network/DB Request Failed:", err); }

    const scorePercent = Math.round((totalScore / 400) * 100);
    const scoreColor = scorePercent >= 50 ? '#10b981' : '#ef4444';
    
    const donutChart = document.getElementById('scoreDonutChart');
    if (donutChart) {
        donutChart.style.background = `conic-gradient(${scoreColor} ${scorePercent}%, #d1d5db 0)`;
        document.getElementById('scoreDonutText').innerText = `${scorePercent}%`;
        document.getElementById('scoreDonutText').style.color = scoreColor;
    }
    
    const timeChart = document.getElementById('timeDonutChart');
    if (timeChart) {
        const timePercent = Math.round((timeSpentSec / maxDurationSec) * 100);
        timeChart.style.background = `conic-gradient(#f59e0b ${timePercent}%, #d1d5db 0)`;
        document.getElementById('timeDonutText').innerText = `${timePercent}%`;
    }

    document.getElementById('finalTotalScore').innerText = `${totalScore}/400`;
    document.getElementById('finalTimeSpent').innerText = `${Math.round(timeSpentSec/60)} min`;
    document.getElementById('detailsTableBody').innerHTML = detailsHTML;
    
    switchView('view-review');
    showLoading(false);
    
    if (auto) showModal('Time Up!', 'Your exam time has elapsed. Your answers have been submitted automatically.', null, false);
}

// --- CALCULATOR LOGIC ---
window.toggleCalc = () => { 
    const c = document.getElementById('calc'); 
    c.style.display = c.style.display === 'block' ? 'none' : 'block'; 
};
window.ins = (ch) => document.getElementById('calcInput').value += ch;
window.clr = () => { document.getElementById('calcInput').value=''; document.getElementById('calcOut').innerText='—'; };
window.evalCalc = () => {
    try { 
        const input = document.getElementById('calcInput').value;
        if(!/^[0-9+\-*/().\s]+$/.test(input)) throw new Error();
        const result = new Function('return ' + input)();
        document.getElementById('calcOut').innerText = result; 
    } 
    catch(e) { document.getElementById('calcOut').innerText = 'Error'; }
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
        initialX = rect.left;
        initialY = rect.top;
        startX = clientX;
        startY = clientY;
        
        calcEl.style.right = 'auto';
        calcEl.style.bottom = 'auto';
        calcEl.style.margin = '0';
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, {passive: false});
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault(); 
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        calcEl.style.left = `${initialX + (clientX - startX)}px`;
        calcEl.style.top = `${initialY + (clientY - startY)}px`;
    }

    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }
}

// --- PAYSTACK & TRAP ACTIONS ---
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 

window.forceSubmitFreeExam = function() {
    document.getElementById('examTrapModal').style.display = 'none';
    submitExam(false); 
};
window.triggerPutmePaystack = function() {
    if (typeof PaystackPop === 'undefined') {
        alert("Payment gateway blocked. Please disable your browser's adblocker or tracking prevention and refresh the page.");
        return;
    }

    const userObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user'));
    const userEmail = userObj.email;
    const userId = userObj.id || ''; 
    
    const cached = JSON.parse(localStorage.getItem('putme_premium_data') || '{}');
    const finalPrice = (cached && cached.discountEarned === true) ? 5000 : 5500;

    function onPaymentSuccess(response) {
        console.log("Payment Ref:", response.reference);
        document.getElementById('examTrapModal').style.display = 'none';
        showLoading(true, "Verifying payment securely...");
        
        // Wait for webhook, then unlock UI without reloading the page
        setTimeout(() => {
            isFreeUser = false; // Turn off the trap!
            cached.isPremium = true;
            localStorage.setItem('putme_premium_data', JSON.stringify(cached));
            
            showLoading(false);
            alert("Payment successful! Your exam is unlocked. You may continue."); 
            startTimer(); // Resume the clock!
        }, 3000);
    }

    let handler = PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: userEmail,
        amount: finalPrice * 100, 
        currency: 'NGN', 
        ref: 'PUTME_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: {
            user_id: userId,
            user_email: userEmail,
            plan_type: 'Pro Access',
            target_app: 'post_utme' // <--- ROUTES TO POST UTME TABLE
        },
        callback: onPaymentSuccess,
        onClose: function() { console.log('Payment window closed.'); }
    });
    handler.openIframe();
};