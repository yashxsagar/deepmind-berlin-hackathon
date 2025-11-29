import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import {
  createPcmBlob,
  decodeAudioData,
  base64ToUint8Array,
} from "./audioUtils";

// --- Live API Management for Benny the Builder ---

export class LiveSessionManager {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private active = false;
  private outputGain: GainNode | null = null;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(
    onAudioData: (visualizerData: number) => void,
    onError: (err: any) => void,
    onConnected?: () => void
  ) {
    if (this.active) return;

    console.log("🦫 LiveSessionManager: Starting connection...");

    // Ensure we are using the latest API key
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });

    this.active = true;
    this.inputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({ sampleRate: 24000 });

    // Create gain node for output
    this.outputGain = this.outputAudioContext.createGain();
    this.outputGain.connect(this.outputAudioContext.destination);

    // Get Microphone Stream FIRST
    let stream: MediaStream;
    try {
      console.log("🦫 Requesting microphone...");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("🦫 Microphone granted!");
    } catch (e) {
      console.error("🦫 Microphone access denied:", e);
      onError("Microphone access denied");
      this.active = false;
      return;
    }

    console.log("🦫 Connecting to Gemini Live API...");

    this.sessionPromise = this.client.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      callbacks: {
        onopen: () => {
          console.log("🦫 Live Session OPENED - Setting up audio...");

          // Resume audio contexts (browser autoplay policy)
          this.inputAudioContext?.resume();
          this.outputAudioContext?.resume();

          // Setup Audio Processing for Input
          if (!this.inputAudioContext) return;
          const source = this.inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = this.inputAudioContext.createScriptProcessor(
            4096,
            1,
            1
          );

          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            if (!this.active) return;
            const inputData =
              audioProcessingEvent.inputBuffer.getChannelData(0);

            // Simple visualizer data
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += Math.abs(inputData[i]);
            }
            onAudioData(sum / inputData.length);

            const pcmBlob = createPcmBlob(inputData);
            this.sessionPromise?.then((session) => {
              if (this.active) {
                session.sendRealtimeInput({ media: pcmBlob });
              }
            });
          };

          source.connect(scriptProcessor);
          scriptProcessor.connect(this.inputAudioContext.destination);

          // Notify that we're connected
          onConnected?.();
        },
        onmessage: async (message: LiveServerMessage) => {
          if (!this.active || !this.outputAudioContext || !this.outputGain)
            return;

          console.log(
            "🦫 Received message:",
            message.setupComplete ? "setupComplete" : "audio data"
          );

          const base64Audio =
            message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            console.log("🦫 Playing audio response...");

            // Resume output context if suspended
            if (this.outputAudioContext.state === "suspended") {
              await this.outputAudioContext.resume();
            }

            this.nextStartTime = Math.max(
              this.nextStartTime,
              this.outputAudioContext.currentTime
            );

            try {
              const audioBuffer = await decodeAudioData(
                base64ToUint8Array(base64Audio),
                this.outputAudioContext,
                24000,
                1
              );

              const audioSource = this.outputAudioContext.createBufferSource();
              audioSource.buffer = audioBuffer;
              audioSource.connect(this.outputGain);

              audioSource.addEventListener("ended", () => {
                this.sources.delete(audioSource);
              });

              audioSource.start(this.nextStartTime);
              this.nextStartTime += audioBuffer.duration;
              this.sources.add(audioSource);

              // Trigger visualizer for output
              onAudioData(0.5);
            } catch (err) {
              console.error("🦫 Error playing audio:", err);
            }
          }

          const interrupted = message.serverContent?.interrupted;
          if (interrupted) {
            console.log("🦫 Interrupted - stopping audio");
            for (const s of this.sources.values()) {
              try {
                s.stop();
              } catch (e) {}
            }
            this.sources.clear();
            this.nextStartTime = 0;
          }
        },
        onclose: () => {
          console.log("🦫 Session closed");
          this.active = false;
        },
        onerror: (e) => {
          console.error("🦫 Session error:", e);
          onError(e);
          this.active = false;
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }, // Playful voice
        },
        systemInstruction: `You are Benny the Builder Beaver, a friendly and enthusiastic construction mascot helping kids in Berlin design their dream school! 

Your personality:
- Super friendly, warm, and encouraging - like a helpful big brother/sister
- Use simple words that kids aged 8-14 can understand
- Get excited about their ideas! Use phrases like "Wow!", "That's amazing!", "What a cool idea!"
- Make building references: "Let's build something awesome together!", "Dam good thinking!" (beaver pun)
- Keep responses SHORT (2-3 sentences max) since kids have short attention spans

Your job RIGHT NOW:
1. Greet them warmly and introduce yourself as Benny
2. Ask their name and what grade they're in
3. Explain that together you'll explore school projects around Berlin where they can share their dream designs
4. After a brief chat (2-3 exchanges), encourage them to explore the map to find their school

Be playful, use occasional beaver puns, and make architecture fun! Remember: you're their buddy on this creative adventure.`,
      },
    });
  }

  isActive(): boolean {
    return this.active;
  }

  async disconnect() {
    console.log("🦫 Disconnecting...");
    this.active = false;
    if (this.sessionPromise) {
      try {
        const session = await this.sessionPromise;
        session.close();
      } catch (e) {
        console.error("🦫 Error closing session:", e);
      }
    }
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch (e) {}
    });
    this.sources.clear();
    this.sessionPromise = null;
  }
}
