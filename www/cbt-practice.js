// --- 1. CORE CONFIG & SECURITY ---
(function initContentProtection() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || e.keyCode === 123) return e.preventDefault();
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(e.key.toLowerCase())) return e.preventDefault();
    }, { capture: true });
})();

const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(function protectPage() {
    if (!localStorage.getItem('abupq_logged_in_user')) window.location.replace('index.html'); 
})();

// --- 2. STATE & FAST PASS ENGINE ---
let subjectsData = [];
let examData = {}; 
let activeSubjectCode = null;
let durationSec = 0;
let maxDurationSec = 0; 
let timerId = null;
const MAX_COURSES = 13;

let isFreeUser = false;
let isFastPass = false;

// URL Params for Fast Pass
const urlParams = new URLSearchParams(window.location.search);
const fpCourse = urlParams.get('course');
const fpYear = urlParams.get('year');
const fpType = urlParams.get('type') || 'exam';
const fpAutoStart = urlParams.get('autoStart');

// Theme Sync
if (localStorage.getItem('sp_theme') === 'dark') document.body.classList.add('dark');

document.addEventListener('DOMContentLoaded', async () => {
    if (fpAutoStart === 'true' && fpCourse && fpYear) {
        isFastPass = true;
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('loadingText').innerText = "Initializing Fast Pass CBT...";
        
        // Push the single course into selection memory, then jump to instructions
        subjectsData.push({ code: fpCourse, name: fpCourse });
        
        // We artificially select it in the DOM even though it's hidden
        const fakeCard = document.createElement('div');
        fakeCard.className = 'subject-card selected';
        fakeCard.id = `card-${fpCourse}`;
        fakeCard.innerHTML = `
            <input type="hidden" id="type-${fpCourse}" value="${fpType}">
            <input type="hidden" id="yr-${fpCourse}" value="${fpYear}">
            <input type="hidden" id="qc-${fpCourse}" value="50">
        `;
        document.body.appendChild(fakeCard);

        switchView('view-instructions');
    } else {
        switchView('view-selection');
        loadSubjects();
    }
});

// --- 3. CUSTOM MODAL ENGINE ---
window.showGenericModal = function(title, message, buttonsHTML = null) {
    document.getElementById('genericModalTitle').innerText = title;
    document.getElementById('genericModalMessage').innerText = message;
    
    const icon = document.getElementById('genericModalIcon');
    icon.setAttribute('name', title.toLowerCase().includes('error') || title.toLowerCase().includes('limit') ? 'warning-outline' : 'information-circle-outline');
    icon.setAttribute('color', title.toLowerCase().includes('error') || title.toLowerCase().includes('limit') ? 'warning' : 'primary');
    
    const btnContainer = document.getElementById('genericModalButtons');
    if (buttonsHTML) {
        btnContainer.innerHTML = buttonsHTML;
    } else {
        btnContainer.innerHTML = `<ion-button class="green-outline-btn" expand="block" style="width: 100%" onclick="document.getElementById('genericModal').style.display='none'">OK</ion-button>`;
    }
    
    document.getElementById('genericModal').style.display = 'flex';
};

function switchView(viewId) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// --- 4. LOAD SUBJECTS (Normal Flow) ---
async function loadSubjects() {
    try {
        const { data: courses, error } = await _sb.from('ss_courses').select('*').order('code', { ascending: true });
        if (error) throw error;

        const container = document.getElementById('subjectListContainer');
        container.innerHTML = '';
        subjectsData = courses;

        courses.forEach(sub => {
            const iconName = sub.icon || 'book-outline';
            container.innerHTML += `
            <div class="subject-card" id="card-${sub.code}" onclick="toggleSubject('${sub.code}')">
                <ion-item lines="none" style="--background: transparent; cursor: pointer;">
                    <ion-icon name="${iconName}" slot="start" color="primary"></ion-icon>
                    <ion-label style="font-weight: bold; color: var(--ion-text-color);">${sub.code}</ion-label>
                    <ion-checkbox slot="end" id="chk-${sub.code}" style="pointer-events: none;"></ion-checkbox>
                </ion-item>
                <div class="config-area" onclick="event.stopPropagation()">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <ion-item fill="outline" style="--border-radius: 8px; --background: transparent; flex: 1;">
                            <ion-label position="stacked" style="color: var(--ion-color-primary);">Type</ion-label>
                            <ion-select id="type-${sub.code}" interface="popover" value="exam" style="color: var(--ion-text-color);">
                                <ion-select-option value="exam">Exam</ion-select-option>
                                <ion-select-option value="test">Test</ion-select-option>
                            </ion-select>
                        </ion-item>
                        <ion-item fill="outline" style="--border-radius: 8px; --background: transparent; flex: 1;">
                            <ion-label position="stacked" style="color: var(--ion-color-primary);">Questions</ion-label>
                            <ion-select id="qc-${sub.code}" interface="popover" value="50" style="color: var(--ion-text-color);">
                                <ion-select-option value="10">10</ion-select-option>
                                <ion-select-option value="20">20</ion-select-option>
                                <ion-select-option value="30">30</ion-select-option>
                                <ion-select-option value="40">40</ion-select-option>
                                <ion-select-option value="50">50</ion-select-option>
                            </ion-select>
                        </ion-item>
                    </div>
                    <div style="margin-top: 10px;">
                        <ion-input type="number" id="yr-${sub.code}" placeholder="Enter Year (e.g. 2023)" style="border: 1.5px solid var(--ion-color-primary); border-radius: 8px; padding-left: 10px; color: var(--ion-text-color);"></ion-input>
                    </div>
                </div>
            </div>`;
        });

        document.getElementById('loadingSpinner').style.display = 'none';
        container.style.display = 'block';

    } catch (err) {
        console.error(err);
        showGenericModal("Error", "Failed to load subjects. Check your connection.");
    }
}

