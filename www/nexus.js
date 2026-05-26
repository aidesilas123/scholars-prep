// --- DATABASE & DOM STATE VARIABLES ---
let currentUserEmail = null;
let currentSessionId = null;
let slidingWindowHistory = []; 

let uploadedFiles = []; // Upgraded to array for multi-file support
const fileInput = document.getElementById('file-upload-input');
const attachBtn = document.getElementById('attach-btn');
const filePreviewBadge = document.getElementById('file-preview-badge');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn'); 
const messagesWrapper = document.getElementById('messages-wrapper');
const thinkingIndicator = document.getElementById('ai-thinking-indicator');

// --- 1. Supabase Initialization ---
const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bW9vbHl4eHlseWx0dHVnamVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODI5MTUsImV4cCI6MjA4NTM0MjkxNX0.2ZdfheXA3EtLLoCZenNVmoHq8XDe4geFdUVHAanwNYQ'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// --- AI THINKING PHASES LOGIC ---
const thinkingPhases = [
    "Analyzing prompt...",
    "Scanning academic database...",
    "Structuring response...",
    "Refining final details..."
];

let thinkingInterval;

function startThinkingAnimation() {
    const textElement = document.getElementById('thinking-text');
    if (!textElement) return;
    
    let phaseIndex = 0;
    textElement.textContent = thinkingPhases[0];

    thinkingInterval = setInterval(() => {
        phaseIndex++;
        if (phaseIndex >= thinkingPhases.length) {
            phaseIndex = thinkingPhases.length - 1; 
        }
        textElement.textContent = thinkingPhases[phaseIndex];
    }, 2000); 
}

function stopThinkingAnimation() {
    clearInterval(thinkingInterval);
}

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

function scrollToBottom() {
    const content = document.querySelector('#chat-scroller');
    if (content && content.scrollToBottom) {
        content.scrollToBottom(300); 
    }
}

// --- 3. Startup & Dual-Auth Guard ---
function initializeNexus() {
    try {
        const mainObj = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
        const fallbackEmail = localStorage.getItem('userEmail');
        const putmeObj = JSON.parse(localStorage.getItem('post_utme_logged_in_user') || 'null');

        currentUserEmail = (mainObj && mainObj.email) || fallbackEmail || (putmeObj && putmeObj.email);

        if (!currentUserEmail) {
            window.location.replace('index.html');
            return;
        }

        const firstName = currentUserEmail.split('@')[0]; 
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) nameDisplay.innerText = firstName;

        setTimeout(() => {
            document.getElementById('page-skeleton').style.display = 'none';
            document.getElementById('greeting-container').style.display = 'flex';
        }, 600);

        loadSidebarSessions();

    } catch (err) { 
        window.location.replace('index.html');
    }
}

async function loadSidebarSessions() {
    if (!currentUserEmail) return;
    const historyList = document.getElementById('history-list');
    
    // Sort by pinned first, then by date created
    const { data: sessions, error } = await supabaseClient
        .from('nexus_sessions')
        .select('id, title, is_pinned')
        .eq('user_email', currentUserEmail) 
        .order('is_pinned', { ascending: false, nullsFirst: false }) 
        .order('created_at', { ascending: false });

    if (error) return console.error("Error loading sessions:", error);

    historyList.innerHTML = ''; 
    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        div.innerHTML = `
            <span class="session-title-text" style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${session.is_pinned ? '📌 ' : ''}${session.title}
            </span>
            <button class="history-options-btn" onclick="openHistoryMenu(event, '${session.id}')">
                <ion-icon name="ellipsis-horizontal"></ion-icon>
            </button>
        `;
        
        div.onclick = (e) => {
            if(!e.target.closest('.history-options-btn')) loadPastSession(session.id, session.title);
        };
        
        historyList.appendChild(div);
    });
}
// Phase 7: The Anchored Popover for Chat History
window.openHistoryMenu = async function(event, sessionId) {
    event.stopPropagation(); // Prevents the chat from opening

    // 1. Create the Popover Element
    const popover = document.createElement('ion-popover');
    popover.event = event; // CRITICAL: This anchors it exactly to your mouse click!
    popover.cssClass = 'history-popover'; 

    // 2. Build the Menu Content
    popover.innerHTML = `
        <ion-content class="ion-no-padding">
            <ion-list lines="none" style="margin: 0; padding: 4px 0;">
                <ion-item button onclick="handlePopoverAction('share', '${sessionId}')">
                    <ion-icon name="share-social-outline" slot="start" style="font-size: 18px; margin-right: 12px;"></ion-icon>
                    <ion-label style="font-size: 14px;">Share conversation</ion-label>
                </ion-item>
                <ion-item button onclick="handlePopoverAction('pin', '${sessionId}')">
                    <ion-icon name="pin-outline" slot="start" style="font-size: 18px; margin-right: 12px;"></ion-icon>
                    <ion-label style="font-size: 14px;">Pin</ion-label>
                </ion-item>
                <ion-item button onclick="handlePopoverAction('rename', '${sessionId}')">
                    <ion-icon name="pencil-outline" slot="start" style="font-size: 18px; margin-right: 12px;"></ion-icon>
                    <ion-label style="font-size: 14px;">Rename</ion-label>
                </ion-item>
                <ion-item button onclick="handlePopoverAction('delete', '${sessionId}')">
                    <ion-icon name="trash-outline" slot="start" style="font-size: 18px; margin-right: 12px; color: #ff4b5c;"></ion-icon>
                    <ion-label style="font-size: 14px; color: #ff4b5c;">Delete</ion-label>
                </ion-item>
            </ion-list>
        </ion-content>
    `;

    document.body.appendChild(popover);
    await popover.present();

    // 3. Clean up the DOM after it closes
    popover.addEventListener('didDismiss', () => {
        popover.remove();
    });
};

