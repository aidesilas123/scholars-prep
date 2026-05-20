// --- AUTH GUARD & INIT ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) window.location.replace('/'); 
})();

const _sb = window.supabase.createClient('https://xtmoolyxxylylttugjek.supabase.co', 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG');

document.addEventListener('DOMContentLoaded', () => {
    // Bulletproof Theme Inheritance
    const isDark = localStorage.getItem('post_utme_theme') === 'dark' || localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    if (isDark) {
        document.body.classList.add('dark');
        document.body.classList.add('dark-mode');
    }
    
    // Linear Navigation Stack
    history.replaceState({ view: 'view-selection' }, '', '');
    loadSubjects();
});

// --- STATE ---
let subjectsData = [];
let activeSubjectId = null;
let currentPQData = []; // Holds the fetched questions

function showLoading(show, text="Loading...") {
    document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
    document.getElementById('loadText').textContent = text;
}

// --- LINEAR NAVIGATION ENGINE ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.cbt-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
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

// --- 1. LOAD SUBJECTS (Single Selection) ---
async function loadSubjects() {
    try {
        const { data: subjects } = await _sb.from('putme_subjects').select('*');
        const { data: qYears } = await _sb.from('putme_questions').select('subject_id, year');
        
        const container = document.getElementById('subjectListContainer');
        container.innerHTML = '';
        
        if(subjects) {
            subjects.forEach(sub => {
                subjectsData.push(sub);
                
                // NO 'Random' Option for Question Bank
                let yearsHTML = '';
                if (qYears) {
                    const subYears = [...new Set(qYears.filter(q => q.subject_id === sub.id).map(q => q.year))].sort((a,b)=>b-a);
                    yearsHTML = subYears.map(y => `<ion-select-option value="${y}">${y}</ion-select-option>`).join('');
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
                            <ion-select id="yr-${sub.id}" value="${qYears ? (qYears.filter(q => q.subject_id === sub.id)[0]?.year || '') : ''}">
                                ${yearsHTML}
                            </ion-select>
                        </ion-item>
                    </div>
                </ion-card>`;
            });
        }
    } catch (err) {
        console.error(err);
    }
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

// Only allows ONE subject to be selected at a time for studying
window.toggleSubject = function(id) {
    document.querySelectorAll('.subject-card').forEach(card => {
        if(card.id !== `card-${id}`) {
            card.classList.remove('selected');
            card.querySelector('ion-checkbox').checked = false;
        }
    });

    const card = document.getElementById(`card-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    
    card.classList.toggle('selected');
    chk.checked = card.classList.contains('selected');
    
    activeSubjectId = card.classList.contains('selected') ? id : null;
    document.getElementById('continueBtn').disabled = !activeSubjectId;
};

// --- 2. LOAD & RENDER PAST QUESTIONS ---
// --- 2. LOAD & RENDER PAST QUESTIONS (With Freemium Trap) ---
// --- 2. LOAD & RENDER PAST QUESTIONS (With Real-Time Security) ---
window.loadPastQuestions = async function() {
    showLoading(true, "Fetching Past Questions...");
    
    const yearOpt = document.getElementById(`yr-${activeSubjectId}`).value;
    const subName = subjectsData.find(s => s.id == activeSubjectId).name;
    
    document.getElementById('pqTitle').innerText = `${subName} ${yearOpt}`;

    try {
        const authEmail = JSON.parse(localStorage.getItem('post_utme_logged_in_user')).email;

        // Fetch Questions, Master Switch, and Subscription simultaneously!
        const [qRes, settingsRes, subRes] = await Promise.all([
            _sb.from('putme_questions').select('*').eq('subject_id', activeSubjectId).eq('year', yearOpt),
            _sb.from('putme_settings').select('is_payment_active').maybeSingle(),
            _sb.from('putme_subscriptions').select('end_date').eq('user_email', authEmail).maybeSingle()
        ]);

        if (qRes.error) throw qRes.error;
        const rawData = qRes.data;

        // --- REAL-TIME SECURITY CHECK ---
        let isSwitchActive = true; 
        let isPremium = false;

        if (settingsRes.data && settingsRes.data.is_payment_active !== undefined) {
            isSwitchActive = settingsRes.data.is_payment_active;
        }
        if (subRes.data && subRes.data.end_date) {
            const endDate = new Date(subRes.data.end_date);
            if (endDate > new Date()) isPremium = true;
        }

        // A user is ONLY restricted if the Master Switch is ON, AND they haven't paid.
        const isFreeUser = (isSwitchActive === true && isPremium === false);

        const contentArea = document.getElementById('pqContent');
        contentArea.innerHTML = '';
        currentPQData = []; // Reset

        if (rawData && rawData.length > 0) {
            let htmlBlock = '';
            
            let questionsToRender = rawData;
            let showPaywallBlock = false;
            
            const FREE_LIMIT = 10; // The max questions free users can see

            // Only slice if they are a free user AND there are more than 30 questions
            if (isFreeUser && rawData.length > FREE_LIMIT) {
                questionsToRender = rawData.slice(0, FREE_LIMIT);
                showPaywallBlock = true;
            }

            questionsToRender.forEach((q, idx) => {
                const parsedOpts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                const fixedQText = fixMathText(q.question_text);
                const correctAnsIdx = parseInt(q.answer);
                
                currentPQData.push({
                    qText: fixedQText,
                    correctText: fixMathText(parsedOpts[correctAnsIdx]),
                    allOpts: parsedOpts.map(o => fixMathText(o))
                });

                const optsHtml = parsedOpts.map((opt, i) => {
                    const isCorrect = (i === correctAnsIdx);
                    return `<div class="pq-opt ${isCorrect ? 'correct' : ''}">${fixMathText(opt)}</div>`;
                }).join('');

                htmlBlock += `
                <div class="pq-card">
                    <h3 style="margin-top: 0; font-weight: bold; line-height: 1.5;">Q${idx + 1}. ${fixedQText}</h3>
                    <div>${optsHtml}</div>
                    
                    <ion-button size="small" fill="outline" color="primary" style="margin-top: 15px;" onclick="toggleNexusWidget(${idx})">
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
                            <button onclick="sendToNexus(${idx}, false)">Send</button>
                            
                        </div>
                    </div>
                </div>`;
            });

            // --- INJECT THE INLINE PAYWALL BLOCK ---
            if (showPaywallBlock) {
                const hiddenCount = rawData.length - FREE_LIMIT;
                htmlBlock += `
                <div style="background: var(--panel); border: 2px dashed var(--ion-color-primary); border-radius: 14px; padding: 30px 20px; text-align: center; margin-top: 20px; margin-bottom: 40px;">
                    <ion-icon name="lock-closed" color="primary" style="font-size: 48px; margin-bottom: 10px;"></ion-icon>
                    <h3 style="margin: 0 0 10px; font-weight: bold; color: var(--ion-text-color);">You've reached the free limit</h3>
                    <p style="margin: 0 0 20px; color: var(--muted); font-size: 14px;">Unlock the app to view the remaining <strong>${hiddenCount} questions</strong> for this year, plus access all other years and subjects.</p>
                    <ion-button expand="block" color="primary" style="--border-radius: 10px; font-weight: bold; height: 45px;" onclick="showAccessModal('locked_feature')">
                        <ion-icon name="key-outline" slot="start"></ion-icon> Activate App Now
                    </ion-button>
                </div>`;
            }

            contentArea.innerHTML = htmlBlock;
            
            if(window.MathJax) {
                MathJax.typesetClear();
                MathJax.typesetPromise().catch(err => console.error(err));
            }

            switchView('view-questions');
        } else {
            alert("No questions found for this subject and year.");
        }
    } catch (err) {
        console.error("Failed to load questions", err);
        alert("Failed to load questions. Check your connection.");
    } finally {
        showLoading(false);
    }
};
// --- 3. NEXUS INLINE AI LOGIC ---
window.toggleNexusWidget = function(qIndex) {
    const widget = document.getElementById(`nexus-widget-${qIndex}`);
    widget.style.display = widget.style.display === 'block' ? 'none' : 'block';
};

window.sendToNexus = async function(qIndex, isAutoExplain) {
    const chatArea = document.getElementById(`nexus-chat-${qIndex}`);
    const inputField = document.getElementById(`nexus-input-${qIndex}`);
    
    let userMessage = inputField.value.trim();
    const qData = currentPQData[qIndex];
    const questionText = qData.qText;
    const correctAnswer = qData.correctText;
    
    // Format options into A), B), C), D)
    const optionsList = qData.allOpts.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');

    let promptToAI = "";

    if (isAutoExplain) {
        promptToAI = `Act as an expert tutor. Please explain step-by-step why the correct answer to this question is "${correctAnswer}". \n\nQuestion: ${questionText}\n\nOptions:\n${optionsList}`;
        chatArea.innerHTML = `<div style="font-weight:bold; margin-bottom:8px;">Explain this question.</div>`;
    } else {
        if (!userMessage) return;
        promptToAI = `Regarding this question: "${questionText}"\n\nOptions:\n${optionsList}\n\n(Correct Answer: ${correctAnswer}). \n\nStudent asks: ${userMessage}`;
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
    }
};
// --- 4. MODAL & PAYSTACK LOGIC ---
const PAYSTACK_KEY = 'pk_live_c7136c9839d252047b28fc27b04dac19ffb3f377'; 

window.showAccessModal = function(intent = 'locked_feature') {
    const modal = document.getElementById('premiumModal');
    const payBtn = document.getElementById('paystackBtnText');
    const modalTitle = document.getElementById('premiumModalTitle');
    const modalDesc = document.getElementById('premiumModalDesc');

    if (intent === 'direct_pay') {
        if (modalTitle) modalTitle.innerText = "Activate Scholars Prep";
        if (modalDesc) modalDesc.innerHTML = "Before proceeding with payment, make sure you read and understand our <a href='#' style='color: var(--ion-color-primary); text-decoration: underline;'>policy, terms and conditions</a>.";
    } else {
        if (modalTitle) modalTitle.innerText = "Activate Full Access";
        if (modalDesc) modalDesc.innerText = "Unlock full access to view all questions and the Nexus AI Tutor.";
    }

    const cached = JSON.parse(localStorage.getItem('putme_premium_data') || '{}');
    const hasDiscount = (cached && cached.discountEarned === true);
    
    if (payBtn) {
        payBtn.innerHTML = hasDiscount ? 
            `<ion-icon name="card-outline" slot="start"></ion-icon> Activate Now - ₦5,000` : 
            `<ion-icon name="card-outline" slot="start"></ion-icon> Activate Now - ₦5,500`;
    }
    
    if (modal) modal.style.display = 'flex';
}

window.triggerPutmePaystack = function() {
    const userString = localStorage.getItem('post_utme_logged_in_user');
    if (!userString) return;
    
    const userObj = JSON.parse(userString);
    const userEmail = userObj.email;
    const userId = userObj.id || ''; 
    
    const cached = JSON.parse(localStorage.getItem('putme_premium_data') || '{}');
    const finalPrice = (cached && cached.discountEarned === true) ? 5000 : 5500;

    function onPaymentSuccess(response) {
        console.log("Payment Ref:", response.reference);
        const modal = document.getElementById('premiumModal');
        if (modal) modal.style.display = 'none';
        
        // Optimistically unlock the UI
        cached.isPremium = true;
        localStorage.setItem('putme_premium_data', JSON.stringify(cached));
        
        alert("Payment successful! Your app is fully activated."); 
        
        // Seamlessly reload the questions so the 30-limit vanishes instantly!
        loadPastQuestions();
    }

    PaystackPop.setup({
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
    }).openIframe();
}