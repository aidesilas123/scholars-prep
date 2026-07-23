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
let activeSubjectId = null;
let durationSec = 0;
let maxDurationSec = 0; 
let timerId = null;
const MAX_COURSES = 13;

let isFreeUser = false;
let isFastPass = false;
let globalYearsMap = {}; 

const urlParams = new URLSearchParams(window.location.search);
const fpCourseId = urlParams.get('id');
const fpYear = urlParams.get('year');
const fpType = urlParams.get('type') || 'exam';
const fpAutoStart = urlParams.get('autoStart');

if (localStorage.getItem('sp_theme') === 'dark') document.body.classList.add('dark');

document.addEventListener('DOMContentLoaded', async () => {
    if (fpAutoStart === 'true' && fpCourseId && fpYear) {
        isFastPass = true;
        showGlobalLoading("Initializing Fast Pass CBT...");
        
        // Fetch the exact course code for UI population during Fast Pass
        const { data: cData } = await _sb.from('ss_courses').select('*').eq('id', fpCourseId).single();
        const courseCode = cData ? cData.code : `Course ${fpCourseId}`;
        subjectsData.push({ id: fpCourseId, code: courseCode });
        
        const fakeCard = document.createElement('div');
        fakeCard.className = 'subject-card selected';
        fakeCard.id = `card-${fpCourseId}`;
        fakeCard.innerHTML = `
            <input type="hidden" id="type-${fpCourseId}" value="${fpType}">
            <input type="hidden" id="yr-${fpCourseId}" value="${fpYear}">
            <input type="hidden" id="qc-${fpCourseId}" value="50">
        `;
        document.body.appendChild(fakeCard);

        hideGlobalLoading();
        switchView('view-instructions');
    } else {
        switchView('view-selection');
        loadSubjects();
    }
});

// --- 3. CUSTOM MODAL & VIEWS ---
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

// Full-screen loading overlay to prevent flashes
function showGlobalLoading(text) {
    document.getElementById('globalLoadingText').innerText = text;
    document.getElementById('globalLoading').style.display = 'flex';
}

function hideGlobalLoading() {
    document.getElementById('globalLoading').style.display = 'none';
}

