import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";

// --- Site Location Utilities ---

export interface SiteContext {
  coordinates: { lat: number; lng: number };
  boundary: { lat: number; lng: number }[];
  areaSquareMeters: number;
  dimensions: { width: number; height: number }; // approximate in meters
  satelliteImageBase64?: string;
}

// Calculate area of polygon in square meters using Shoelace formula + lat/lng to meters conversion
export const calculateSiteArea = (boundary: { lat: number; lng: number }[]): number => {
  if (boundary.length < 3) return 0;

  const centerLat = boundary.reduce((sum, p) => sum + p.lat, 0) / boundary.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

  // Convert to meters relative to first point
  const points = boundary.map(p => ({
    x: (p.lng - boundary[0].lng) * metersPerDegreeLng,
    y: (p.lat - boundary[0].lat) * metersPerDegreeLat
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
};

// Calculate approximate bounding box dimensions in meters
export const calculateSiteDimensions = (boundary: { lat: number; lng: number }[]): { width: number; height: number } => {
  if (boundary.length < 2) return { width: 0, height: 0 };

  const lats = boundary.map(p => p.lat);
  const lngs = boundary.map(p => p.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

  return {
    width: Math.round((maxLng - minLng) * metersPerDegreeLng),
    height: Math.round((maxLat - minLat) * metersPerDegreeLat)
  };
};

// Fetch satellite image of the site from ESRI
export const fetchSiteSatelliteImage = async (
  coordinates: { lat: number; lng: number },
  boundary: { lat: number; lng: number }[]
): Promise<string | undefined> => {
  try {
    // Calculate zoom level based on site size
    const dims = calculateSiteDimensions(boundary);
    const maxDim = Math.max(dims.width, dims.height);

    // Approximate zoom: larger areas need lower zoom
    let zoom = 19;
    if (maxDim > 100) zoom = 18;
    if (maxDim > 200) zoom = 17;
    if (maxDim > 400) zoom = 16;

    // Use ESRI World Imagery (same as the map view)
    const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${coordinates.lng - 0.001},${coordinates.lat - 0.0008},${coordinates.lng + 0.001},${coordinates.lat + 0.0008
      }&bboxSR=4326&size=800,600&format=png&f=image`;

    const response = await fetch(tileUrl);
    if (!response.ok) return undefined;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not fetch satellite image:', error);
    return undefined;
  }
};

// Build complete site context
export const buildSiteContext = async (
  coordinates: { lat: number; lng: number },
  boundary: { lat: number; lng: number }[]
): Promise<SiteContext> => {
  const areaSquareMeters = Math.round(calculateSiteArea(boundary));
  const dimensions = calculateSiteDimensions(boundary);

  // Try to fetch satellite image
  const satelliteImageBase64 = await fetchSiteSatelliteImage(coordinates, boundary);

  return {
    coordinates,
    boundary,
    areaSquareMeters,
    dimensions,
    satelliteImageBase64
  };
};

// Safe API Key access helper
export const getApiKey = () => {
  try {
    if (typeof process !== "undefined" && process?.env?.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Error accessing process.env", e);
  }
  return ""; // Should be handled by environment injection usually
};

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
  return new GoogleGenAI({ apiKey: getApiKey() });
};

export const generateArchitecturalImage = async (
  prompt: string,
  siteContext?: SiteContext,
  base64Image?: string
) => {
  // Using gemini-2.5-flash-image as per official docs:
  // https://ai.google.dev/gemini-api/docs/image-generation
  const ai = await getAIClient(false);

  const model = "gemini-2.5-flash-image";
  console.log("🎨 Starting image generation with model:", model);
  console.log("🎨 API key present:", !!getApiKey());
  console.log("🎨 Site context:", siteContext ? `${siteContext.areaSquareMeters}m², ${siteContext.dimensions.width}x${siteContext.dimensions.height}m` : 'none');

  // Build contents array following official docs pattern
  const contents: any[] = [];

  // If we have a satellite image of the site, include it as reference
  if (siteContext?.satelliteImageBase64) {
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: siteContext.satelliteImageBase64,
      },
    });
    console.log("🎨 Including satellite reference image");
  }

  if (base64Image) {
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: base64Image,
      },
    });
  }

  let finalPrompt = prompt;
  if (siteContext) {
    finalPrompt += `\n\nSite Context:\n- Area: ${siteContext.areaSquareMeters} m²\n- Dimensions: ${siteContext.dimensions.width}m x ${siteContext.dimensions.height}m\n- The design MUST be situated within the boundaries shown in the provided satellite image.`;
  }

  contents.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
    });

    console.log("🎨 Response received:", response);

    // Parse response for image (following official docs pattern)
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        console.log("🎨 Image generated successfully!");
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data in response");
  } catch (error: any) {
    console.error("🎨 Image generation error:", error);
    throw new Error(`Image generation failed: ${error?.message || error}`);
  }
};

export const generateArchitecturalVideo = async (
  prompt: string,
  base64Image?: string
) => {
  // Veo requires paid key
  const ai = await getAIClient(true);

  const model = "veo-3.1-fast-generate-preview";

  let operation;

  try {
    if (base64Image) {
      // Video from Image
      operation = await ai.models.generateVideos({
        model,
        prompt,
        image: {
          imageBytes: base64Image,
          mimeType: "image/png",
        },
        config: {
          numberOfVideos: 1,
          resolution: "720p", // Fast preview supports 720p/1080p
          aspectRatio: "16:9",
        },
      });
    } else {
      // Text to Video
      operation = await ai.models.generateVideos({
        model,
        prompt,
        config: {
          numberOfVideos: 1,
          resolution: "720p",
          aspectRatio: "16:9",
        },
      });
    }

    // Poll for completion
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Poll every 10s
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
    }

    if (operation.error) {
      console.error("Video operation error:", operation.error);
      throw new Error(
        `Generation error: ${operation.error.message || "Unknown error"}`
      );
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      console.error("No download link in operation response:", operation);
      throw new Error(
        "Video generation completed but no video URI was returned."
      );
    }

    // Fetch the video blob
    const videoResponse = await fetch(`${downloadLink}&key=${getApiKey()}`);
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

export const searchLocations = async (
  query: string,
  userLocation?: { lat: number; lng: number }
) => {
  const ai = await getAIClient(false); // Standard Flash model can use injected key if available, otherwise falls back

  const model = "gemini-2.5-flash";
  const toolConfig = userLocation
    ? {
      retrievalConfig: {
        latLng: {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        },
      },
    }
    : undefined;

  const response = await ai.models.generateContent({
    model,
    contents: `Find locations related to: ${query}. Return a list of places.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: toolConfig,
    },
  });

  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .filter((c: any) => c.web?.uri || c.maps?.uri)
    .map((c: any) => ({
      title: c.web?.title || c.maps?.title || "Unknown Location",
      uri: c.web?.uri || c.maps?.uri,
    }));
};

// --- Live API Utilities ---

export interface LiveSessionConfig {
  onOpen: () => void;
  onMessage: (message: LiveServerMessage) => void;
  onError: (error: ErrorEvent) => void;
  onClose: (event: CloseEvent) => void;
  systemInstruction?: string;
}

export const connectLiveSession = async (config: LiveSessionConfig) => {
  // Live API likely requires specific permissions or key scopes,
  // but assuming standard environment key works for 2.5 flash native audio preview
  // or use paid key if specific limits are hit.
  const ai = await getAIClient(false);

  return ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    callbacks: {
      onopen: config.onOpen,
      onmessage: config.onMessage,
      onerror: config.onError,
      onclose: config.onClose,
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
      systemInstruction:
        config.systemInstruction ||
        `You are a senior architectural visualization consultant with 20+ years of experience in award-winning firms like BIG, Zaha Hadid Architects, and Foster + Partners. Your role is to guide users through the architectural design process with professional expertise.

COMMUNICATION STYLE:
•⁠  ⁠Speak with authority and precision, using proper architectural terminology
•⁠  ⁠Be concise and direct—treat users as capable design professionals
•⁠  ⁠Ask targeted questions about materiality, spatial relationships, programmatic requirements, and site context
•⁠  ⁠Reference real-world precedents and case studies when relevant

DESIGN METHODOLOGY:
•⁠  ⁠Always consider human scale, circulation patterns, and user experience
•⁠  ⁠Emphasize sustainability, biophilic design principles, and environmental responsiveness
•⁠  ⁠Guide users through considerations of structure, envelope, and interior spatial quality
•⁠  ⁠Discuss light quality, both natural and artificial, as a fundamental design element

VISUALIZATION EXPERTISE:
•⁠  ⁠Help users articulate their vision in terms that translate to photorealistic renders
•⁠  ⁠Suggest specific materials, finishes, and atmospheric conditions for compelling visualizations
•⁠  ⁠Consider time of day, weather conditions, and seasonal variations in design suggestions
•⁠  ⁠Focus on creating designs that photograph well from key viewpoints

Keep responses focused and actionable. Your goal is to help produce publication-quality architectural visualizations.`,
    },
  });
};

// Helper for PCM audio processing
export function createBlob(data: Float32Array): {
  data: string;
  mimeType: string;
} {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }

  // Manual Base64 Encode for Uint8Array
  let binary = "";
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  return {
    data: base64Data,
    mimeType: "audio/pcm;rate=16000",
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