// --- Phase 7.2: Action Handlers (Supabase & Native APIs) ---
window.handlePopoverAction = async function(action, sessionId) {
    // 1. Instantly dismiss the popover
    const popover = document.querySelector('ion-popover');
    if (popover) popover.dismiss();

    if (action === 'delete') {
        const confirmAlert = document.createElement('ion-alert');
        confirmAlert.header = 'Delete Chat?';
        confirmAlert.message = 'This will permanently remove this study session. Are you sure?';
        confirmAlert.buttons = [
            { text: 'Cancel', role: 'cancel' },
            {
                text: 'Delete',
                role: 'destructive',
                handler: async () => {
                    // Delete from Supabase
                    await supabaseClient.from('nexus_sessions').delete().eq('id', sessionId);
                    
                    // If they deleted the chat they are currently looking at, clear the screen
                    if (currentSessionId === sessionId) {
                        document.getElementById('new-chat-btn').click(); 
                    } else {
                        loadSidebarSessions(); // Otherwise, just refresh the sidebar list
                    }
                }
            }
        ];
        document.body.appendChild(confirmAlert);
        await confirmAlert.present();
    } 
    
    else if (action === 'rename') {
        const renameAlert = document.createElement('ion-alert');
        renameAlert.header = 'Rename Session';
        renameAlert.inputs = [
            { name: 'newTitle', type: 'text', placeholder: 'Enter a new title...' }
        ];
        renameAlert.buttons = [
            { text: 'Cancel', role: 'cancel' },
            {
                text: 'Save',
                handler: async (data) => {
                    const cleanTitle = data.newTitle.trim();
                    if (cleanTitle) {
                        // Update Supabase
                        await supabaseClient.from('nexus_sessions')
                            .update({ title: cleanTitle })
                            .eq('id', sessionId);
                        loadSidebarSessions(); // Refresh the sidebar
                    }
                }
            }
        ];
        document.body.appendChild(renameAlert);
        await renameAlert.present();
    }

    else if (action === 'share') {
        // Fetch all messages for this specific session
        const { data: messages } = await supabaseClient
            .from('nexus_messages')
            .select('role, content')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (messages && messages.length > 0) {
            let shareText = "🎓 Scholars Prep | Nexus AI Study Session\n\n";
            messages.forEach(m => {
                const sender = m.role === 'user' ? 'You' : 'Nexus AI';
                shareText += `**${sender}:**\n${m.content}\n\n`;
            });

            // Try to use the native mobile share sheet, fallback to clipboard on desktop
            if (navigator.share) {
                navigator.share({
                    title: 'Nexus AI Session',
                    text: shareText
                }).catch(err => console.log('Share canceled', err));
            } else {
                navigator.clipboard.writeText(shareText);
                const toast = document.createElement('ion-toast');
                toast.message = 'Chat transcript copied to clipboard!';
                toast.duration = 2000;
                document.body.appendChild(toast);
                toast.present();
            }
        }
    }

   else if (action === 'pin') {
        // Find out if it's currently pinned or not
        const { data } = await supabaseClient.from('nexus_sessions').select('is_pinned').eq('id', sessionId).single();
        const currentStatus = data ? data.is_pinned : false;
        
        // Flip the status and refresh
        await supabaseClient.from('nexus_sessions')
            .update({ is_pinned: !currentStatus })
            .eq('id', sessionId);
            
        loadSidebarSessions(); 
    }
};
async function loadPastSession(sessionId, sessionTitle) {
    currentSessionId = sessionId;
    slidingWindowHistory = []; 
    
    document.getElementById('greeting-container').style.display = 'none';
    document.getElementById('page-skeleton').style.display = 'flex'; 
    document.getElementById('chat-messages').style.display = 'none';
    messagesWrapper.innerHTML = ''; 
    
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
            // Intercept multi-file strings and build clean UI Pills
            const fileTagRegex = /\[ATTACHED_FILE:\s*(https?:\/\/[^\]]+)\](?:\[FILE_NAME:\s*([^\]]+)\])?/gi;
            
            let cleanText = text;
            let filePillsHtml = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">';
            let hasFiles = false;

            cleanText = text.replace(fileTagRegex, (match, url, name) => {
                hasFiles = true;
                const fileName = name || "Attached Document"; // Defaults securely if old chats lack the name
                const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i) != null;
                const iconName = isImage ? 'image-outline' : 'document-text-outline';

                filePillsHtml += `
                    <div class="chat-file-pill">
                        <ion-icon name="${iconName}"></ion-icon>
                        <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">${fileName}</span>
                    </div>
                `;
                return ''; // Removes the ugly code block from the final text
            }).trim();
            
            filePillsHtml += '</div>';

            // Safely render the pills on top, and the prompt text below them
            const safeText = cleanText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            contentDiv.innerHTML = (hasFiles ? filePillsHtml : '') + (safeText ? `<div>${safeText}</div>` : '');
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
    if (!userText && uploadedFiles.length === 0) return;

    document.getElementById('greeting-container').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'flex';
    
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.style.display = 'none';

    thinkingIndicator.style.display = 'flex';
    scrollToBottom(); 
    startThinkingAnimation(); 

    // --- Instant Multi-File Handoff ---
    let finalPromptText = userText;
    
    if (uploadedFiles.length > 0) {
        // Create a massive string of all tags: [ATTACHED_FILE: url][FILE_NAME: name]
        const fileTags = uploadedFiles.map(f => `[ATTACHED_FILE: ${f.url}][FILE_NAME: ${f.name}]`).join('\n');
        finalPromptText = `${fileTags}\n\n${userText}`;
        
        // Reset the input box immediately
        uploadedFiles = [];
        if (fileInput) fileInput.value = '';
        if (filePreviewBadge) {
            filePreviewBadge.style.display = 'none';
            filePreviewBadge.innerHTML = '';
        }
    }

    appendMessage('user', finalPromptText);
    slidingWindowHistory.push({ role: 'user', content: finalPromptText });

    if (currentUserEmail) {
        if (!currentSessionId) {
            const { data: session, error } = await supabaseClient
                .from('nexus_sessions')
                .insert({ user_email: currentUserEmail })
                .select().single();
            
            if (!error) currentSessionId = session.id;
            if (currentSessionId) generateAndSaveTitle(userText || "Document Analysis", currentSessionId);
        }
        
        if (currentSessionId) {
            await supabaseClient.from('nexus_messages').insert({ 
                session_id: currentSessionId, user_email: currentUserEmail, role: 'user', content: finalPromptText 
            });
        }
    }

    const { contentDiv, actionBar } = appendMessage('model', '');

    try {
        let protectedPayload = slidingWindowHistory.slice(-8); 
        if (protectedPayload.length > 0 && protectedPayload[0].role !== 'user') protectedPayload.shift(); 

        const response = await fetch('https://scholars-prep.vercel.app/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: protectedPayload })
        });

        thinkingIndicator.style.display = 'none'; 
        stopThinkingAnimation(); 

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
        stopThinkingAnimation(); 
        contentDiv.innerHTML = `<span style="color: #ff4b5c;">Error: ${error.message}</span>`;
        console.error("AI Fetch Error:", error);
    }
}

