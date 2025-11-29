import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";

const getAIClient = async (requiresPaidKey: boolean = false) => {
  if (requiresPaidKey) {
    const win = window as any;
    // Check if the aistudio property exists on the window object
    if (win.aistudio) {
      const hasKey = await win.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await win.aistudio.openSelectKey();
      }
    }
  }
  // If we are in a paid context, process.env.API_KEY will be the user selected key.
  // Otherwise it's the injected environmental key.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateArchitecturalImage = async (prompt: string, base64Image?: string) => {
  // Image generation requires paid key for high quality preview models
  const ai = await getAIClient(true); 
  
  const model = 'gemini-3-pro-image-preview';
  
  const parts: any[] = [{ text: prompt }];
  
  if (base64Image) {
    parts.unshift({
      inlineData: {
        mimeType: 'image/png', // Assuming PNG for canvas exports or standardized uploads
        data: base64Image
      }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K" // High quality for architecture
      }
    }
  });

  // Parse response for image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateArchitecturalVideo = async (prompt: string, base64Image?: string) => {
  // Veo requires paid key
  const ai = await getAIClient(true);
  
  const model = 'veo-3.1-fast-generate-preview';
  
  let operation;
  
  try {
      if (base64Image) {
          // Video from Image
          operation = await ai.models.generateVideos({
            model,
            prompt,
            image: {
                imageBytes: base64Image,
                mimeType: 'image/png' 
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p', // Fast preview supports 720p/1080p
                aspectRatio: '16:9'
            }
          });
      } else {
          // Text to Video
          operation = await ai.models.generateVideos({
            model,
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
          });
      }

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      if (operation.error) {
          console.error("Video operation error:", operation.error);
          throw new Error(`Generation error: ${operation.error.message || 'Unknown error'}`);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
          console.error("No download link in operation response:", operation);
          throw new Error("Video generation completed but no video URI was returned.");
      }

      // Fetch the video blob
      const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!videoResponse.ok) {
           throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }
      const videoBlob = await videoResponse.blob();
      return URL.createObjectURL(videoBlob);
      
  } catch (error: any) {
      console.error("Video generation exception:", error);
      throw new Error(error.message || "Video generation failed");
  }
};

export const searchLocations = async (query: string, userLocation?: {lat: number, lng: number}) => {
  const ai = await getAIClient(false); // Standard Flash model can use injected key if available, otherwise falls back
  
  const model = "gemini-2.5-flash";
  const toolConfig = userLocation ? {
    retrievalConfig: {
      latLng: {
        latitude: userLocation.lat,
        longitude: userLocation.lng
      }
    }
  } : undefined;

  const response = await ai.models.generateContent({
    model,
    contents: `Find locations related to: ${query}. Return a list of places.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: toolConfig
    }
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .filter((c: any) => c.web?.uri || c.maps?.uri)
    .map((c: any) => ({
      title: c.web?.title || c.maps?.title || "Unknown Location",
      uri: c.web?.uri || c.maps?.uri
    }));
};

// --- Live API Utilities ---

export interface LiveSessionConfig {
  onOpen: () => void;
  onMessage: (message: LiveServerMessage) => void;
  onError: (error: ErrorEvent) => void;
  onClose: (event: CloseEvent) => void;
}

export const connectLiveSession = async (config: LiveSessionConfig) => {
    // Live API likely requires specific permissions or key scopes, 
    // but assuming standard environment key works for 2.5 flash native audio preview
    // or use paid key if specific limits are hit.
    const ai = await getAIClient(false); 
    
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: config.onOpen,
        onmessage: config.onMessage,
        onerror: config.onError,
        onclose: config.onClose,
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: "You are an expert architectural consultant helping a student design public spaces. Be encouraging, creative, and ask guiding questions about their vision. Keep responses concise.",
      },
    });
};

// Helper for PCM audio processing
export function createBlob(data: Float32Array): { data: string; mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    
    // Manual Base64 Encode for Uint8Array
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
  
    return {
      data: base64Data,
      mimeType: 'audio/pcm;rate=16000',
    };
}
  
export function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}