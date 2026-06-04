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
let activeSubjectCode = null;
let currentPQData = []; 
let isFastPass = false;

// Read URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const fpCourse = urlParams.get('course');
const fpYear = urlParams.get('year');
const fpType = urlParams.get('type') || 'exam';
const fpAutoStart = urlParams.get('autoStart');

// Theme Synchronization
if (localStorage.getItem('sp_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-color-meta').setAttribute('content', '#121212');
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if coming from Course Details Fast Pass
    if (fpAutoStart === 'true' && fpCourse && fpYear) {
        isFastPass = true;
        activeSubjectCode = fpCourse;
        switchView('view-questions', false);
        fetchQuestionsEngine(fpCourse, fpYear, fpType);
    } else {
        // Normal Dashboard Navigation
        switchView('view-selection', true);
        loadSubjects();
    }
});

// --- 3. NAVIGATION TRAPS ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.goBackToDashboard = function() {
    window.location.replace('dashboard.html');
};

window.handleQuestionBackNav = function() {
    if (isFastPass) {
        // Return exactly to the Course Details hub they came from
        window.location.replace(`course-details.html?course=${activeSubjectCode}`);
    } else {
        // Return to the selection list
        switchView('view-selection', false);
    }
};

window.addEventListener('popstate', (e) => {
    if (document.getElementById('view-questions').classList.contains('active')) {
        handleQuestionBackNav();
    } else {
        goBackToDashboard();
    }
});

// --- 4. LOAD SUBJECTS (If accessed directly from Dashboard) ---
async function loadSubjects() {
    try {
        const { data: courses, error } = await _sb.from('ss_courses').select('*').order('code', { ascending: true });
        if (error) throw error;

        const container = document.getElementById('subjectListContainer');
        container.innerHTML = '';
        subjectsData = courses;

        courses.forEach(sub => {
            const iconName = sub.icon || 'book-outline';
            // We use 'exam' as default if they use the direct selector
            container.innerHTML += `
            <div class="subject-card" id="card-${sub.code}" onclick="toggleSubject('${sub.code}')">
                <ion-item lines="none" style="--background: transparent; cursor: pointer;">
                    <ion-icon name="${iconName}" slot="start" color="primary"></ion-icon>
                    <ion-label style="font-weight: bold; color: var(--ion-text-color);">${sub.code}</ion-label>
                    <ion-checkbox slot="end" id="chk-${sub.code}" style="pointer-events: none;"></ion-checkbox>
                </ion-item>
                <div class="config-area" onclick="event.stopPropagation()">
                    <ion-item lines="none" style="--background: transparent; border: 1.5px solid var(--ion-color-primary); border-radius: 8px;">
                        <ion-label position="stacked" style="color: var(--ion-color-primary);">Select Type</ion-label>
                        <ion-select id="type-${sub.code}" interface="popover" value="exam">
                            <ion-select-option value="exam">Exam</ion-select-option>
                            <ion-select-option value="test">Test</ion-select-option>
                        </ion-select>
                    </ion-item>
                    <div style="margin-top: 10px;">
                        <ion-input type="number" id="yr-${sub.code}" placeholder="e.g. 2023" style="border: 1.5px solid var(--ion-color-primary); border-radius: 8px; padding-left: 10px;"></ion-input>
                    </div>
                </div>
            </div>`;
        });

        document.getElementById('skeleton-ui').style.display = 'none';
        container.style.display = 'block';

    } catch (err) {
        console.error(err);
    }
}

window.filterSubjects = function(event) {
    const query = event.target.value.toLowerCase();
    const cards = document.querySelectorAll('.subject-card');
    cards.forEach(card => {
        const subjectName = card.querySelector('ion-label').innerText.toLowerCase();
        card.style.display = subjectName.includes(query) ? 'block' : 'none';
    });
};

window.toggleSubject = function(code) {
    document.querySelectorAll('.subject-card').forEach(card => {
        if(card.id !== `card-${code}`) {
            card.classList.remove('selected');
            card.querySelector('ion-checkbox').checked = false;
        }
    });

    const card = document.getElementById(`card-${code}`);
    const chk = document.getElementById(`chk-${code}`);
    
    card.classList.toggle('selected');
    chk.checked = card.classList.contains('selected');
    
    activeSubjectCode = card.classList.contains('selected') ? code : null;
    document.getElementById('continueBtn').disabled = !activeSubjectCode;
};