async function generateAndSaveTitle(firstPrompt, sessionId) {
    try {
        const response = await fetch('https://scholars-prep.vercel.app/api/title', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: firstPrompt })
        });
        const data = await response.json();
        await supabaseClient.from('nexus_sessions').update({ title: data.title }).eq('id', sessionId);
        loadSidebarSessions();
    } catch (err) {}
}

// --- 5. Phase 2: Voice-to-Text Engine (Android Native Ready) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = false; 

    micBtn.addEventListener('click', async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            recognition.start();
            micBtn.style.color = "#007bff"; 
            chatInput.placeholder = "Listening...";
        } catch (err) {
            console.error("Microphone permission denied:", err);
            alert("Please allow microphone permissions in your Android settings to use voice chat.");
        }
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
} else if (micBtn) { 
    micBtn.style.display = 'none'; 
}

// --- 6. EVENT LISTENERS ---
// --- Phase 2: The Attachment Modal & Native Bridge ---
if (attachBtn) {
    attachBtn.addEventListener('click', async (event) => {
        event.preventDefault(); // Stop standard clicks

        // 1. Create the Popover Element
        const popover = document.createElement('ion-popover');
        popover.event = event; 
        popover.cssClass = 'attachment-popover';
        
        // Ensure it opens ABOVE the text input, not below it
        popover.side = 'top';
        popover.alignment = 'start';

        // 2. Build the Menu Content
        popover.innerHTML = `
            <ion-content class="ion-no-padding">
                <ion-list lines="none" style="margin: 0; padding: 4px 0;">
                    <ion-item button onclick="handleAttachmentSelection('camera')">
                        <ion-icon name="camera-outline" slot="start" style="font-size: 20px; margin-right: 12px;"></ion-icon>
                        <ion-label style="font-size: 14px;">Camera</ion-label>
                    </ion-item>
                    <ion-item button onclick="handleAttachmentSelection('gallery')">
                        <ion-icon name="image-outline" slot="start" style="font-size: 20px; margin-right: 12px;"></ion-icon>
                        <ion-label style="font-size: 14px;">Photo Gallery</ion-label>
                    </ion-item>
                    <ion-item button onclick="handleAttachmentSelection('document')">
                        <ion-icon name="document-text-outline" slot="start" style="font-size: 20px; margin-right: 12px;"></ion-icon>
                        <ion-label style="font-size: 14px;">Documents</ion-label>
                    </ion-item>
                </ion-list>
            </ion-content>
        `;

        document.body.appendChild(popover);
        await popover.present();

        popover.addEventListener('didDismiss', () => { popover.remove(); });
    });
}

