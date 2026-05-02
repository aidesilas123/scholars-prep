// --- 1. Supabase Initialization ---
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bW9vbHl4eHlseWx0dHVnamVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODI5MTUsImV4cCI6MjA4NTM0MjkxNX0.2ZdfheXA3EtLLoCZenNVmoHq8XDe4geFdUVHAanwNYQ'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

let slidingWindowHistory = []; 

// --- 2. Interactive UI Helpers & Markdown Config ---
const renderer = new marked.Renderer();

// Custom code block renderer to include the Copy Top-Bar
// Custom code block renderer to include the Copy Top-Bar (Fixed for v12+)
renderer.code = function(token) {
    // Safely extract the text whether marked.js sends an Object (v12+) or a String (older)
    const codeText = typeof token === 'object' ? token.text : token;
    const langText = typeof token === 'object' ? token.lang : arguments[1];

    const language = hljs.getLanguage(langText) ? langText : 'plaintext';
    const highlighted = hljs.highlight(codeText, { language }).value;
    
    // Escape the code so the copy button doesn't break the HTML
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
};
marked.use({ renderer });

// Universal Copy Function
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

// --- 3. Startup & DOM Elements ---
async function initializeNexus() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const nameDisplay = document.getElementById('user-name-display');
        if (user) {
            const firstName = (user.user_metadata?.full_name || 'Student').split(' ')[0];
            nameDisplay.innerText = firstName;
        } else {
            nameDisplay.innerText = "Scholar"; 
        }
    } catch (err) { console.error("Auth error:", err); }
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
    
    // Message text container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (text) {
        contentDiv.innerHTML = role === 'model' ? marked.parse(text) : text;
    }
    bubble.appendChild(contentDiv);

    // Interactive Action Bar
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
    
    // Return all parts so handleSend can inject the streaming text
    return { bubble, contentDiv, actionBar };
}

// Live-Typing Stream Receiver
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

    thinkingIndicator.style.display = 'flex';
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight; 
    
    // Destructure the returned elements so we can stream into the contentDiv
    const { contentDiv, actionBar } = appendMessage('model', '');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: slidingWindowHistory })
        });

        thinkingIndicator.style.display = 'none'; 

        if (!response.ok) {
            if (response.status === 503) {
                contentDiv.textContent = "Nexus AI is currently over capacity. Please try again in a few seconds.";
                return;
            }
            throw new Error("Network response was not ok");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiFullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            aiFullText += chunkText;
            
            // MAGIC: Parse raw markdown into styled HTML in real-time
            contentDiv.innerHTML = marked.parse(aiFullText);
            
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        }

        slidingWindowHistory.push({ role: 'model', content: aiFullText });

        // Bind the copy button for the full response once generation is complete
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

// --- 5. Phase 2: Voice-to-Text Engine ---
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
    sidebar.classList.remove('active'); 
});

initializeNexus();