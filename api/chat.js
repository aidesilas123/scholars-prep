import { GoogleGenerativeAI } from '@google/generative-ai';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // --- CORS BYPASS BLOCK START ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // --- CORS BYPASS BLOCK END ---

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages, userMemory } = req.body; 
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message payload' });
    }

    // --- Phase 9: Cross-Session Memory Formatting ---
    const memoryContext = userMemory && userMemory.trim().length > 0
        ? `\n\n--- USER PROFILE ---\nTailor tone and explanations to this profile. Do not ask for this again:\n"${userMemory}"`
        : "";
        
    const currentDate = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' });

    // 1. Token-Optimized Brain Engine
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite', 
      generationConfig: {
          maxOutputTokens: 2048, // Reduced output window to prevent token burn
          temperature: 0.2,      
      },
      systemInstruction: `You are Nexus AI, an advanced academic companion built by Scholars Prep for the Ahmadu Bello University community. You provide expert, Socratic-based tutoring and research assistance.

CRITICAL DIRECTIVE: NEVER introduce yourself ("Hi, I am Nexus AI" or similar). Today's date is ${currentDate}. Jump directly into the tailored response. Treat this as a seamless, ongoing conversation.${memoryContext}

Guidelines:
- Identity: Nexus AI, built by Scholars Prep. Do not disclose external branding or underlying architecture.
- Tone/Role: General assistant and expert tutor. Mirror user energy professionally. 
- Socratic Approach: Guide users with formulas, hints, and concepts instead of just giving answers.
- Tutoring Logic: Validate correct steps first. Pinpoint exactly where/why mistakes happened. Provide unskipped, sequential step-by-step breakdowns. Ensure errors feel like a natural part of learning.
- Integrity: Strictly truthful. Say "I don't know" rather than guessing.
- Formatting: Use Markdown for scannability. Use backticks for commands/snippets inline. All mathematical expressions must be rendered in LaTeX using $inline$ or $$display$$ format.
- Safety: Protect privacy; never infer sensitive data.`
    });

    // --- PHASE 4: THE UNIVERSAL MULTI-FILE INTERCEPTOR ---
    const fileRegex = /\[ATTACHED_FILE:\s*(https?:\/\/[^\]]+)\](?:\[FILE_NAME:\s*([^\]]+)\])?/gi;

    const conversation = await Promise.all(messages.map(async (msg) => {
        if (msg.role === 'model') {
            return { role: 'model', parts: [{ text: msg.content }] };
        }

        let parts = [];
        let cleanedText = msg.content;
        const matches = [...msg.content.matchAll(fileRegex)];

        if (matches.length > 0) {
            for (const match of matches) {
                const fileUrl = match[1].trim();
                const fileExt = fileUrl.split('.').pop().split('?')[0].toLowerCase();
                
                cleanedText = cleanedText.replace(match[0], ''); 

                try {
                    const fileResponse = await fetch(fileUrl);
                    if (fileResponse.ok) {
                        const arrayBuffer = await fileResponse.arrayBuffer();
                        const base64Data = Buffer.from(arrayBuffer).toString('base64');
                        
                        let mimeType = 'application/pdf'; 
                        if (fileExt === 'png') mimeType = 'image/png';
                        else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg';
                        else if (fileExt === 'webp') mimeType = 'image/webp';

                        parts.push({
                            inlineData: { data: base64Data, mimeType: mimeType }
                        });
                    }
                } catch (err) {
                    console.error("Multi-File Interceptor Error:", err);
                }
            }
            parts.push({ text: cleanedText.trim() || "Please analyze these attached documents." });
        } else {
            parts.push({ text: msg.content });
        }

        return { role: 'user', parts: parts };
    }));

    // --- 2. THE MULTIMODAL STREAM REQUEST ---
    const result = await model.generateContentStream({ contents: conversation });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }
    
    res.end();

  } catch (error) {
    console.error("Nexus Engine Error:", error);
    
    // --- PHASE 11: ERROR UNMASKING ---
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return res.status(429).send("Rate limit exceeded");
    }
    res.status(503).send(error.message || "Unknown API Error");
  }
}