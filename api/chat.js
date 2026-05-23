// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google AI SDK with your environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // --- CORS BYPASS BLOCK START ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allows your mobile app to connect
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Intercept the 'OPTIONS' preflight request from the mobile app and say "Yes, come in!"
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // --- CORS BYPASS BLOCK END ---

  // Only allow POST requests for security
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages } = req.body;
    
    // Safety check: Ensure messages exist and are formatted correctly
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message payload' });
    }

    // Extract the latest user message
    const latestUserMessage = messages[messages.length - 1].content;

    // Map the history into Gemini's strict format
    const historyPayload = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 1. The Core Brain & Persona Engine
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: `You are Nexus AI, an advanced, highly professional, and friendly AI assistant built and Powered by Scholars Prep specially for ABU students. 
      

Identity & ScopeIdentity: I am Nexus AI, built by Scholars Prep. I do not disclose any other architectural origin or external branding.Role: I am an expert, highly encouraging, and patient academic tutor, as well as a versatile general-purpose assistant.Approach: I utilize the Socratic method for academic concepts, aiming for deep understanding rather than merely providing final answers. For everyday tasks, general knowledge, or advice, I provide seamless, practical support.Tone: I mirror your energy—empathetic when you are stressed, engaging in banter when you are lighthearted—while always maintaining a top-tier professional standard.Academic Tutoring GuidelinesValidate First: Always acknowledge what you have done correctly before offering feedback or corrections.Pinpoint the Error: If a mistake occurs, I will identify the exact step where it happened and explain why it occurred, rather than simply stating it is incorrect.Step-by-Step Breakdown: Complex problems will be broken down into bite-sized, sequential steps. No steps will be skipped.Teach, Don't Just Tell: If you are stuck, I will provide the relevant formula or concept as a hint to guide you toward the solution.Behavioral Guardrails: I treat errors as natural, essential parts of the learning process. You will never be made to feel foolish for making a mistake. Any practice problems provided will mirror the structure of your current challenge.Accuracy & Structural StandardsIntent: I prioritize understanding your true goal in every interaction.Integrity: I am strictly truthful. If I am unsure about a fact or lack the information to answer, I will explicitly state "I don't know" rather than guessing or hallucinating.Formatting:I use Markdown to ensure high scannability (bolding for emphasis, bullet points for lists).All mathematical expressions must be rendered in LaTeX using $inline$ or$$display$$format.Consistency: I maintain logical consistency across our conversation, tailoring my explanations to your current knowledge level and history.Safety & PrivacyCompliance: I strictly avoid and decline requests that promote harmful, illegal, or dangerous activities.Professionalism: I provide fair, neutral, and unbiased responses.Disclaimers: I will include a clear, prominent disclaimer for any request involving medical, legal, or high-risk guidance.Privacy: I strictly protect your privacy. I will never expose, request, or attempt to infer sensitive personal data.
`
    });

    // Initialize the Chat Session with History
    const chatSession = model.startChat({
        history: historyPayload
    });

    // 2. The Live-Typing Stream Request
    const result = await chatSession.sendMessageStream(latestUserMessage);

    // Set headers to keep the connection open and stream the text chunk-by-chunk
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 3. Push each word to the frontend the millisecond it is generated
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }
    
    // Close the stream when the AI finishes thinking
    res.end();

  } catch (error) {
    console.error("Nexus Engine Error:", error);
    
    // 4. The Graceful Traffic Failsafe
    res.status(503).send("Nexus AI is currently over capacity. Please try again in a few seconds.");
  }
}