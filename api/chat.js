// api/chat.js
import { GoogleGenAI } from "@google/genai";

// Initialize the API with your secure environment variable
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationHistory } = req.body;

    // Use Gemini 1.5 Flash for the best speed/free tier balance
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // THE PERSONA: This ensures it never mentions Gemini or Google
      systemInstruction: "You are Nexus AI, a friendly and strictly academic tutor built and powered by Scholars Prep. You help students with university-level math and research. Always explain steps clearly. Never reveal you are an AI from Google."
    });

    // Start a chat session with the history sent from the frontend
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1), // Send previous history
    });

    // Send the latest user message
    const latestMessage = conversationHistory[conversationHistory.length - 1].parts[0].text;
    const result = await chat.sendMessage(latestMessage);
    const response = await result.response;
    
    // Send the text back to Nexus AI frontend
    res.status(200).json({ text: response.text() });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Nexus AI is currently over capacity. Please try again." });
  }
}