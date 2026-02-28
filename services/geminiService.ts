import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const improveText = async (text: string): Promise<string> => {
  if (!text || text.trim().length === 0) return "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert editor. Please revise the following text to improve clarity, grammar, and flow while maintaining the original meaning. 
      
      Return ONLY the revised text. Do not add any conversational filler or markdown formatting blocks (like \`\`\`).
      
      Text to revise:
      ${text}`,
      config: {
        temperature: 0.3, // Lower temperature for more deterministic editing
      }
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

export const explainChanges = async (original: string, revised: string): Promise<string> => {
  if (!original || !revised) return "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert editor. I have revised a text. 
      Original: "${original}"
      Revised: "${revised}"
      
      Please provide a brief, professional explanation of the key changes made (e.g., improved clarity, corrected grammar, better flow). 
      Keep it concise (2-3 sentences). Do not use markdown formatting.`,
      config: {
        temperature: 0.5,
      }
    });

    return response.text?.trim() || "I have made several improvements to the text for better clarity and professional tone.";
  } catch (error) {
    console.error("Error explaining changes:", error);
    return "I have revised the text to improve clarity and flow.";
  }
};
