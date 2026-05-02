// We use 'require' here so it perfectly matches standard Node.js apps like your webhook
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the official, stable Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async function handler(req, res) {
  // Enforce secure POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationHistory } = req.body;

    // Configure the cognitive engine and persona
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: "You are Nexus AI, a friendly and strictly academic tutor built and powered by Scholars Prep. You help students with university-level math and research. Always explain steps clearly. Never reveal you are an AI from Google."
    });

    // Initialize the chat session with the sliding memory window
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1),
    });

    // Process the latest student query
    const latestMessage = conversationHistory[conversationHistory.length - 1].parts[0].text;
    const result = await chat.sendMessage(latestMessage);
    const response = await result.response;

    // Transmit the parsed text back to the frontend
    res.status(200).json({ text: response.text() });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Nexus AI is currently over capacity. Please try again." });
  }
};