// Triggered by the "Start Studying" button
window.loadPastQuestions = function() {
    const yearOpt = document.getElementById(`yr-${activeSubjectCode}`).value;
    const typeOpt = document.getElementById(`type-${activeSubjectCode}`).value;
    
    if(!yearOpt) return alert("Please enter a year.");
    
    switchView('view-questions', true);
    fetchQuestionsEngine(activeSubjectCode, yearOpt, typeOpt);
};

window.showGenericModal = function(title, message, isError = false) {
    document.getElementById('genericModalTitle').innerText = title;
    document.getElementById('genericModalMessage').innerText = message;
    
    const icon = document.getElementById('genericModalIcon');
    icon.setAttribute('name', isError ? 'warning-outline' : 'checkmark-circle-outline');
    icon.setAttribute('color', isError ? 'danger' : 'primary');
    
    document.getElementById('genericModal').style.display = 'flex';
};

// --- Questions & Paywall ---
async function fetchQuestionsEngine(courseCode, year, tableType) {
    showLoading(true, "Loading...");
    document.getElementById('pqTitle').innerText = `${courseCode} (${year})`;

    try {
        // Retrieve the full user object to use the ID
        const authUser = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
        const targetTable = tableType === 'test' ? 'ss_test_questions' : 'ss_exam_questions';

        // Check Questions, App Settings, and Profile (matching by ID)
        const [qRes, settingsRes, subRes] = await Promise.all([
            _sb.from(targetTable).select('*').eq('course_code', courseCode).eq('year', year),
            _sb.from('app_settings').select('payment_active').single(),
            _sb.from('profiles').select('subscription_end').eq('id', authUser.id).maybeSingle()
        ]);

        if (qRes.error) throw qRes.error;
        const rawData = qRes.data;

        // REAL-TIME SECURITY CHECK
        let isSwitchActive = true; 
        let isPremium = false;

        // 1. Check if the master paywall switch is turned on
        if (settingsRes.data && settingsRes.data.payment_active !== undefined) {
            isSwitchActive = settingsRes.data.payment_active;
        }

        // 2. Check the profiles table to see if the subscription is still active
        if (subRes.data && subRes.data.subscription_end) {
            const endDate = new Date(subRes.data.subscription_end);
            if (endDate > new Date()) isPremium = true;
        }

        // A user is ONLY restricted if the switch is ON and their premium time is over/missing
        const isFreeUser = (isSwitchActive === true && isPremium === false);
        
        const contentArea = document.getElementById('pqContent');
        contentArea.innerHTML = '';
        currentPQData = []; 

      

        if (rawData && rawData.length > 0) {
            let htmlBlock = '';
            let questionsToRender = rawData;
            let showPaywallBlock = false;
            const FREE_LIMIT = 10; 

            if (isFreeUser && rawData.length > FREE_LIMIT) {
                questionsToRender = rawData.slice(0, FREE_LIMIT);
                showPaywallBlock = true;
            }

            questionsToRender.forEach((q, idx) => {
                let parsedOpts = [];
                try {
                    parsedOpts = Array.isArray(q.options) ? q.options : JSON.parse(q.options);
                } catch (e) {
                    console.error("OPTIONS PARSE FAILED:", q.options); return;
                }

                const fixedQText = q.question_text || q.question; 
                const correctAnsIdx = parseInt(q.answer);
                
                currentPQData.push({
                    qText: fixedQText,
                    correctText: parsedOpts[correctAnsIdx],
                    allOpts: parsedOpts
                });

                const optsHtml = parsedOpts.map((opt, i) => {
                    const isCorrect = (i === correctAnsIdx);
                    return `<div class="pq-opt ${isCorrect ? 'correct' : ''}">${opt}</div>`;
                }).join('');

                htmlBlock += `
                <div class="pq-card">
                    <h3 style="margin-top: 0; font-weight: bold; line-height: 1.5;">Q${idx + 1}. ${fixedQText}</h3>
                    <div>${optsHtml}</div>
                    
                    <ion-button class="green-outline-btn" size="small" style="margin-top: 15px;" onclick="toggleNexusWidget(${idx})">
                        Ask Nexus <img src="Logo.png" alt="Nexus" style="height: 16px; margin-left: 6px; vertical-align: middle;">
                    </ion-button>

                    <div id="nexus-widget-${idx}" class="nexus-inline-widget">
                        <div class="nexus-header">
                            <span style="font-weight: bold; font-size: 13px;">Nexus AI Tutor</span>
                            <span onclick="toggleNexusWidget(${idx})" style="cursor: pointer; font-size: 16px;">✖</span>
                        </div>
                        <div id="nexus-chat-${idx}" class="nexus-chat-area">
                            <div style="color: var(--muted); text-align: center; font-style: italic;">Ask a specific question below.</div>
                        </div>
                        <div class="nexus-input-area">
                            <input type="text" id="nexus-input-${idx}" placeholder="Ask about this..." autocomplete="off">
                            <button onclick="sendToNexus(${idx})">Send</button>
                        </div>
                    </div>
                </div>`;
            });

            // INJECT INLINE PAYWALL
            if (showPaywallBlock) {
                const hiddenCount = rawData.length - FREE_LIMIT;
                htmlBlock += `
                <div style="background: var(--card-bg); border: 2px dashed var(--ion-color-primary); border-radius: 14px; padding: 30px 20px; text-align: center; margin-top: 20px; margin-bottom: 40px;">
                    <ion-icon name="lock-closed" color="primary" style="font-size: 48px; margin-bottom: 10px;"></ion-icon>
                    <h3 style="margin: 0 0 10px; font-weight: bold; color: var(--ion-text-color);">You've reached the free limit</h3>
                    <p style="margin: 0 0 20px; color: var(--muted); font-size: 14px;">Unlock the app to view the remaining <strong>${hiddenCount} questions</strong>.</p>
                    <ion-button class="green-outline-btn" expand="block" style="height: 45px;" onclick="document.getElementById('premiumModal').style.display='flex'">
                        <ion-icon name="key-outline" slot="start"></ion-icon> Activate App Now
                    </ion-button>
                </div>`;
            }

            contentArea.innerHTML = htmlBlock;
            
            if(window.MathJax) {
                MathJax.typesetClear();
                MathJax.typesetPromise().catch(err => console.error(err));
            }
        } else {
            alert("No questions found for this subject and year.");
            handleQuestionBackNav(); // Kick back if empty
        }
    } catch (err) {
        console.error("Failed to load questions", err);
        alert("Failed to load questions. Check your connection.");
        handleQuestionBackNav();
    } finally {
        showLoading(false);
    }
}