window.filterSubjects = function(event) {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll('.subject-card').forEach(card => {
        const subjectName = card.querySelector('ion-label').innerText.toLowerCase();
        card.style.display = subjectName.includes(query) ? 'block' : 'none';
    });
};

window.toggleSubject = function(code) {
    const card = document.getElementById(`card-${code}`);
    const chk = document.getElementById(`chk-${code}`);
    
    // Check limit if they are trying to select a new one
    if (!card.classList.contains('selected')) {
        const selectedCount = document.querySelectorAll('.subject-card.selected').length;
        if (selectedCount >= MAX_COURSES) {
            showGenericModal("Limit Reached", `You can only select up to ${MAX_COURSES} courses at once.`);
            return;
        }
    }
    
    card.classList.toggle('selected');
    chk.checked = card.classList.contains('selected');
};

window.goToInstructions = function() {
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    if(selectedCards.length === 0) {
        showGenericModal("Notice", "Please select at least one subject.");
        return;
    }

    for (let card of selectedCards) {
        const code = card.id.replace('card-', '');
        if(!document.getElementById(`yr-${code}`).value) {
            showGenericModal("Notice", `Please enter a year for ${code}.`);
            return;
        }
    }
    switchView('view-instructions');
}

window.handleBackFromInstructions = function() {
    if (isFastPass) {
        window.location.replace(`course-details.html?course=${fpCourse}`);
    } else {
        switchView('view-selection');
    }
}

// --- 5. START EXAM (Data Fetch & Security) ---
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

async function startExam() {
    switchView('view-selection'); // Temporary hide while loading
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('loadingText').innerText = "Building Exam Engine...";
    
    durationSec = parseInt(document.getElementById('examDuration') ? document.getElementById('examDuration').value : 120) * 60;
    maxDurationSec = durationSec;
    examData = {};
    
    const tabsContainer = document.getElementById('examSubjectTabs');
    tabsContainer.innerHTML = '';
    
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    const authUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));

    try {
        // Master Freemium Check
        const [settingsRes, subRes] = await Promise.all([
            _sb.from('app_settings').select('payment_active').single(),
            _sb.from('profiles').select('subscription_end').eq('id', authUser.id).maybeSingle()
        ]);

        let isSwitchActive = settingsRes.data?.payment_active ?? true;
        let isPremium = false;
        if (subRes.data && subRes.data.subscription_end) {
            if (new Date(subRes.data.subscription_end) > new Date()) isPremium = true;
        }
        isFreeUser = (isSwitchActive && !isPremium);

        let isFirst = true;

        for(let card of selectedCards) {
            const code = card.id.replace('card-', '');
            const type = document.getElementById(`type-${code}`).value;
            const year = document.getElementById(`yr-${code}`).value;
            const limit = parseInt(document.getElementById(`qc-${code}`).value);

            const targetTable = type === 'test' ? 'ss_test_questions' : 'ss_exam_questions';

            // Fetch questions sequentially
            const { data: rawData, error } = await _sb.from(targetTable).select('*').eq('course_code', code).eq('year', year).limit(limit);
            if (error) console.error("Fetch error for", code, error);

            if (rawData && rawData.length > 0) {
                examData[code] = {
                    name: code,
                    questions: rawData.map(q => {
                        const parsedOpts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                        return { 
                            q: fixMathText(q.question_text || q.question), 
                            opts: parsedOpts.map(o => fixMathText(o)), 
                            ans: parseInt(q.answer) 
                        };
                    }),
                    answers: Array(rawData.length).fill(null),
                    flags: Array(rawData.length).fill(false),
                    currentQ: 0
                };
                
                if(isFirst) { activeSubjectCode = code; isFirst = false; }
                tabsContainer.innerHTML += `<div class="tab-pill" id="tab-${code}" onclick="switchSubject('${code}')">${code}</div>`;
            }
        }
        
        if(!activeSubjectCode) { 
            document.getElementById('loadingSpinner').style.display = 'none';
            showGenericModal("Error", "No questions found for the selected courses and years. Please adjust your setup.");
            switchView('view-instructions');
            return; 
        }

        switchSubject(activeSubjectCode);
        startTimer();
        document.getElementById('loadingSpinner').style.display = 'none';
        switchView('view-exam');

    } catch (err) {
        console.error(err);
        document.getElementById('loadingSpinner').style.display = 'none';
        showGenericModal("Error", "Failed to start the exam. Please check your connection.");
        switchView('view-instructions');
    }
}