// --- 4. LOAD SUBJECTS (Split Display & Dropdown Fetch) ---
async function loadSubjects() {
    const savedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    
    try {
        // Look up the correct user_custom_courses table and fetch questions mapped by course_id
        const [coursesRes, customCoursesRes, testRes, examRes] = await Promise.all([
            _sb.from('ss_courses').select('*').order('code', { ascending: true }),
            _sb.from('user_custom_courses').select('course_code').eq('user_id', savedUser.id),
            _sb.from('ss_test_questions').select('course_id, year'),
            _sb.from('ss_exam_questions').select('course_id, year')
        ]);

        if (coursesRes.error) throw coursesRes.error;

        subjectsData = coursesRes.data;
        const userSavedCourses = customCoursesRes.data ? customCoursesRes.data.map(row => row.course_code) : [];
        
        // Build the Year Map dynamically mapped by ID
        if (testRes.data) {
            testRes.data.forEach(row => {
                if(!globalYearsMap[row.course_id]) globalYearsMap[row.course_id] = new Set();
                globalYearsMap[row.course_id].add(row.year);
            });
        }
        if (examRes.data) {
            examRes.data.forEach(row => {
                if(!globalYearsMap[row.course_id]) globalYearsMap[row.course_id] = new Set();
                globalYearsMap[row.course_id].add(row.year);
            });
        }

        const myList = document.getElementById('myCoursesList');
        const availableList = document.getElementById('availableCoursesList');
        myList.innerHTML = '';
        availableList.innerHTML = '';

        subjectsData.forEach(sub => {
            const iconName = sub.icon || 'book-outline';
            let yearsOptions = '<ion-select-option value="">No Questions</ion-select-option>';
            
            if (globalYearsMap[sub.id] && globalYearsMap[sub.id].size > 0) {
                const sortedYears = Array.from(globalYearsMap[sub.id]).sort((a,b) => b - a);
                yearsOptions = sortedYears.map(y => `<ion-select-option value="${y}">${y}</ion-select-option>`).join('');
            }

            const cardHTML = `
            <div class="subject-card" id="card-${sub.id}" onclick="toggleSubject('${sub.id}')">
                <ion-item lines="none" style="--background: transparent; cursor: pointer;">
                    <ion-icon name="${iconName}" slot="start" color="primary"></ion-icon>
                    <ion-label style="font-weight: bold; color: var(--ion-text-color);">${sub.code}</ion-label>
                    <ion-checkbox slot="end" id="chk-${sub.id}" style="pointer-events: none;"></ion-checkbox>
                </ion-item>
                <div class="config-area" onclick="event.stopPropagation()">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <ion-item fill="outline" style="--border-radius: 8px; --background: transparent; flex: 1;">
                            <ion-label position="stacked" style="color: var(--ion-color-primary);">Type</ion-label>
                            <ion-select id="type-${sub.id}" interface="popover" value="exam" style="color: var(--ion-text-color);">
                                <ion-select-option value="exam">Exam</ion-select-option>
                                <ion-select-option value="test">Test</ion-select-option>
                            </ion-select>
                        </ion-item>
                        <ion-item fill="outline" style="--border-radius: 8px; --background: transparent; flex: 1;">
                            <ion-label position="stacked" style="color: var(--ion-color-primary);">Questions</ion-label>
                            <ion-select id="qc-${sub.id}" interface="popover" value="50" style="color: var(--ion-text-color);">
                                <ion-select-option value="10">10</ion-select-option>
                                <ion-select-option value="20">20</ion-select-option>
                                <ion-select-option value="30">30</ion-select-option>
                                <ion-select-option value="40">40</ion-select-option>
                                <ion-select-option value="50">50</ion-select-option>
                            </ion-select>
                        </ion-item>
                    </div>
                    <div style="margin-top: 10px;">
                        <ion-item fill="outline" style="--border-radius: 8px; --background: transparent;">
                            <ion-label position="stacked" style="color: var(--ion-color-primary);">Select Year</ion-label>
                            <ion-select id="yr-${sub.id}" interface="popover" placeholder="Select Year" style="color: var(--ion-text-color);">
                                ${yearsOptions}
                            </ion-select>
                        </ion-item>
                    </div>
                </div>
            </div>`;

            if (userSavedCourses.includes(sub.code)) {
                myList.innerHTML += cardHTML;
            } else {
                availableList.innerHTML += cardHTML;
            }
        });

        document.getElementById('myCoursesTitle').style.display = userSavedCourses.length > 0 ? 'block' : 'none';
        document.getElementById('availableCoursesTitle').style.display = 'block';
        
        document.getElementById('inlineLoadingSpinner').style.display = 'none';
        document.getElementById('subjectListContainer').style.display = 'block';

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

window.toggleSubject = function(id) {
    const card = document.getElementById(`card-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    
    if (!card.classList.contains('selected')) {
        if (document.querySelectorAll('.subject-card.selected').length >= MAX_COURSES) {
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
        const id = card.id.replace('card-', '');
        const courseCodeForAlert = subjectsData.find(s => s.id == id)?.code || "this course";
        if(!document.getElementById(`yr-${id}`).value) {
            showGenericModal("Notice", `Please select a year for ${courseCodeForAlert} from the dropdown.`);
            return;
        }
    }
    switchView('view-instructions');
}

window.handleBackFromInstructions = function() {
    if (isFastPass) window.location.replace(`course-details.html?id=${fpCourseId}`);
    else switchView('view-selection');
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

// Added Shuffle Engine
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

async function startExam() {
    
    showGlobalLoading("Loading, Please Wait...");
    
    durationSec = parseInt(document.getElementById('examDuration') ? document.getElementById('examDuration').value : 60) * 60;
    maxDurationSec = durationSec;
    examData = {};
    
    const tabsContainer = document.getElementById('examSubjectTabs');
    tabsContainer.innerHTML = '';
    
    const selectedCards = document.querySelectorAll('.subject-card.selected');
    const authUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));

    try {
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
            const courseId = card.id.replace('card-', '');
            const type = document.getElementById(`type-${courseId}`).value;
            const year = document.getElementById(`yr-${courseId}`).value;
            const limit = parseInt(document.getElementById(`qc-${courseId}`).value);
            const targetTable = type === 'test' ? 'ss_test_questions' : 'ss_exam_questions';

            // Find course code for UI display
            const courseObj = subjectsData.find(s => s.id == courseId);
            const courseCodeText = courseObj ? courseObj.code : `Course ${courseId}`;

            // --- NETWORK RETRY & ORDERING WRAPPER ---
            let rawData = null;
            let fetchError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { data, error } = await _sb.from(targetTable)
                        .select('*')
                        .eq('course_id', courseId)
                        .eq('year', year)
                        .order('id', { ascending: true }); // PREVENTS GLITCH

                    if (error) throw error;
                    rawData = data;
                    fetchError = null;
                    break;
                } catch (err) {
                    fetchError = err;
                    if (attempt === 3) console.error("Fetch error for", courseId, err);
                    await new Promise(res => setTimeout(res, 1000));
                }
            }

            if (fetchError) continue; // Skip if it consistently fails so other subjects still load

            if (rawData && rawData.length > 0) {
                // Shuffle the entire pool, then grab the exact number requested
                const randomizedQuestions = shuffleArray(rawData).slice(0, limit);

                examData[courseId] = {
                    name: courseCodeText,
                    type: type,
                    questions: randomizedQuestions.map(q => {
                        const parsedOpts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                        return { 
                            q: fixMathText(q.question_text || q.question), 
                            opts: parsedOpts.map(o => fixMathText(o)), 
                            ans: parseInt(q.answer) 
                        };
                    }),
                    answers: Array(randomizedQuestions.length).fill(null),
                    flags: Array(randomizedQuestions.length).fill(false),
                    currentQ: 0
                };
                
                if(isFirst) { activeSubjectId = courseId; isFirst = false; }
                tabsContainer.innerHTML += `<div class="tab-pill" id="tab-${courseId}" onclick="switchSubject('${courseId}')">${courseCodeText}</div>`;
            }
        }
        
        if(!activeSubjectId) { 
            hideGlobalLoading();
            showGenericModal("Error", "No questions found for the selected courses and years. Please adjust your setup.");
            return; 
        }

        switchSubject(activeSubjectId);
        startTimer();
        hideGlobalLoading();
        switchView('view-exam');

    } catch (err) {
        console.error(err);
        hideGlobalLoading();
        showGenericModal("Error", "Failed to start the exam. Please check your connection.");
    }
}

// --- 6. EXAM UI LOGIC ---
window.switchSubject = function(id) {
    activeSubjectId = id;
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
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
    const data = examData[activeSubjectId];
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
        for (const id in examData) {
            totalAnswers += examData[id].answers.filter(a => a !== null).length;
        }
        const currentSub = examData[activeSubjectId];
        const isAlreadyAnswered = currentSub.answers[currentSub.currentQ] !== null;
        
        if (!isAlreadyAnswered && totalAnswers >= 10) {
            document.getElementById('examTrapModal').style.display = 'flex';
            renderQuestion(); 
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
    if (isFreeUser && examData[activeSubjectId].currentQ + 1 >= 10) {
        document.getElementById('examTrapModal').style.display = 'flex';
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
         <ion-button color="danger" fill="solid" style="flex:1; font-weight: bold;" onclick="submitExam(false); document.getElementById('genericModal').style.display='none'">Yes, Submit</ion-button>`
    );
};

window.confirmDashboardReturn = function() {
    showGenericModal('Quit Exam?', 'Are you sure you want to quit? Your progress will be lost.', 
        `<ion-button class="green-outline-btn" style="flex:1" onclick="document.getElementById('genericModal').style.display='none'">Cancel</ion-button>
         <ion-button color="danger" fill="solid" style="flex:1; font-weight: bold;" onclick="window.location.href='dashboard.html'">Quit</ion-button>`
    );
};

async function submitExam(auto) {
    clearInterval(timerId);
    showGlobalLoading("Calculating Score...");

    let reviewHtml = '';
    let summaryTable = `
    <h3 style="margin-top: 0; font-weight: bold; color: var(--ion-text-color); text-align: center;">Final Summary</h3>
    <table style="width: 100%; border-collapse: collapse; text-align: left; margin-top: 15px; font-size: 15px;">
        <thead>
            <tr style="border-bottom: 2px solid var(--ion-color-primary); color: var(--ion-text-color);">
                <th style="padding: 10px 5px;">Course</th>
                <th style="padding: 10px 5px;">Type</th>
                <th style="padding: 10px 5px; text-align: center;">Score</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    for(const id in examData) {
        const d = examData[id];
        let subScore = 0;
        let maxPossible = d.type === 'test' ? 40 : 60; // SCORING RULES
        
        const FREE_REVIEW_LIMIT = 10;
        let showPaywall = false;

        d.questions.forEach((q, i) => {
            const userAns = d.answers[i];
            const correct = userAns === q.ans;
            if (userAns !== null && correct) subScore++;
            
            if (!isFreeUser || i < FREE_REVIEW_LIMIT) {
                reviewHtml += `
                <div style="background:var(--card-bg); border: 1.5px solid rgba(128,128,128,0.2); padding:15px; border-radius:12px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    <p style="color: var(--ion-text-color); line-height: 1.6;"><b>Q${i+1}:</b> ${q.q}</p>
                    <p style="color:${correct?'#10b981':'var(--ion-color-danger)'}; font-weight:bold;">Your Answer: ${userAns!==null ? q.opts[userAns] : 'None'}</p>
                    ${!correct ? `<p style="color:#10b981; font-weight:bold;">Correct: ${q.opts[q.ans]}</p>` : ''}
                    
                    <ion-button size="small" class="green-outline-btn" style="margin-top: 15px;" onclick="toggleNexusWidget('${id}', ${i})">
                        Ask Nexus <img src="Logo.png" alt="Nexus" style="height: 16px; margin-left: 6px; vertical-align: middle;">
                    </ion-button>

                    <div id="nexus-widget-${id}-${i}" style="display: none; margin-top: 15px; background: var(--card-bg); border: 1.5px solid var(--ion-color-primary); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="background: var(--ion-color-primary); color: white; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; font-size: 13px;">Nexus AI Tutor</span>
                            <span onclick="toggleNexusWidget('${id}', ${i})" style="cursor: pointer; font-size: 16px;">✖</span>
                        </div>
                        <div id="nexus-chat-${id}-${i}" style="padding: 15px; max-height: 250px; overflow-y: auto; font-size: 14px; line-height: 1.6; color: var(--ion-text-color);">
                            <div style="color: var(--muted); text-align: center; font-style: italic;">Ask a specific question below.</div>
                        </div>
                        <div style="display: flex; border-top: 1px solid rgba(128,128,128,0.2);">
                            <input type="text" id="nexus-input-${id}-${i}" placeholder="Ask about this..." style="flex: 1; padding: 12px; border: none; outline: none; background: transparent; color: var(--ion-text-color);">
                            <button onclick="sendToNexus('${id}', ${i}, false)" style="background: transparent; color: var(--ion-color-primary); border: none; padding: 0 16px; font-weight: bold; cursor: pointer;">Send</button>
                        </div>
                    </div>
                </div>`;
            } else {
                showPaywall = true;
            }
        });

        // Calculate Final Scaled Score for this course
        let finalSubScore = Math.round((subScore / d.questions.length) * maxPossible);
        let isHigh = finalSubScore >= (maxPossible / 2);
        let scoreColor = isHigh ? '#10b981' : 'var(--ion-color-danger)';

        // Inject Course Total before its review section
        const reviewHeader = `<h4 style="color:var(--ion-color-primary); border-bottom:1.5px solid rgba(128,128,128,0.2); padding-bottom:8px; margin-top:25px;">${d.name} <span style="float: right; color: ${scoreColor};">${finalSubScore}/${maxPossible}</span></h4>`;
        reviewHtml = reviewHeader + reviewHtml;

        // Add to Summary Table
        summaryTable += `
            <tr style="border-bottom: 1px solid rgba(128,128,128,0.2); color: var(--ion-text-color);">
                <td style="padding: 12px 5px; font-weight: bold;">${d.name}</td>
                <td style="padding: 12px 5px; text-transform: capitalize;">${d.type}</td>
                <td style="padding: 12px 5px; text-align: center; font-weight: bold; color: ${scoreColor};">${finalSubScore}/${maxPossible}</td>
            </tr>
        `;

        if (showPaywall) {
            const hiddenCount = d.questions.length - FREE_REVIEW_LIMIT;
            reviewHtml += `
            <div style="background: var(--card-bg); border: 2px dashed var(--ion-color-primary); border-radius: 14px; padding: 20px; text-align: center; margin-top: 15px;">
                <ion-icon name="lock-closed" color="primary" style="font-size: 36px; margin-bottom: 8px;"></ion-icon>
                <h3 style="margin: 0 0 8px; font-weight: bold; color: var(--ion-text-color);">Free Limit Reached</h3>
                <p style="margin: 0 0 15px; color: var(--muted); font-size: 14px;">Activate the app to view the remaining <strong>${hiddenCount} questions</strong> and Nexus explanations.</p>
                <ion-button expand="block" color="primary" style="--border-radius: 10px; font-weight: bold;" onclick="triggerPaystack()">
                    <ion-icon name="key-outline" slot="start"></ion-icon> Activate App
                </ion-button>
            </div>`;
        }
    }
    
    summaryTable += `</tbody></table>`;
    
    setTimeout(() => {
        document.getElementById('finalScoreContainer').innerHTML = summaryTable;
        document.getElementById('reviewList').innerHTML = reviewHtml;
        
        if(window.MathJax) {
            MathJax.typesetClear();
            MathJax.typesetPromise().catch(err => console.error(err));
        }
        
        hideGlobalLoading();
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
        metadata: { 
            user_id: user.id, 
            email: user.email,
            plan_type: 'semester' 
        },
        callback: function(response) {
            showGlobalLoading("Verifying Payment Securely...");
            
            // Wait 3 seconds for the Webhook to update the DB
            setTimeout(() => {
                isFreeUser = false; // Disable the trap locally so they can continue
                hideGlobalLoading();
                showGenericModal("Success", "Payment successful! Your exam is unlocked. You may continue."); 
            }, 3000);
        },
        onClose: function() { console.log('Payment window closed.'); }
    }).openIframe();
};

// --- 8. NEXUS WIDGET ---
window.toggleNexusWidget = function(id, qIndex) {
    const widget = document.getElementById(`nexus-widget-${id}-${qIndex}`);
    widget.style.display = widget.style.display === 'block' ? 'none' : 'block';
};

window.sendToNexus = async function(id, qIndex, isAutoExplain) {
    const chatArea = document.getElementById(`nexus-chat-${id}-${qIndex}`);
    const inputField = document.getElementById(`nexus-input-${id}-${qIndex}`);
    
    let userMessage = inputField.value.trim();
    const qData = examData[id].questions[qIndex];
    const questionText = qData.q;
    const correctAnswer = qData.opts[qData.ans];
    const optionsList = qData.opts.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');

    let promptToAI = "";
    if (isAutoExplain) {
        promptToAI = `Act as an expert tutor. Please explain step-by-step why the correct answer to this question is "${correctAnswer}".\n\nQuestion: ${questionText}\n\nOptions:\n${optionsList}`;
        chatArea.innerHTML = `<div style="font-weight:bold; margin-bottom:8px;">Explain this question.</div>`;
    } else {
        if (!userMessage) return;
        promptToAI = `Regarding this question: "${questionText}"\n\nOptions:\n${optionsList}\n\n(Correct Answer: ${correctAnswer}).\n\nStudent asks: ${userMessage}`;
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
        if (window.MathJax) MathJax.typesetPromise([responseContainer]).catch(err => console.error(err));
    } catch (error) {
        responseContainer.innerHTML = `<span style="color: var(--ion-color-danger);">Connection error. Please try again.</span>`;
    }
};

// --- 9. CALCULATOR ---
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