// --- 6. NEXUS AI INLINE LOGIC ---
window.toggleNexusWidget = function(qIndex) {
    const widget = document.getElementById(`nexus-widget-${qIndex}`);
    widget.style.display = widget.style.display === 'block' ? 'none' : 'block';
};

window.sendToNexus = async function(qIndex) {
    const chatArea = document.getElementById(`nexus-chat-${qIndex}`);
    const inputField = document.getElementById(`nexus-input-${qIndex}`);
    
    let userMessage = inputField.value.trim();
    if (!userMessage) return;

    const qData = currentPQData[qIndex];
    const optionsList = qData.allOpts.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');
    
    const promptToAI = `Regarding this question: "${qData.qText}"\n\nOptions:\n${optionsList}\n\n(Correct Answer: ${qData.correctText}). \n\nStudent asks: ${userMessage}`;
    
    chatArea.innerHTML += `<div style="font-weight:bold; margin-bottom:8px; margin-top: 15px;">You: ${userMessage}</div>`;
    inputField.value = ''; 

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

        if (window.MathJax) MathJax.typesetPromise([responseContainer]).catch(e => console.error(e));
    } catch (error) {
        responseContainer.innerHTML = `<span style="color: red;">Connection error. Please try again.</span>`;
    }
};

// --- 7. PAYSTACK INTEGRATION ---
window.triggerPutmePaystack = function() {
    document.getElementById('premiumModal').style.display = 'none';
    const user = JSON.parse(localStorage.getItem('abupq_logged_in_user'));
    
    PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: user.email,
        amount: 2500 * 100, 
        currency: 'NGN', 
        ref: 'SP_' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: { user_id: user.id, email: user.email },
        callback: function(response) {
            showLoading(true, 'Activating...');
            _sb.from('profiles').upsert({ id: user.id, subscription_end: '2026-12-31' }).then(() => {
                showLoading(false);
                alert("Payment successful! Your app is fully activated."); 
                // Refresh the questions dynamically to clear the limit
                fetchQuestionsEngine(activeSubjectCode, fpYear || document.getElementById(`yr-${activeSubjectCode}`).value, fpType || document.getElementById(`type-${activeSubjectCode}`).value);
            });
        },
        onClose: function() { }
    }).openIframe();
};

function showLoading(show, text="Processing...") {
    const loader = document.getElementById('globalLoading');
    document.getElementById('loadText').textContent = text;
    loader.style.display = show ? 'flex' : 'none';
}