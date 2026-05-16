// --- DATABASE STATE VARIABLES ---
let currentUserEmail = null;
let currentSessionId = null;
// --------------------------------

// --- 1. Supabase Initialization ---
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bW9vbHl4eHlseWx0dHVnamVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODI5MTUsImV4cCI6MjA4NTM0MjkxNX0.2ZdfheXA3EtLLoCZenNVmoHq8XDe4geFdUVHAanwNYQ'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

let slidingWindowHistory = []; 

// --- 2. Interactive UI Helpers & Markdown Config ---
const renderer = new marked.Renderer();

renderer.code = function(token) {
    try {
        let codeText = String(typeof token === 'object' ? (token.text || '') : (arguments[0] || '')).trim();
        let langText = String(typeof token === 'object' ? (token.lang || '') : (arguments[1] || '')).trim();

        const language = hljs.getLanguage(langText) ? langText : 'plaintext';
        const highlighted = hljs.highlight(codeText, { language }).value;
        const escapedCode = encodeURIComponent(codeText);
        
        return `
            <div class="code-wrapper">
                <div class="code-header">
                    <span>${langText || 'code'}</span>
                    <button class="copy-code-btn" onclick="copyToClipboard(this, decodeURIComponent('${escapedCode}'))">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                    </button>
                </div>
                <pre><code class="hljs ${language}">${highlighted}</code></pre>
            </div>
        `;
    } catch (err) {
        console.warn("Highlighting falls back to safe text.");
        const safeText = String(typeof token === 'object' ? token.text : arguments[0]).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="code-wrapper"><pre style="padding:16px;"><code>${safeText}</code></pre></div>`;
    }
};
marked.use({ renderer });

window.copyToClipboard = async function(buttonElement, textToCopy) {
    try {
        await navigator.clipboard.writeText(textToCopy);
        const originalHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        buttonElement.style.color = "#4caf50";
        setTimeout(() => {
            buttonElement.innerHTML = originalHTML;
            buttonElement.style.color = "";
        }, 2000);
    } catch (err) { console.error('Failed to copy text: ', err); }
};

window.editUserMessage = function(btn) {
    const textNode = btn.closest('.message-bubble').querySelector('.message-content');
    chatInput.value = textNode.innerText;
    chatInput.focus();
    chatInput.dispatchEvent(new Event('input')); 
};

// --- 3. Startup & Dual-Auth Guard ---
function initializeNexus() {
    try {
        // 1. Check Main App Auth
        const mainObj = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
        const fallbackEmail = localStorage.getItem('userEmail');
        
        // 2. Check POST UTME Auth
        const putmeObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user') || 'null');

        // 3. Merge: If ANY exist, the user is authorized!
        currentUserEmail = (mainObj && mainObj.email) || fallbackEmail || (putmeObj && putmeObj.email);

        if (!currentUserEmail) {
            console.warn("No active session found. Redirecting to home...");
            // Safely redirects to the root URL, bypassing any Clean URL crash
            window.location.replace('/');
            return;
        }

        const firstName = currentUserEmail.split('@')[0]; 
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) nameDisplay.innerText = firstName;

        loadSidebarSessions();

    } catch (err) { 
        console.error("Auth error:", err); 
        window.location.replace('/');
    }
}

// --- SMART DASHBOARD RETURN ---
window.returnToDashboard = function() {
    const isPostUtme = localStorage.getItem('post_utme_logged_in_user');
    
    if (isPostUtme) {
        // We use the strict clean URL routing per the new Vercel rules
        window.location.href = '/post-utme-dashboard';
    } else {
        window.location.href = '/dashboard';
    }
};

async function loadSidebarSessions() {
    if (!currentUserEmail) return;
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = ''; 

    const { data: sessions, error } = await supabaseClient
        .from('nexus_sessions')
        .select('id, title')
        .eq('user_email', currentUserEmail) 
        .order('created_at', { ascending: false });

    if (error) return console.error("Error loading sessions:", error);

    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerText = session.title;
        div.onclick = () => loadPastSession(session.id, session.title);
        historyList.appendChild(div);
    });
}

async function loadPastSession(sessionId, sessionTitle) {
    currentSessionId = sessionId;
    slidingWindowHistory = []; 
    
    greetingContainer.style.display = 'none';
    chatMessagesArea.style.display = 'flex';
    messagesWrapper.innerHTML = ''; 
    
    if (window.innerWidth <= 768) sidebar.classList.remove('active');

    const { data: messages, error } = await supabaseClient
        .from('nexus_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) return console.error("Error loading messages:", error);

    messages.forEach(msg => {
        appendMessage(msg.role, msg.content);
        slidingWindowHistory.push({ role: msg.role, content: msg.content });
    });
    
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

    // --- BUG FIX 1: Trigger the Math Engine on historical messages ---
    if (window.renderMathInElement) {
        renderMathInElement(messagesWrapper, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ]
        });
    } else if (window.MathJax) {
        MathJax.typesetPromise([messagesWrapper]).catch(err => console.log(err));
    }
}

const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn'); 
const greetingContainer = document.getElementById('greeting-container');
const chatMessagesArea = document.getElementById('chat-messages');
const messagesWrapper = document.getElementById('messages-wrapper');
const thinkingIndicator = document.getElementById('ai-thinking-indicator');
const sidebar = document.querySelector('.sidebar');
const menuBtn = document.getElementById('menu-btn');

// --- 4. Chat Engine Logic ---
function appendMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (text) {
        if (role === 'model') {
            contentDiv.innerHTML = marked.parse(text);
        } else {
            contentDiv.textContent = text; 
        }
    }
    bubble.appendChild(contentDiv);

    const actionBar = document.createElement('div');
    actionBar.className = 'message-actions';

    if (role === 'user') {
        actionBar.innerHTML = `
            <button class="action-btn" title="Edit" onclick="editUserMessage(this)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
        `;
    } else {
        actionBar.innerHTML = `
            <button class="action-btn" title="Good response">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
            </button>
            <button class="action-btn" title="Bad response">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path></svg>
            </button>
            <button class="action-btn copy-main-btn" title="Copy">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
        `;
    }
    
    bubble.appendChild(actionBar);
    messagesWrapper.appendChild(bubble);
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    
    return { bubble, contentDiv, actionBar };
}

async function handleSend() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    greetingContainer.style.display = 'none';
    chatMessagesArea.style.display = 'flex';
    appendMessage('user', userText);
    
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.style.display = 'none';

    slidingWindowHistory.push({ role: 'user', content: userText });

    // Database Save
    if (currentUserEmail) {
        if (!currentSessionId) {
            const { data: session, error } = await supabaseClient
                .from('nexus_sessions')
                .insert({ user_email: currentUserEmail })
                .select().single();
            
            if (error) console.error("Session Create Error:", error);
            else currentSessionId = session.id;
            
            if (currentSessionId) generateAndSaveTitle(userText, currentSessionId);
        }
        
        if (currentSessionId) {
            await supabaseClient.from('nexus_messages').insert({ 
                session_id: currentSessionId, 
                user_email: currentUserEmail,
                role: 'user', 
                content: userText 
            });
        }
    }

    thinkingIndicator.style.display = 'flex';
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight; 
    
    const { contentDiv, actionBar } = appendMessage('model', '');

    try {
        let protectedPayload = slidingWindowHistory.slice(-16);

        // Prevent Gemini Context Crash
        if (protectedPayload.length > 0 && protectedPayload[0].role !== 'user') {
            protectedPayload.shift(); 
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: protectedPayload })
        });

        thinkingIndicator.style.display = 'none'; 

        if (!response.ok) throw new Error("Network response was not ok");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiFullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            aiFullText += chunkText;
            
            contentDiv.innerHTML = marked.parse(aiFullText);
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        }

        slidingWindowHistory.push({ role: 'model', content: aiFullText });
        
        if (currentUserEmail && currentSessionId) {
            await supabaseClient.from('nexus_messages').insert({ 
                session_id: currentSessionId, 
                user_email: currentUserEmail,
                role: 'model', 
                content: aiFullText 
            });
        }

        actionBar.querySelector('.copy-main-btn').onclick = function() {
            copyToClipboard(this, aiFullText);
        };

        if (window.renderMathInElement) {
            renderMathInElement(contentDiv, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ]
            });
        }

    } catch (error) {
        thinkingIndicator.style.display = 'none';
        contentDiv.textContent = "Connection error. Please ensure your network is stable and Vercel is running.";
        console.error("Fetch error:", error);
    }
}

async function generateAndSaveTitle(firstPrompt, sessionId) {
    try {
        const response = await fetch('/api/title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: firstPrompt })
        });
        const data = await response.json();
        
        await supabaseClient.from('nexus_sessions').update({ title: data.title }).eq('id', sessionId);
        loadSidebarSessions();
    } catch (err) {
        console.error("Titler failed:", err);
    }
}

// --- 5. Voice-to-Text Engine ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = false; 

    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.style.color = "#007bff"; 
        chatInput.placeholder = "Listening...";
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value += (chatInput.value ? " " : "") + transcript;
        chatInput.dispatchEvent(new Event('input')); 
    };

    recognition.onspeechend = () => {
        recognition.stop();
        micBtn.style.color = ""; 
        chatInput.placeholder = "Ask Nexus AI...";
    };

    recognition.onerror = (event) => {
        console.error("Microphone error:", event.error);
        micBtn.style.color = "";
        chatInput.placeholder = "Ask Nexus AI...";
    };
} else if (micBtn) {
    micBtn.style.display = 'none'; 
}

// --- 6. Event Listeners ---
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    sidebar.classList.toggle('active');
});

document.querySelector('.main-content').addEventListener('click', () => {
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
});

sendBtn.addEventListener('click', handleSend);

chatInput.addEventListener('input', function() {
    sendBtn.style.display = this.value.trim().length > 0 ? 'flex' : 'none';
    this.style.height = 'auto'; 
    this.style.height = (this.scrollHeight) + 'px';
    this.style.overflowY = this.scrollHeight >= 150 ? 'auto' : 'hidden';
});

chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        handleSend();
    }
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
});

document.getElementById('new-chat-btn').addEventListener('click', () => {
    chatMessagesArea.style.display = 'none';
    greetingContainer.style.display = 'flex';
    messagesWrapper.innerHTML = ''; 
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.style.display = 'none';
    
    slidingWindowHistory = []; 
    currentSessionId = null; 
    
    if (window.innerWidth <= 768) sidebar.classList.remove('active');
});

initializeNexus();