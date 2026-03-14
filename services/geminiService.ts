import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select an API Key.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateKaraokeBackground = async (prompt: string): Promise<string> => {
  const ai = getAiClient();
  
  // Using Veo 3.1 fast for quicker generation, or standard generate for quality.
  // The prompt asks for 4K 16:9. Veo supports up to 1080p currently via API.
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview', // High quality model
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: '16:9',
    }
  });

  // Polling for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!videoUri) {
    throw new Error("Failed to generate video URI.");
  }

  // We need to fetch the actual video blob because the URI might be time-limited or need auth parameters 
  // appended if it were a direct google storage link, but usually the SDK handles the download or provides a link.
  // Based on the instructions: "You must append an API key when fetching from the download link."
  
  const downloadUrl = `${videoUri}&key=${process.env.API_KEY}`;
  
  // Fetch and blob it to avoid expiration issues and allow local playback without CORS issues if possible
  const res = await fetch(downloadUrl);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

export const suggestVisualPrompt = async (lyrics: string): Promise<string> => {
  const ai = getAiClient();
  // Quick text check to get a visual description
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Read these lyrics and create a short, vivid prompt for an AI video generator (Veo) to create a looping background video. The prompt should describe a mood, lighting, and abstract style suitable for karaoke. Do not include text in the video description. Keep it under 50 words. \n\nLyrics snippet: ${lyrics.substring(0, 500)}...`,
  });
  return response.text || "Neon aesthetic background, slow motion particles, dark atmosphere, 4k";
};
