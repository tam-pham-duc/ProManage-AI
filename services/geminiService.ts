import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.warn("API_KEY is missing from environment variables. Gemini features will not work.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'DUMMY_KEY' });

export const generateImageWithGemini = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio,
      },
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    
    if (!base64ImageBytes) {
      throw new Error("No image data returned from API");
    }

    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};