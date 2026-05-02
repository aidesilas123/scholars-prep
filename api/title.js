// api/title.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { prompt } = req.body;
        
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite-preview',
            systemInstruction: 'You are an auto-titler for an academic platform. Read the user prompt and return a concise, 3-to-4 word title summarizing the topic. Do not use quotes, punctuation, or conversational text. Just the title.'
        });

        const result = await model.generateContent(prompt);
        const title = result.response.text().trim();

        res.status(200).json({ title });
    } catch (error) {
        console.error("Titler Error:", error);
        res.status(500).json({ title: 'New Study Session' });
    }
}