// --- 6. EXAM UI LOGIC ---
window.switchSubject = function(code) {
    activeSubjectCode = code;
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${code}`).classList.add('active');
    renderGrid();
    renderQuestion();
};

function renderGrid() {
    const data = examData[activeSubjectCode];
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
            if (isFreeUser && i >= 10) {
                document.getElementById('examTrapModal').style.display = 'flex';
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
    const data = examData[activeSubjectCode];
    const q = data.questions[data.currentQ];
    document.getElementById('qText').innerHTML = `Q${data.currentQ+1}. ${q.q}`;
    
    document.getElementById('qOptions').innerHTML = q.opts.map((opt, idx) => `
        <label class="opt ${data.answers[data.currentQ] === idx ? 'selected' : ''}">
            <input type="radio" name="cbtopt" value="${idx}" ${data.answers[data.currentQ] === idx ? 'checked' : ''} onchange="saveAnswer(${idx})" style="display: none;">
            <span>${String.fromCharCode(65 + idx)}) ${opt}</span>
        </label>
    `).join('');
    
    if(window.MathJax) {
        MathJax.typesetClear();
        MathJax.typesetPromise().catch(err => console.error(err));
    }
}

window.saveAnswer = function(idx) {
    if (isFreeUser) {
        let totalAnswers = 0;
        for (const code in examData) {
            totalAnswers += examData[code].answers.filter(a => a !== null).length;
        }
        const currentSub = examData[activeSubjectCode];
        const isAlreadyAnswered = currentSub.answers[currentSub.currentQ] !== null;
        
        if (!isAlreadyAnswered && totalAnswers >= 10) {
            document.getElementById('examTrapModal').style.display = 'flex';
            renderQuestion(); // Resets the radio UI
            return; 
        }
    }

    examData[activeSubjectCode].answers[examData[activeSubjectCode].currentQ] = idx;
    renderGrid();
    renderQuestion(); 
};

window.toggleFlag = function() {
    const d = examData[activeSubjectCode];
    d.flags[d.currentQ] = !d.flags[d.currentQ];
    renderGrid();
};

window.nextQuestion = function() {
    if (isFreeUser && examData[activeSubjectCode].currentQ + 1 >= 10) {
        document.getElementById('examTrapModal').style.display = 'flex';
        return;
    }
    if(examData[activeSubjectCode].currentQ < examData[activeSubjectCode].questions.length - 1) {
        examData[activeSubjectCode].currentQ++;
        renderGrid(); renderQuestion();
    }
};

window.prevQuestion = function() {
    if(examData[activeSubjectCode].currentQ > 0) {
        examData[activeSubjectCode].currentQ--;
        renderGrid(); renderQuestion();
    }
};

// --- 7. TIMER & SUBMIT ---
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
    showGenericModal('Submit Exam', 'Are you sure you want to submit? All answers will be finalized.', 
        `<ion-button class="green-outline-btn" style="flex:1" onclick="document.getElementById('genericModal').style.display='none'">Cancel</ion-button>
         <ion-button color="primary" style="flex:1; font-weight: bold;" onclick="submitExam(false); document.getElementById('genericModal').style.display='none'">Yes, Submit</ion-button>`
    );
};

window.confirmDashboardReturn = function() {
    showGenericModal('Quit Exam?', 'Are you sure you want to quit? Your progress will be lost.', 
        `<ion-button class="green-outline-btn" style="flex:1" onclick="document.getElementById('genericModal').style.display='none'">Cancel</ion-button>
         <ion-button color="danger" style="flex:1; font-weight: bold;" onclick="window.location.href='dashboard.html'">Quit</ion-button>`
    );
};

async function submitExam(auto) {
    clearInterval(timerId);
    switchView('view-selection'); // Hide exam
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('loadingText').innerText = "Calculating Score...";
    
    let totalScore = 0;
    let totalQs = 0;
    let reviewHtml = '';
    
    for(const code in examData) {
        const d = examData[code];
        let subScore = 0;
        reviewHtml += `<h4 style="color:var(--ion-color-primary); border-bottom:1.5px solid rgba(128,128,128,0.2); padding-bottom:8px; margin-top:25px;">${d.name}</h4>`;
        
        const FREE_REVIEW_LIMIT = 10;
        let showPaywall = false;

        d.questions.forEach((q, i) => {
            totalQs++;
            const userAns = d.answers[i];
            const correct = userAns === q.ans;
            if (userAns !== null) {
                if (correct) subScore++;
            }
            
            if (!isFreeUser || i < FREE_REVIEW_LIMIT) {
                reviewHtml += `
                <div style="background:var(--card-bg); border: 1.5px solid rgba(128,128,128,0.2); padding:15px; border-radius:12px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    <p style="color: var(--ion-text-color); line-height: 1.6;"><b>Q${i+1}:</b> ${q.q}</p>
                    <p style="color:${correct?'#10b981':'var(--ion-color-danger)'}; font-weight:bold;">Your Answer: ${userAns!==null ? q.opts[userAns] : 'None'}</p>
                    ${!correct ? `<p style="color:#10b981; font-weight:bold;">Correct: ${q.opts[q.ans]}</p>` : ''}
                </div>`;
            } else {
                showPaywall = true;
            }
        });

        if (showPaywall) {
            const hiddenCount = d.questions.length - FREE_REVIEW_LIMIT;
            reviewHtml += `
            <div style="background: var(--card-bg); border: 2px dashed var(--ion-color-primary); border-radius: 14px; padding: 20px; text-align: center; margin-top: 15px;">
                <ion-icon name="lock-closed" color="primary" style="font-size: 36px; margin-bottom: 8px;"></ion-icon>
                <h3 style="margin: 0 0 8px; font-weight: bold; color: var(--ion-text-color);">Free Limit Reached</h3>
                <p style="margin: 0 0 15px; color: var(--muted); font-size: 14px;">Activate the app to view the remaining <strong>${hiddenCount} questions</strong>.</p>
                <ion-button expand="block" color="primary" style="--border-radius: 10px; font-weight: bold;" onclick="triggerPaystack()">
                    <ion-icon name="key-outline" slot="start"></ion-icon> Activate App
                </ion-button>
            </div>`;
        }
        totalScore += subScore;
    }
    
    const finalScaled = Math.round((totalScore / totalQs) * 400);
    
    setTimeout(() => {
        document.getElementById('finalScore').innerText = `${finalScaled}/400`;
        document.getElementById('reviewList').innerHTML = reviewHtml;
        if(window.MathJax) {
            MathJax.typesetClear();
            MathJax.typesetPromise().catch(err => console.error(err));
        }
        document.getElementById('loadingSpinner').style.display = 'none';
        switchView('view-review');
        
        if (auto) showGenericModal('Time Up!', 'Your exam time has elapsed. Your answers have been submitted automatically.');
    }, 1000);
}

window.forceSubmitFreeExam = function() {
    document.getElementById('examTrapModal').style.display = 'none';
    submitExam(false); 
};

window.triggerPaystack = function() {
    document.getElementById('examTrapModal').style.display = 'none';
    const user = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    
    PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: user.email,
        amount: 2500 * 100, 
        currency: 'NGN', 
        ref: 'SP_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: { user_id: user.id, email: user.email },
        callback: function(response) {
            document.getElementById('loadingSpinner').style.display = 'block';
            document.getElementById('loadingText').innerText = "Activating Account...";
            _sb.from('profiles').upsert({ id: user.id, subscription_end: '2026-12-31' }).then(() => {
                isFreeUser = false; // Disable trap!
                document.getElementById('loadingSpinner').style.display = 'none';
                showGenericModal("Success", "Payment successful! Your exam is unlocked. You may continue."); 
            });
        },
        onClose: function() { }
    }).openIframe();
};

// --- 8. CALCULATOR ---
window.toggleCalc = () => { const c = document.getElementById('calc'); c.style.display = c.style.display === 'block' ? 'none' : 'block'; };
window.ins = (ch) => document.getElementById('calcInput').value += ch;
window.clr = () => { document.getElementById('calcInput').value=''; document.getElementById('calcOut').innerText='—'; };
window.evalCalc = () => {
    try { 
        const input = document.getElementById('calcInput').value;
        if(!/^[0-9+\-*/().\s]+$/.test(input)) throw new Error();
        document.getElementById('calcOut').innerText = new Function('return ' + input)(); 
    } 
    catch(e) { document.getElementById('calcOut').innerText = 'Error'; }
};

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
        initialX = rect.left; initialY = rect.top;
        startX = clientX; startY = clientY;
        calcEl.style.right = 'auto'; calcEl.style.bottom = 'auto'; calcEl.style.margin = '0';
        
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