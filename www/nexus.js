// --- 1. Supabase Initialization ---
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE'; // Add your key back here
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
            nameDisplay.innerText = "Aide"; 
        }
    } catch (err) { console.error("Auth error:", err); }
}

// --- 3. DOM Elements ---
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
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
}

// Inside handleSend() in nexus.js ...

// 2. Show the Nexus "Thinking" Animation
thinkingIndicator.style.display = 'flex';
chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

try {
    // 3. ACTUAL API CALL to your Vercel Backend
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory: slidingWindowHistory })
    });

    const data = await response.json();

    thinkingIndicator.style.display = 'none'; // Hide animation

    if (data.text) {
        appendMessage('model', data.text);
        slidingWindowHistory.push({ role: 'model', parts: [{ text: data.text }] });
    } else {
        appendMessage('model', "I'm having trouble connecting to my brain. Check your Vercel logs!");
    }

} catch (error) {
    thinkingIndicator.style.display = 'none';
    appendMessage('model', "Connection error. Please ensure you are running this through a Vercel deployment.");
    console.error("Fetch error:", error);
}

// --- 5. Event Listeners ---

// Global Sidebar Toggle
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents click from instantly triggering the close event
    sidebar.classList.toggle('active');
});

// Close sidebar if user clicks the main content area (Desktop & Mobile)
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
        e.preventDefault(); // Stop default new line
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
    messagesWrapper.innerHTML = ''; // Clear bubbles
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.style.display = 'none';
    slidingWindowHistory = []; // Clear memory
    sidebar.classList.remove('active'); // Close sidebar
});

initializeNexus();