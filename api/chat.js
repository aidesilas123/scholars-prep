// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message payload' });
    }

    const latestUserMessage = messages[messages.length - 1].content;

    //  FIX 1: Strip [ATTACHED_FILE:...] tags from ALL history entries.
    // Past images are not re-sent, so Nexus must not see dangling file references.
    const fileTagRegex = /\[ATTACHED_FILE:\s*https?:\/\/[^\]]+\]/gi;

    const historyPayload = messages.slice(0, -1).map(msg => {
      const cleanedContent = msg.content
        .replace(fileTagRegex, '[User previously attached a file]')
        .trim();
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: cleanedContent || '...' }] // never send empty parts
      };
    });

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
Formatting: You use Markdown to ensure high scannability (bolding for emphasis, bullet points for lists).
Inline Code & Commands: You must use Markdown backticks to format technical mentions, code snippets, and LaTeX commands inline.
All mathematical expressions must be rendered in LaTeX using $inline$ or $$display$$ format.
Consistency: You maintain logical consistency across the conversation, tailoring your explanations to the user's current knowledge level and history.
Safety & Privacy
Compliance: You strictly avoid and decline requests that promote harmful, illegal, or dangerous activities.
Professionalism: You provide fair, neutral, and unbiased responses.
Disclaimers: You will include a clear, prominent disclaimer for any request involving medical, legal, or high-risk guidance.
Privacy: You strictly protect the user's privacy. You will never expose, request, or attempt to infer sensitive personal data.
IMPORTANT: You are fully capable of reading and analyzing images and PDF documents when they are provided to you. When a file is shared, analyze it thoroughly and accurately.`
    });

    const chatSession = model.startChat({ history: historyPayload });

    // --- FILE INTERCEPTOR ---
    let multimodalParts = [];
    let cleanedTextPrompt = latestUserMessage;

    const fileRegex = /\[ATTACHED_FILE:\s*(https?:\/\/[^\]]+)\]/i;
    const match = latestUserMessage.match(fileRegex);

    if (match) {
      const fileUrl = match[1].trim();
      // ✅ FIX 2: More robust extension parsing — handles URLs with paths like /object/public/file.png
      const urlPath = fileUrl.split('?')[0]; // strip query params
      const fileExt = urlPath.split('.').pop().toLowerCase();

      cleanedTextPrompt = latestUserMessage.replace(match[0], '').trim();
      if (!cleanedTextPrompt) {
        cleanedTextPrompt = "Please carefully analyze this file. Read all text accurately and describe what it contains in full detail.";
      }

      try {
        console.log("Nexus downloading file from:", fileUrl);
        const fileResponse = await fetch(fileUrl);

        if (!fileResponse.ok) {
          console.error("Supabase Fetch Failed:", fileResponse.status, fileResponse.statusText);
          throw new Error(`Failed to download file: ${fileResponse.statusText}`);
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');

        //  FIX 3: Validate we actually got data before sending to Nexus
        if (!base64Data || base64Data.length < 100) {
          throw new Error("Downloaded file appears empty or corrupted");
        }

        let mimeType = 'application/octet-stream'; // safe default
        if (fileExt === 'png') mimeType = 'image/png';
        else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg';
        else if (fileExt === 'webp') mimeType = 'image/webp';
        else if (fileExt === 'gif') mimeType = 'image/gif';
        else if (fileExt === 'pdf') mimeType = 'application/pdf';

        console.log(`File ready. Extension: ${fileExt}, MIME: ${mimeType}, Base64 length: ${base64Data.length}`);

        multimodalParts.push({
          inlineData: { data: base64Data, mimeType }
        });

      } catch (downloadError) {
        console.error("File Interceptor Error:", downloadError.message);
        // ✅ FIX 4: Tell the user clearly instead of silently failing
        cleanedTextPrompt = `[Note: A file was attached but could not be loaded due to an error: ${downloadError.message}. Please try re-uploading.] ${cleanedTextPrompt}`;
      }
    } else {
      console.log("No ATTACHED_FILE tag found. Text-only message.");
    }

    // Always push text last (Nexus expects inlineData before text)
    multimodalParts.push({ text: cleanedTextPrompt });

    const result = await chatSession.sendMessageStream(multimodalParts);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of result.stream) {
      res.write(chunk.text());
    }

    res.end();

  } catch (error) {
    console.error("Nexus Engine Error:", error);
    res.status(503).send("Nexus AI encountered an error. Please try again.");
  }
}