// 3. The "Native Bridge" Action Handler
window.handleAttachmentSelection = function(type) {
    // Dismiss the popover immediately
    const popover = document.querySelector('ion-popover.attachment-popover');
    if (popover) popover.dismiss();

    const fileInput = document.getElementById('file-upload-input');
    
    // Dynamically update the hidden file input to trigger native OS behavior
    if (type === 'camera') {
        fileInput.setAttribute('accept', 'image/*');
        fileInput.setAttribute('capture', 'environment'); // Forces mobile to open the Camera app
    } else if (type === 'gallery') {
        fileInput.setAttribute('accept', 'image/*');
        fileInput.removeAttribute('capture'); // Opens the native Photo Gallery
    } else if (type === 'document') {
        fileInput.setAttribute('accept', 'application/pdf');
        fileInput.removeAttribute('capture'); // Opens the native Files/Documents app
    }
    
    // Finally, trigger the actual file picker
    fileInput.click(); 
};

// --- Phase 3: Multi-File Gatekeeper & Background Upload ---
if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files).slice(0, 4); // Hard cap at 4 files
        if (files.length === 0) return;

        // 1. The Gatekeeper (Check all files before uploading)
        for (let file of files) {
            if (file.size > 5 * 1024 * 1024) {
                const toast = document.createElement('ion-toast');
                toast.message = `"${file.name}" exceeds the 5MB limit. Upload blocked.`;
                toast.duration = 3500;
                toast.color = 'danger';
                document.body.appendChild(toast);
                await toast.present();
                fileInput.value = '';
                return;
            }
        }

        // 2. Setup Shimmer Container
        filePreviewBadge.style.display = 'flex';
        filePreviewBadge.style.flexWrap = 'wrap';
        filePreviewBadge.style.gap = '8px';
        filePreviewBadge.style.background = 'transparent'; // Remove default blue background
        
        // Add a shimmer block for each file being uploaded
        filePreviewBadge.innerHTML = `<div class="skeleton-shimmer" style="width: 100px; height: 28px; border-radius: 12px;"></div>`.repeat(files.length);
        
        chatInput.focus();
        sendBtn.style.display = 'none';

        try {
            // 3. Parallel Background Uploading
            const uploadPromises = files.map(async (file) => {
                const fileExt = file.name.split('.').pop();
                const uniqueFileName = `${currentUserEmail.split('@')[0]}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                await supabaseClient.storage.from('nexus_files').upload(uniqueFileName, file);
                const { data } = supabaseClient.storage.from('nexus_files').getPublicUrl(uniqueFileName);
                
                return { url: data.publicUrl, name: file.name };
            });

            // Wait for all files to finish uploading
            const results = await Promise.all(uploadPromises);
            
            // Combine with any previously attached files, keeping the max at 4
            uploadedFiles = [...uploadedFiles, ...results].slice(0, 4); 

            // 4. Render the Previews
            renderFilePreviews();
            
        } catch (uploadError) {
            console.error("Upload failed:", uploadError);
            filePreviewBadge.style.display = 'none';
            alert("Upload failed. Please check your network.");
        }
    });
}

// Helper to draw the preview badges and handle individual deletions
function renderFilePreviews() {
    if (uploadedFiles.length === 0) {
        filePreviewBadge.style.display = 'none';
        filePreviewBadge.innerHTML = '';
        if (chatInput.value.trim().length === 0) sendBtn.style.display = 'none';
        return;
    }

    filePreviewBadge.innerHTML = '';
    uploadedFiles.forEach((fileObj, index) => {
        const pill = document.createElement('div');
        pill.style.cssText = "display: flex; align-items: center; background: rgba(0,123,255,0.1); color: #007bff; padding: 6px 10px; border-radius: 12px; font-size: 12px;";
        pill.innerHTML = `
            <ion-icon name="document-text-outline" style="margin-right: 4px;"></ion-icon>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px;">${fileObj.name}</span>
            <ion-icon name="close-circle" style="margin-left: 6px; cursor: pointer; font-size: 16px;"></ion-icon>
        `;
        
        // Remove individual file on click
        pill.querySelector('ion-icon[name="close-circle"]').addEventListener('click', () => {
            uploadedFiles.splice(index, 1);
            renderFilePreviews();
        });
        
        filePreviewBadge.appendChild(pill);
    });
    
    sendBtn.style.display = 'flex';
}


sendBtn.addEventListener('click', handleSend);

chatInput.addEventListener('input', function() {
    sendBtn.style.display = (this.value.trim().length > 0 || uploadedFiles.length > 0) ? 'flex' : 'none';
    this.style.height = 'auto'; 
    this.style.height = (this.scrollHeight) + 'px';
});

chatInput.addEventListener('keydown', function(e) {
    // Detect if the user is on a mobile device (touch screen or small width)
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;

    if (e.key === 'Enter' && !e.shiftKey) {
        if (isMobile) {
            // Let the native mobile keyboard drop to a new line naturally
            return; 
        } else {
            // On desktop, prevent the new line and send the message
            e.preventDefault(); 
            handleSend();
        }
    }
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    const body = document.body;
    if (body.classList.contains('dark-mode')) {
        body.classList.replace('dark-mode', 'light-mode');
    } else {
        body.classList.replace('light-mode', 'dark-mode');
    }
});

document.getElementById('new-chat-btn').addEventListener('click', () => {
    document.getElementById('chat-messages').style.display = 'none';
    document.getElementById('greeting-container').style.display = 'flex';
    document.getElementById('messages-wrapper').innerHTML = ''; 
    chatInput.value = ''; 
    chatInput.style.height = 'auto'; 
    sendBtn.style.display = 'none';
    
    uploadedFiles = [];
    if (fileInput) fileInput.value = '';
    if (filePreviewBadge) {
        filePreviewBadge.style.display = 'none';
        filePreviewBadge.innerHTML = '';
    }

    slidingWindowHistory = []; 
    currentSessionId = null; 
    
    const menu = document.querySelector('ion-menu');
    if (menu) menu.close();
});  

initializeNexus();