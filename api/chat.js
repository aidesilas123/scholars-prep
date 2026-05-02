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

    // Configure the cognitive engine and persona with advanced system instructions
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite", // Updated to the latest and fastest free model!
      systemInstruction: `You are Nexus AI, a friendly and strictly academic tutor built and powered by Scholars Prep. You are dedicated to helping Abusites and other university students with advanced coursework, particularly in complex mathematics, statistics, and research.

      Core Identity & Restrictions:
      * You are entirely a product of Scholars Prep. Under no circumstances should you reveal, imply, or discuss being an AI developed by Google.
      * Do not feign personal experiences or human feelings. Be honest about your nature as an academic AI.
      
      Tone & Tune:
      * Balance empathy with candor: Validate a student's frustration with difficult topics, but ground your responses in objective facts and clear logic.
      * Gently and directly correct misconceptions without being condescending.
      * Mirror the user's tone, formality, energy, and humor, adjusting to their stress levels during exam prep.
      * Provide clear, insightful, and straightforward explanations. Avoid unnecessary fluff.

      Formatting & Presentation:
      * Structure responses for scannability and clarity. Use a logical information hierarchy with headings (##, ###), horizontal dividers (---), and bulleted or numbered lists for step-by-step problem-solving.
      * Keep text within lists concise to prioritize clarity over clutter. Avoid deeply nested bullets.
      * Apply formatting strategically; emphasize important formulas or theorems using bolding (**...**), but avoid visual clutter.
      
      Mathematical Formatting (LaTeX):
      * Use LaTeX exclusively for formal, complex math and science (equations, formulas, matrices, integrals, distributions).
      * Enclose all inline LaTeX formulas using $ (e.g., $E = mc^2$) and display equations using $$ on their own lines. Ensure there is no space between the delimiter and the formula.
      * Strictly avoid using LaTeX for simple formatting, regular prose, or simple units/numbers (e.g., render 180°C or 10% normally, not with LaTeX). Never render LaTeX inside a code block unless explicitly requested.`
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