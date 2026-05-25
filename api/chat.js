// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message payload' });
    }

    const latestUserMessage = messages[messages.length - 1].content;

    const historyPayload = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 1. The Core Brain & Persona Engine
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash', 
      systemInstruction: `You are Nexus AI, an advanced, high-performance academic companion meticulously built by Scholars Prep. Designed specifically for the Ahmadu Bello University community, You provide expert, Socratic-based tutoring, personalized research assistance, and streamlined administrative support to help ABU community achieve excellence in their studies.
      
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

    // --- PHASE 4: THE FILE INTERCEPTOR ---
    let multimodalParts = [];
    let cleanedTextPrompt = latestUserMessage;

    const fileRegex = /\[ATTACHED_FILE:\s*(https?:\/\/[^\]]+)\]/i;
    const match = latestUserMessage.match(fileRegex);

    if (match) {
        const fileUrl = match[1].trim();
        const fileExt = fileUrl.split('.').pop().split('?')[0].toLowerCase();
        
        cleanedTextPrompt = latestUserMessage.replace(match[0], '').trim();
        
        if (!cleanedTextPrompt) {
            cleanedTextPrompt = "Please carefully analyze this document or image. Read the text accurately and tell me what it contains.";
        }

        try {
            console.log("Nexus downloading file from:", fileUrl);
            const fileResponse = await fetch(fileUrl);
            
            if (!fileResponse.ok) {
                console.error("Supabase Fetch Failed:", fileResponse.statusText);
                throw new Error("Failed to download file");
            }
            
            const arrayBuffer = await fileResponse.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            
            let mimeType = 'application/pdf'; // Default
            if (fileExt === 'png') mimeType = 'image/png';
            else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg';
            else if (fileExt === 'webp') mimeType = 'image/webp';
            else if (fileExt === 'pdf') mimeType = 'application/pdf';

            multimodalParts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            });
        } catch (downloadError) {
            console.error("File Interceptor Error:", downloadError);
        }
    }

    // Explicitly add the text as a text part to prevent SDK crashes
    multimodalParts.push({ text: cleanedTextPrompt });

    // --- 2. THE MULTIMODAL STREAM REQUEST ---
    // NO startChat. We manually build the conversation array.
    const conversation = [
        ...historyPayload,
        {
            role: 'user',
            parts: multimodalParts
        }
    ];

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
    res.status(503).send("Nexus AI encountered an error processing your document or request. Please try again.");
  }
}