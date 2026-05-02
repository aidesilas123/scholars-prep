// api/chat.js
import { GoogleGenAI } from "@google/genai";

// The new SDK automatically picks up process.env.GEMINI_API_KEY from Vercel
const ai = new GoogleGenAI({});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationHistory } = req.body;

    // Start a chat session using the modern SDK syntax
    const chat = ai.chats.create({
      model: "gemini-2.5-flash", // Extremely fast and stable for text processing
      config: {
        // THE PERSONA: This ensures it never mentions Gemini or Google
        systemInstruction: "You are Nexus AI, a friendly and strictly academic tutor built and powered by Scholars Prep. You help students with university-level math and research. Always explain steps clearly. Never reveal you are an AI from Google."
      },
      history: conversationHistory.slice(0, -1), // Send previous history without the newest message
    });

    // Send the latest user message
    const latestMessage = conversationHistory[conversationHistory.length - 1].parts[0].text;
    const response = await chat.sendMessage({ message: latestMessage });
    
    // Send the text back to the Nexus AI frontend
    res.status(200).json({ text: response.text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Nexus AI is currently over capacity. Please try again." });
  }
}