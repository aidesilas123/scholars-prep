// --- 1. Supabase Initialization ---
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
// WARNING: Put your Anon Key back in here before pushing!
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bW9vbHl4eHlseWx0dHVnamVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODI5MTUsImV4cCI6MjA4NTM0MjkxNX0.2ZdfheXA3EtLLoCZenNVmoHq8XDe4geFdUVHAanwNYQ'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

let slidingWindowHistory = []; 

// --- 2. Startup & Name Fetching ---
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

// --- 3. DOM Elements ---
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn'); // New for Phase 2
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
    bubble.innerText = text;
    messagesWrapper.appendChild(bubble);
    
    // Auto-scroll to the bottom
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    
    return bubble; // Return bubble so we can inject streaming text
}

// UPGRADED FOR PHASE 2: Live-Typing Stream Receiver
async function handleSend() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Hide Greeting, Show Chat Area
    greetingContainer.style.display = 'none';
    chatMessagesArea.style.display = 'flex';

    // 1. Show User Bubble
    appendMessage('user', userText);
    
    // Reset Input instantly
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.style.display = 'none';

    // Add to memory (matching Vercel Phase 1 structure)
    slidingWindowHistory.push({ role: 'user', content: userText });

    // 2. Show the Nexus "Thinking" Animation & Create empty AI bubble
    thinkingIndicator.style.display = 'flex';
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight; 
    const aiBubble = appendMessage('model', '');

    try {
        // 3. ACTUAL API CALL to your Vercel Backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: slidingWindowHistory })
        });

        // Hide thinking animation the moment we connect
        thinkingIndicator.style.display = 'none'; 

        if (!response.ok) {
            if (response.status === 503) {
                aiBubble.textContent = "Nexus AI is currently over capacity. Please try again in a few seconds.";
                return;
            }
            throw new Error("Network response was not ok");
        }

        // 4. Read the streaming data chunk by chunk
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiFullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the incoming chunk and append it
            const chunkText = decoder.decode(value, { stream: true });
            aiFullText += chunkText;
            
            // Update the UI in real-time
            aiBubble.textContent = aiFullText;
            
            // Keep the chat scrolled to the bottom as it types
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        }

        // Save AI response to memory
        slidingWindowHistory.push({ role: 'model', content: aiFullText });

        // Once streaming is completely finished, render the math equations (KaTeX)
        if (window.renderMathInElement) {
            renderMathInElement(aiBubble, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ]
            });
        }

    } catch (error) {
        thinkingIndicator.style.display = 'none';
        aiBubble.textContent = "Connection error. Please ensure your network is stable and Vercel is running.";
        console.error("Fetch error:", error);
    }
}

// --- 5. Phase 2: Voice-to-Text Engine ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop listening when they stop talking
    recognition.interimResults = false; 

    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.style.color = "#007bff"; // Visual feedback that mic is active
        chatInput.placeholder = "Listening...";
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value += (chatInput.value ? " " : "") + transcript;
        chatInput.dispatchEvent(new Event('input')); // Trigger auto-expand & send button
    };

    recognition.onspeechend = () => {
        recognition.stop();
        micBtn.style.color = ""; // Reset color
        chatInput.placeholder = "Ask Nexus AI...";
    };

    recognition.onerror = (event) => {
        console.error("Microphone error:", event.error);
        micBtn.style.color = "";
        chatInput.placeholder = "Ask Nexus AI...";
    };
} else if (micBtn) {
    // Hide mic button if browser doesn't support it
    micBtn.style.display = 'none'; 
}

// --- 6. Event Listeners ---

// Global Sidebar Toggle
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    sidebar.classList.toggle('active');
});

// Close sidebar if user clicks the main content area
document.querySelector('.main-content').addEventListener('click', () => {
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
});

// Send Button Click
sendBtn.addEventListener('click', handleSend);

// Textarea: Enter to send (Shift+Enter for new line), Auto-expand, and Show Send Button
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

// Theme Toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
});

// Reset UI on "New Chat" click
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