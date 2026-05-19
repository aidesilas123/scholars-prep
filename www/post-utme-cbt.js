// --- INIT SUPABASE & THEME ---
const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('post_utme_theme') === 'dark') document.body.classList.add('dark');
    loadSubjects();
});
// ---AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    
    if (!putmeUser) {
        console.warn("Unauthorized access. Redirecting to home...");
        window.location.replace('/'); 
    }
})();

// --- CUSTOM MODAL SYSTEM ---
function showModal(title, msg, onOk, showCancel = true) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMsg').innerHTML = msg; // Changed to allow HTML
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');

    cancelBtn.style.display = showCancel ? 'block' : 'none';

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.onclick = () => {
        hideModal();
        if (onOk) onOk();
    };

    document.getElementById('overlay').style.display = 'flex';
}
window.hideModal = () => document.getElementById('overlay').style.display = 'none';

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

// --- STATE ---
let subjectsData = [];
let examData = {}; 
let activeSubjectId = null;
let durationSec = 0;
let maxDurationSec = 0; // Added for scoring calc
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
function switchView(viewId) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// --- 1. LOAD SUBJECTS & DYNAMIC YEARS ---
async function loadSubjects() {
    showLoading(true, "Fetching Subjects...");
    
    try {
        const userObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user'));
        authEmail = userObj.email;

        // Fetch subjects + Freemium checks
        const [subRes, qYearsRes, switchRes, subStatusRes, attemptRes] = await Promise.all([
            _sb.from('putme_subjects').select('*'),
            _sb.from('putme_questions').select('subject_id, year'),
            _sb.from('putme_settings').select('is_payment_active').maybeSingle(),
            _sb.from('putme_subscriptions').select('end_date').eq('user_email', authEmail).maybeSingle(),
            _sb.from('putme_free_attempts').select('last_attempt_time').eq('user_email', authEmail).maybeSingle()
        ]);

        let isSwitchActive = switchRes.data?.is_payment_active ?? true;
        let isPremium = false;
        if (subStatusRes.data?.end_date && new Date(subStatusRes.data.end_date) > new Date()) isPremium = true;
        isFreeUser = (isSwitchActive && !isPremium);

        if (attemptRes.data?.last_attempt_time) {
            lastAttemptTimestamp = new Date(attemptRes.data.last_attempt_time).getTime();
        }

        const subjects = subRes.data;
        const qYears = qYearsRes.data;
        
        const container = document.getElementById('subjectListContainer');
        container.innerHTML = '';
        
        if(subjects) {
            subjects.forEach(sub => {
                subjectsData.push(sub);
                
                let yearsHTML = '';
                if (qYears) {
                    const subYears = [...new Set(qYears.filter(q => q.subject_id === sub.id).map(q => q.year))].sort((a,b)=>b-a);
                    if (subYears.length > 0) {
                        yearsHTML = subYears.map(y => `<ion-select-option value="${y}">${y}</ion-select-option>`).join('');
                    } else {
                        yearsHTML = `<ion-select-option value="">No Questions</ion-select-option>`;
                    }
                }

                container.innerHTML += `
                <ion-card class="subject-card" id="card-${sub.id}" onclick="toggleSubject(${sub.id})">
                    <ion-item lines="none" style="--background: transparent; cursor: pointer;">
                        <ion-icon name="${sub.icon}" slot="start" color="primary"></ion-icon>
                        <ion-label style="font-weight: bold;">${sub.name}</ion-label>
                        <ion-checkbox slot="end" id="chk-${sub.id}" style="pointer-events: none;"></ion-checkbox>
                    </ion-item>
                    <div class="config-area" onclick="event.stopPropagation()">
                        <ion-row>
                            <ion-col size="6">
                                <ion-item fill="outline" style="--border-radius: 6px;">
                                    <ion-label position="stacked">Year</ion-label>
                                    <ion-select id="yr-${sub.id}" value="">${yearsHTML}</ion-select>
                                </ion-item>
                            </ion-col>
                            <ion-col size="6">
                                <ion-item fill="outline" style="--border-radius: 6px;">
                                    <ion-label position="stacked">Questions</ion-label>
                                    <ion-select id="qc-${sub.id}" value="50">
                                    <ion-select-option value="10">10</ion-select-option>
                                    <ion-select-option value="20">20</ion-select-option>
                                    <ion-select-option value="30">30</ion-select-option>
                                    <ion-select-option value="40">40</ion-select-option>
                                    <ion-select-option value="50">50</ion-select-option>
                                    </ion-select>
                                </ion-item>
                            </ion-col>
                        </ion-row>
                    </div>
                </ion-card>`;
            });
        }
    } catch (err) {
        console.error("Setup load failed:", err);
    }
    showLoading(false);
}
// --- LIVE SUBJECT SEARCH FILTER ---
window.filterSubjects = function(event) {
    const query = event.target.value.toLowerCase();
    const cards = document.querySelectorAll('.subject-card');

    cards.forEach(card => {
        // Find the specific ion-label inside each card
        const subjectName = card.querySelector('ion-label').innerText.toLowerCase();
        
        // Hide or show based on the search query
        if (subjectName.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
};

window.toggleSubject = function(id) {
    const card = document.getElementById(`card-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    card.classList.toggle('selected');
    chk.checked = card.classList.contains('selected');
};

function goToInstructions() {
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    if(selectedCards.length === 0) {
        showModal("Notice", "Please select at least one subject.", null, false);
        return;
    }

    for (let card of selectedCards) {
        const subId = card.id.split('-')[1];
        if(!document.getElementById(`yr-${subId}`).value) {
            showModal("Notice", "One of your selected subjects has no available questions.", null, false);
            return;
        }
    }

    switchView('view-instructions');
}

// --- 2. START EXAM ---
async function startExam() {
    // --- 1-HOUR COOLDOWN GUARD ---
    if (isFreeUser) {
        const now = Date.now();
        const diffSec = Math.floor((now - lastAttemptTimestamp) / 1000);
        
        if (lastAttemptTimestamp > 0 && diffSec < 3600) {
            const minLeft = Math.ceil((3600 - diffSec) / 60);
            showModal("Anti-Spam Cooldown", `Free practice limit reached. Please wait <b>${minLeft} minutes</b> before starting another session, or activate the app for unlimited CBT access.`, null, false);
            return; 
        }
    }

    showLoading(true, "Preparing Exam...");
    durationSec = parseInt(document.getElementById('examDuration').value) * 60;
    maxDurationSec = durationSec;
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    
    examData = {};
    const tabsContainer = document.getElementById('examSubjectTabs');
    tabsContainer.innerHTML = '';
    
    globalSessionId = `EXAM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    let isFirst = true;
    for(let card of selectedCards) {
        const subId = card.id.split('-')[1];
        const subName = subjectsData.find(s => s.id == subId).name;
        const year = document.getElementById(`yr-${subId}`).value;
        const limit = document.getElementById(`qc-${subId}`).value;

        const { data: qData } = await _sb.from('putme_questions').select('*').eq('subject_id', subId).eq('year', year).limit(limit);
        
        if(qData && qData.length > 0) {
            examData[subId] = {
                name: subName,
                questions: qData.map(q => {
                    const parsedOpts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                    return { 
                        q: fixMathText(q.question_text), 
                        opts: parsedOpts.map(o => fixMathText(o)), 
                        ans: parseInt(q.answer) 
                    };
                }),
                answers: Array(qData.length).fill(null),
                flags: Array(qData.length).fill(false),
                currentQ: 0
            };
            
            if(isFirst) { activeSubjectId = subId; isFirst = false; }
            tabsContainer.innerHTML += `<div class="tab-pill" id="tab-${subId}" onclick="switchSubject(${subId})">${subName}</div>`;
        }
    }
    
    if(!activeSubjectId) { 
        showLoading(false); 
        showModal("Error", "No questions found for the selected setup.", null, false);
        return; 
    }

    // LOG THE FREE ATTEMPT
    if (isFreeUser) {
        _sb.from('putme_free_attempts').upsert({ user_email: authEmail, last_attempt_time: new Date().toISOString() })
            .then(({error}) => { if(error) console.error(error); });
        lastAttemptTimestamp = Date.now();
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
        if(data.flags[i]) btn.classList.add('flag');
        if(data.currentQ === i) btn.classList.add('current');
        btn.innerText = i + 1;
        btn.onclick = () => { data.currentQ = i; renderGrid(); renderQuestion(); };
        grid.appendChild(btn);
    }
}

function renderQuestion() {
    const data = examData[activeSubjectId];
    const q = data.questions[data.currentQ];
    document.getElementById('qText').innerHTML = `Q${data.currentQ+1}. ${q.q}`;
    
    document.getElementById('qOptions').innerHTML = q.opts.map((opt, idx) => `
        <label class="opt ${data.answers[data.currentQ] === idx ? 'selected' : ''}">
            <input type="radio" name="cbtopt" value="${idx}" ${data.answers[data.currentQ] === idx ? 'checked' : ''} onchange="saveAnswer(${idx})">
            <span>${opt}</span>
        </label>
    `).join('');
    
    if(window.MathJax) MathJax.typesetPromise();
}

window.saveAnswer = function(idx) {
    // --- 10-QUESTION TRAP ---
    if (isFreeUser) {
        let totalAnswers = 0;
        for (const subId in examData) {
            totalAnswers += examData[subId].answers.filter(a => a !== null).length;
        }
        
        const currentSub = examData[activeSubjectId];
        const isAlreadyAnswered = currentSub.answers[currentSub.currentQ] !== null;
        
        if (!isAlreadyAnswered && totalAnswers >= 10) {
            clearInterval(timerId); 
            document.getElementById('examTrapModal').style.display = 'flex';
            
            const radios = document.getElementsByName('cbtopt');
            radios.forEach(r => r.checked = false);
            return; 
        }
    }

    examData[activeSubjectId].answers[examData[activeSubjectId].currentQ] = idx;
    renderGrid();
    renderQuestion(); // Re-render to show selected style
};

window.toggleFlag = function() {
    const d = examData[activeSubjectId];
    d.flags[d.currentQ] = !d.flags[d.currentQ];
    renderGrid();
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

// --- TIMER & SUBMIT CONTROLS ---
function startTimer() {
    timerId = setInterval(() => {
        durationSec--;
        if(durationSec <= 0) { clearInterval(timerId); submitExam(true); }
        
        const h = Math.floor(Math.max(0, durationSec) / 3600).toString().padStart(2, '0');
        const m = Math.floor((Math.max(0, durationSec) % 3600) / 60).toString().padStart(2, '0');
        const s = (Math.max(0, durationSec) % 60).toString().padStart(2, '0');
        
        document.getElementById('timerDisplay').innerText = h !== '00' ? `${h}:${m}:${s}` : `${m}:${s}`;
    }, 1000);
}

window.confirmSubmit = function() {
    showModal('Submit Exam', 'Are you sure you want to submit? All answers will be finalized.', () => submitExam(false));
};

window.confirmDashboardReturn = function() {
    showModal('Quit Exam?', 'Are you sure you want to quit? Your progress will be lost.', () => {
        window.location.href = 'post-utme-dashboard.html';
    });
};

async function submitExam(auto) {
    clearInterval(timerId);
    showLoading(true, "Calculating Score...");
    let totalScore = 0;
    let totalQs = 0;
    let reviewHtml = '';
    let timeSpentSec = maxDurationSec - Math.max(0, durationSec);
    const dbPayload = [];
    
    for(const subId in examData) {
        const d = examData[subId];
        let subScore = 0;
        let attempted = 0;
        reviewHtml += `<h4 style="color:var(--ion-color-primary); border-bottom:1px solid #ccc; padding-bottom:5px; margin-top:20px;">${d.name}</h4>`;
        
        d.questions.forEach((q, i) => {
            totalQs++;
            const userAns = d.answers[i];
            const correct = userAns === q.ans;
            
            if (userAns !== null) {
                attempted++;
                if (correct) subScore++;
            }
            
            reviewHtml += `
            <div style="background:var(--card-bg-selected); padding:10px; border-radius:8px; margin-bottom:10px; position: relative;">
                <p><b>Q${i+1}:</b> ${q.q}</p>
                <p style="color:${correct?'#10b981':'#ef4444'}; font-weight:bold;">Your Answer: ${userAns!==null ? q.opts[userAns] : 'None'}</p>
                ${!correct ? `<p style="color:#10b981; font-weight:bold;">Correct: ${q.opts[q.ans]}</p>` : ''}
                
                <ion-button size="small" fill="outline" color="primary" style="margin-top: 8px;" onclick="toggleNexusWidget('${subId}', ${i})">
                    Ask Nexus <img src="Logo.png" alt="Nexus" style="height: 16px; margin-left: 6px; vertical-align: middle;">
                </ion-button>

                <div id="nexus-widget-${subId}-${i}" style="display: none; margin-top: 15px; background: var(--panel); border: 1px solid var(--ion-color-primary); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="background: var(--ion-color-primary); color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; font-size: 13px;">Nexus AI Tutor</span>
                        <span onclick="toggleNexusWidget('${subId}', ${i})" style="cursor: pointer; font-size: 16px;">✖</span>
                    </div>
                    <div id="nexus-chat-${subId}-${i}" style="padding: 12px; max-height: 250px; overflow-y: auto; font-size: 14px; line-height: 1.6; color: var(--ion-text-color);">
                        <div style="color: var(--muted); text-align: center; font-style: italic;">Ask a specific question below, or click "Explain" for a full breakdown.</div>
                    </div>
                    <div style="display: flex; border-top: 1px solid rgba(128,128,128,0.2);">
                        <input type="text" id="nexus-input-${subId}-${i}" placeholder="Ask about this..." style="flex: 1; padding: 10px; border: none; outline: none; background: transparent; color: var(--ion-text-color);">
                        <button onclick="sendToNexus('${subId}', ${i}, false)" style="background: transparent; color: var(--ion-color-primary); border: none; padding: 0 12px; font-weight: bold; cursor: pointer;">Send</button>
                        <button onclick="sendToNexus('${subId}', ${i}, true)" style="background: var(--ion-color-primary); color: white; border: none; padding: 0 15px; font-weight: bold; cursor: pointer;">Explain</button>
                    </div>
                </div>
            </div>`;
        });
        totalScore += subScore;

        const scaledSubScore = Math.round((subScore / d.questions.length) * 100);
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
    
    // Save to DB
    try {
        const { error: dbError } = await _sb.from('putme_exam_results').insert(dbPayload);
        if (dbError) console.error("Database Insert Error:", dbError);
    } catch (err) {
        console.error("Network/DB Request Failed:", err);
    }

    const finalScaled = Math.round((totalScore / totalQs) * 400);
    
    setTimeout(() => {
        const finalScoreEl = document.getElementById('finalScore');
        if (finalScoreEl) finalScoreEl.innerText = `${finalScaled}/400`;
        const finalTotalScore = document.getElementById('finalTotalScore');
        if (finalTotalScore) finalTotalScore.innerText = `${finalScaled}/400`; // Updated fallback ID
        
        document.getElementById('reviewList').innerHTML = reviewHtml;
        if(window.MathJax) MathJax.typesetPromise();
        switchView('view-review');
        showLoading(false);
        
        if (auto) showModal('Time Up!', 'Your exam time has elapsed. Your answers have been submitted automatically.', null, false);
    }, 1000);
}

// --- CALCULATOR (Functional & Draggable) ---
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

// Drag Logic
const calcEl = document.getElementById('calc');
if (calcEl) {
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
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        calcEl.style.left = `${initialX + dx}px`;
        calcEl.style.top = `${initialY + dy}px`;
    }

    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }
}

// --- MINI NEXUS WIDGET LOGIC ---
window.toggleNexusWidget = function(subId, qIndex) {
    const widget = document.getElementById(`nexus-widget-${subId}-${qIndex}`);
    widget.style.display = widget.style.display === 'block' ? 'none' : 'block';
};

window.sendToNexus = async function(subId, qIndex, isAutoExplain) {
    const chatArea = document.getElementById(`nexus-chat-${subId}-${qIndex}`);
    const inputField = document.getElementById(`nexus-input-${subId}-${qIndex}`);
    
    let userMessage = inputField.value.trim();
    const qData = examData[subId].questions[qIndex];
    const questionText = qData.q;
    const correctAnswer = qData.opts[qData.ans];

    let promptToAI = "";

    if (isAutoExplain) {
        promptToAI = `Act as an expert tutor. Please explain step-by-step why the correct answer to this question is "${correctAnswer}". \n\nQuestion: ${questionText}`;
        chatArea.innerHTML = `<div style="font-weight:bold; margin-bottom:8px;">Explain this question.</div>`;
    } else {
        if (!userMessage) return;
        promptToAI = `Regarding this question: "${questionText}" (Correct Answer: ${correctAnswer}). \n\nStudent asks: ${userMessage}`;
        chatArea.innerHTML += `<div style="font-weight:bold; margin-bottom:8px; margin-top: 15px;">You: ${userMessage}</div>`;
        inputField.value = ''; 
    }

    const responseContainer = document.createElement('div');
    responseContainer.innerHTML = `<span style="color: var(--ion-color-primary); font-weight: bold;">Nexus is thinking...</span>`;
    chatArea.appendChild(responseContainer);
    chatArea.scrollTop = chatArea.scrollHeight;

    try {
        const response = await fetch('https://scholars-prep.vercel.app/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: promptToAI }] })
        });

        if (!response.ok) throw new Error("Network Error");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiFullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            aiFullText += decoder.decode(value, { stream: true });
            responseContainer.innerHTML = window.marked ? marked.parse(aiFullText) : aiFullText;
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        if (window.MathJax) {
            MathJax.typesetPromise([responseContainer]).catch(err => console.error(err));
        }
    } catch (error) {
        responseContainer.innerHTML = `<span style="color: var(--ion-color-danger);">Connection error. Please try again.</span>`;
        console.error("Nexus Widget Error:", error);
    }
};

// --- PAYSTACK & TRAP ACTIONS ---
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 

window.forceSubmitFreeExam = function() {
    document.getElementById('examTrapModal').style.display = 'none';
    submitExam(false); // Instantly score their 10 questions and show summary
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
        
        isFreeUser = false; // Turn off the trap!
        cached.isPremium = true;
        localStorage.setItem('putme_premium_data', JSON.stringify(cached));
        
        alert("Payment successful! Your exam is unlocked. You may continue."); 
        startTimer(); // Resume the clock!
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
            plan_type: 'Pro Access' 
        },
        callback: onPaymentSuccess,
        onClose: function() {
            console.log('Payment window closed.');
        }
    });
    handler.openIframe();
};