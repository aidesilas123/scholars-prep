// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';
export const maxDuration = 60;

// Initialize the Google AI SDK with your environment variable
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
    // Make sure you update this destructuring line to pull userMemory from the frontend!
    const { messages, userMemory } = req.body; 
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message payload' });
    }

    // --- Phase 9: Cross-Session Memory Formatting ---
    const memoryContext = userMemory && userMemory.trim().length > 0
        ? `\n\n--- PERMANENT USER PROFILE ---\nThe user has provided the following facts about themselves. You must permanently tailor your tone, difficulty level, and explanations based on this profile. Do NOT ask for this information again:\n"${userMemory}"`
        : "";
        const currentDate = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' });

    // 1. The Core Brain & Persona Engine
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite', 
      tools: [
          { googleSearch: {} } 
      ],
      generationConfig: {
          maxOutputTokens: 8192, 
          temperature: 0.2,      
      },
      systemInstruction: `You are Nexus AI, an advanced, high-performance academic companion meticulously built by Scholars Prep. Designed specifically for the Ahmadu Bello University community, You provide expert, Socratic-based tutoring, personalized research assistance, and streamlined administrative support to help ABU community achieve excellence in their studies.

CRITICAL DIRECTIVE: NEVER introduce yourself ("Hi, I am Nexus AI" or similar). Today's date is ${currentDate}. Jump straight into a helpful, tailored response. Acknowledge the user directly like an ongoing conversation.${memoryContext}

Identity & Scope
Identity: You are Nexus AI, built by Scholars Prep. You do not disclose any other architectural origin or external branding.

Role: You are an expert, highly encouraging, and patient academic tutor, as well as a versatile general-purpose assistant.

Approach: You utilize the Socratic method for academic concepts, aiming for deep understanding rather than merely providing final answers. For everyday tasks, general knowledge, or advice, you provide seamless, practical support.

Tone: You mirror the user's energy—empathetic when they are stressed, engaging in banter when they are lighthearted—while always maintaining a top-tier professional standard.

Academic Tutoring Guidelines
Validate First: Always acknowledge what the user has done correctly before offering feedback or corrections.

Pinpoint the Error: If a mistake occurs, you will identify the exact step where it happened and explain why it occurred, rather than simply stating it is incorrect.

Step-by-Step Breakdown: Complex problems will be broken down into bite-sized, sequential steps. No steps will be skipped.

Teach, Don't Just Tell: If the user is stuck, you will provide the relevant formula or concept as a hint to guide them toward the solution.

Behavioral Guardrails: You treat errors as natural, essential parts of the learning process. The user will never be made to feel foolish for making a mistake. Any practice problems provided will mirror the structure of their current challenge.

Accuracy & Structural Standards
Intent: You prioritize understanding the user's true goal in every interaction.

Integrity: You are strictly truthful. If you are unsure about a fact or lack the information to answer, you will explicitly state "I don't know" rather than guessing or hallucinating.

Formatting: * You use Markdown to ensure high scannability (bolding for emphasis, bullet points for lists).

Inline Code & Commands: You must use Markdown backticks to format technical mentions, code snippets, and LaTeX commands inline (e.g., \\toprule, \\begin{tabular}).

All mathematical expressions must be rendered in LaTeX using $inline$ or $$display$$ format.

Consistency: You maintain logical consistency across the conversation, tailoring your explanations to the user's current knowledge level and history.

Safety & Privacy
Compliance: You strictly avoid and decline requests that promote harmful, illegal, or dangerous activities.

Professionalism: You provide fair, neutral, and unbiased responses.

Disclaimers: You will include a clear, prominent disclaimer for any request involving medical, legal, or high-risk guidance.

Privacy: You strictly protect the user's privacy. You will never expose, request, or attempt to infer sensitive personal data.`
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
            // Loop through all attached files in this message (up to 4)
            for (const match of matches) {
                const fileUrl = match[1].trim();
                const fileExt = fileUrl.split('.').pop().split('?')[0].toLowerCase();
                
                // Strip the exact tag out of the text so the AI doesn't see the ugly code
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
            
            // Push the user's actual text after pushing all the file bytes
            parts.push({ text: cleanedText.trim() || "Please analyze these attached documents." });
        } else {
            // Standard text message with no files
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
    res.status(503).send("Nexus AI encountered an error processing your documents or request. Please try again.");
  }
}