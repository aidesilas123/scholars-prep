// --- DATABASE STATE VARIABLES ---
let currentUserEmail = null;
let currentSessionId = null;
let slidingWindowHistory = []; 

// --- 1. Supabase Initialization ---
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bW9vbHl4eHlseWx0dHVnamVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODI5MTUsImV4cCI6MjA4NTM0MjkxNX0.2ZdfheXA3EtLLoCZenNVmoHq8XDe4geFdUVHAanwNYQ'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

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
                        Copy
                    </button>
                </div>
                <pre><code class="hljs ${language}">${highlighted}</code></pre>
            </div>
        `;
    } catch (err) {
        const safeText = String(typeof token === 'object' ? token.text : arguments[0]).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="code-wrapper"><pre style="padding:16px;"><code>${safeText}</code></pre></div>`;
    }
};
marked.use({ renderer });

window.copyToClipboard = async function(buttonElement, textToCopy) {
    try {
        await navigator.clipboard.writeText(textToCopy);
        const originalHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = `Copied!`;
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

// --- IONIC SCROLL HELPER ---
function scrollToBottom() {
    const content = document.querySelector('#chat-scroller');
    if (content && content.scrollToBottom) {
        content.scrollToBottom(300); // Smooth scroll over 300ms
    }
}

// --- 3. Startup, Skeleton Control & Dual-Auth Guard ---
function initializeNexus() {
    try {
        const mainObj = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
        const fallbackEmail = localStorage.getItem('userEmail');
        const putmeObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user') || 'null');

        currentUserEmail = (mainObj && mainObj.email) || fallbackEmail || (putmeObj && putmeObj.email);

        if (!currentUserEmail) {
            window.location.replace('/');
            return;
        }

        const firstName = currentUserEmail.split('@')[0]; 
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) nameDisplay.innerText = firstName;

        // Hide Skeleton, Show UI
        setTimeout(() => {
            document.getElementById('page-skeleton').style.display = 'none';
            document.getElementById('greeting-container').style.display = 'flex';
        }, 600); // Slight delay for animation effect

        loadSidebarSessions();

    } catch (err) { 
        window.location.replace('/');
    }
}

async function loadSidebarSessions() {
    if (!currentUserEmail) return;
    const historyList = document.getElementById('history-list');
    
    const { data: sessions, error } = await supabaseClient
        .from('nexus_sessions')
        .select('id, title')
        .eq('user_email', currentUserEmail) 
        .order('created_at', { ascending: false });

    if (error) return console.error("Error loading sessions:", error);

    historyList.innerHTML = ''; // Clears the sidebar skeletons
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
    
    document.getElementById('greeting-container').style.display = 'none';
    document.getElementById('page-skeleton').style.display = 'flex'; // Show loading state
    document.getElementById('chat-messages').style.display = 'none';
    messagesWrapper.innerHTML = ''; 
    
    // Close the Ionic Menu natively
    const menu = document.querySelector('ion-menu');
    if (menu) menu.close();

    const { data: messages, error } = await supabaseClient
        .from('nexus_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) return console.error("Error loading messages:", error);

    document.getElementById('page-skeleton').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'flex';

    messages.forEach(msg => {
        appendMessage(msg.role, msg.content);
        slidingWindowHistory.push({ role: msg.role, content: msg.content });
    });
    
    scrollToBottom();

    if (window.renderMathInElement) {
        renderMathInElement(messagesWrapper, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });
    }
}

const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn'); 
const messagesWrapper = document.getElementById('messages-wrapper');
const thinkingIndicator = document.getElementById('ai-thinking-indicator');

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
                <ion-icon name="create-outline"></ion-icon>
            </button>
        `;
    } else {
        actionBar.innerHTML = `
            <button class="action-btn copy-main-btn" title="Copy">
                <ion-icon name="copy-outline"></ion-icon>
            </button>
        `;
    }
    
    bubble.appendChild(actionBar);
    messagesWrapper.appendChild(bubble);
    scrollToBottom();
    
    return { bubble, contentDiv, actionBar };
}

async function handleSend() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    document.getElementById('greeting-container').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'flex';
    appendMessage('user', userText);
    
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.style.display = 'none';

    slidingWindowHistory.push({ role: 'user', content: userText });

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
                session_id: currentSessionId, user_email: currentUserEmail, role: 'user', content: userText 
            });
        }
    }

    thinkingIndicator.style.display = 'flex';
    scrollToBottom(); 
    
    const { contentDiv, actionBar } = appendMessage('model', '');

    try {
        let protectedPayload = slidingWindowHistory.slice(-16);
        if (protectedPayload.length > 0 && protectedPayload[0].role !== 'user') protectedPayload.shift(); 

        const response = await fetch('https://scholars-prep.vercel.app/api/chat', {
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

            aiFullText += decoder.decode(value, { stream: true });
            contentDiv.innerHTML = marked.parse(aiFullText);
            scrollToBottom();
        }

        slidingWindowHistory.push({ role: 'model', content: aiFullText });
        
        if (currentUserEmail && currentSessionId) {
            await supabaseClient.from('nexus_messages').insert({ 
                session_id: currentSessionId, user_email: currentUserEmail, role: 'model', content: aiFullText 
            });
        }

        actionBar.querySelector('.copy-main-btn').onclick = function() { copyToClipboard(this, aiFullText); };

        if (window.renderMathInElement) {
            renderMathInElement(contentDiv, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });
        }

    } catch (error) {
        thinkingIndicator.style.display = 'none';
        contentDiv.textContent = "Connection error. Please try again.";
    }
}

async function generateAndSaveTitle(firstPrompt, sessionId) {
    try {
        const response = await fetch('/api/title', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: firstPrompt })
        });
        const data = await response.json();
        await supabaseClient.from('nexus_sessions').update({ title: data.title }).eq('id', sessionId);
        loadSidebarSessions();
    } catch (err) {}
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; 

    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.style.color = "#007bff"; 
        chatInput.placeholder = "Listening...";
    });

    recognition.onresult = (event) => {
        chatInput.value += (chatInput.value ? " " : "") + event.results[0][0].transcript;
        chatInput.dispatchEvent(new Event('input')); 
    };

    recognition.onspeechend = () => {
        recognition.stop();
        micBtn.style.color = ""; chatInput.placeholder = "Ask Nexus AI...";
    };

    recognition.onerror = () => {
        micBtn.style.color = ""; chatInput.placeholder = "Ask Nexus AI...";
    };
} else if (micBtn) { micBtn.style.display = 'none'; }

sendBtn.addEventListener('click', handleSend);

chatInput.addEventListener('input', function() {
    sendBtn.style.display = this.value.trim().length > 0 ? 'flex' : 'none';
    this.style.height = 'auto'; 
    this.style.height = (this.scrollHeight) + 'px';
});

chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); handleSend();
    }
});

document.getElementById('theme-toggle').addEventListener('click', () => document.body.classList.toggle('light-mode'));

document.getElementById('new-chat-btn').addEventListener('click', () => {
    document.getElementById('chat-messages').style.display = 'none';
    document.getElementById('greeting-container').style.display = 'flex';
    document.getElementById('messages-wrapper').innerHTML = ''; 
    chatInput.value = ''; chatInput.style.height = 'auto'; sendBtn.style.display = 'none';
    slidingWindowHistory = []; currentSessionId = null; 
    
    const menu = document.querySelector('ion-menu');
    if (menu) menu.close();
});

initializeNexus();