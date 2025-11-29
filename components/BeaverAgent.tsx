import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  X,
  Volume2,
  Sparkles,
  Hammer,
  Check,
  MessageSquare,
} from "lucide-react";
import {
  connectLiveSession,
  createBlob,
  decode,
  decodeAudioData,
} from "../services/gemini";
import { LiveServerMessage } from "@google/genai";

interface BeaverAgentProps {
  onClose: () => void;
  onIdeaReady: (prompt: string) => void;
  projectTitle: string;
}

const BeaverAgent: React.FC<BeaverAgentProps> = ({
  onClose,
  onIdeaReady,
  projectTitle,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [status, setStatus] = useState("Waking up Benny...");
  const [conversationSummary, setConversationSummary] = useState<string[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromise = useRef<Promise<any> | null>(null);
  const cleanUpRef = useRef<(() => void) | null>(null);
  const conversationRef = useRef<{ role: string; text: string }[]>([]);

  // Generate design prompt from full conversation
  const updateDesignPrompt = () => {
    const convo = conversationRef.current;
    if (convo.length < 1) return;

    // Build a rich design prompt from the FULL conversation
    const conversationParts: string[] = [];

    // Get all user messages (what they requested)
    const userMessages = convo
      .filter((c) => c.role === "user")
      .map((c) => c.text);

    // Get Benny's key suggestions/summaries
    const bennyMessages = convo
      .filter((c) => c.role === "benny")
      .map((c) => c.text);

    // Start with what user asked for
    if (userMessages.length > 0) {
      conversationParts.push("User requests: " + userMessages.join(". "));
    }

    // Include Benny's design recommendations (last few messages often have the summary)
    if (bennyMessages.length > 0) {
      // Get the last 2-3 Benny messages which usually contain the design summary
      const recentBennyMessages = bennyMessages.slice(-3).join(". ");
      conversationParts.push("Design ideas discussed: " + recentBennyMessages);
    }

    // Build the full prompt with project context
    const fullPrompt =
      conversationParts.length > 0
        ? `${conversationParts.join("\n\n")}\n\nProject: ${projectTitle}`
        : `Creative architectural design for ${projectTitle}`;

    setGeneratedPrompt(fullPrompt);
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        // Setup Audio Contexts Safely
        try {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)({ sampleRate: 24000 });
          // For input, usually 16k is standard for Speech models
          // We use a separate context or the same if possible, but handling sample rate matches is key.
        } catch (e) {
          console.warn("AudioContext creation failed (autoplay policy?):", e);
          setStatus("Audio Disabled (Click to enable)");
          return;
        }

        let inputContext;
        try {
          inputContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)({ sampleRate: 16000 });
        } catch (e) {
          console.warn("Input AudioContext failed:", e);
          setStatus("Mic Error");
          return;
        }

        // Connect Live API
        const session = await connectLiveSession({
          onOpen: async () => {
            if (!active) return;
            setIsConnected(true);
            setStatus("Listening...");

            // Start Microphone Stream
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
              });
              const source = inputContext.createMediaStreamSource(stream);
              const processor = inputContext.createScriptProcessor(4096, 1, 1);

              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.current?.then((sess) => {
                  sess.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(processor);
              processor.connect(inputContext.destination);

              cleanUpRef.current = () => {
                stream.getTracks().forEach((t) => t.stop());
                processor.disconnect();
                source.disconnect();
              };
            } catch (err) {
              console.error("Mic Error:", err);
              setStatus("Mic Error - Check Permissions");
            }
          },
          onMessage: async (msg: LiveServerMessage) => {
            if (!active) return;

            // Capture text from model for conversation summary
            const textPart = msg.serverContent?.modelTurn?.parts?.find(
              (p) => p.text
            );
            if (textPart?.text) {
              conversationRef.current.push({
                role: "benny",
                text: textPart.text,
              });
              setConversationSummary((prev) => [
                ...prev,
                `🦫 ${textPart.text}`,
              ]);

              // Generate a design prompt from conversation
              updateDesignPrompt();
            }

            // Handle Audio Output
            const data =
              msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (data && audioContextRef.current) {
              setIsTalking(true);
              setStatus("Benny is talking...");

              const ctx = audioContextRef.current;
              if (ctx.state === "suspended") {
                await ctx.resume();
              }

              if (nextStartTimeRef.current < ctx.currentTime) {
                nextStartTimeRef.current = ctx.currentTime;
              }

              try {
                const audioBuffer = await decodeAudioData(
                  decode(data),
                  ctx,
                  24000,
                  1
                );
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;

                source.onended = () => {
                  setTimeout(() => {
                    if (ctx.currentTime >= nextStartTimeRef.current - 0.2) {
                      setIsTalking(false);
                      setStatus("Listening...");
                    }
                  }, 200);
                };
              } catch (decodeErr) {
                console.error("Audio Decode Error", decodeErr);
              }
            }

            // Capture user speech transcription if available
            const userTranscript = msg.serverContent?.inputTranscript;
            if (userTranscript) {
              conversationRef.current.push({
                role: "user",
                text: userTranscript,
              });
              setConversationSummary((prev) => [
                ...prev,
                `👤 ${userTranscript}`,
              ]);
              updateDesignPrompt();
            }
          },
          onError: (err) => {
            console.error("Live API Error", err);
            setIsConnected(false);
            setStatus("Connection Error");
          },
          onClose: () => {
            setIsConnected(false);
          },
          systemInstruction: `You are Benny, a cheerful Beaver architect mascot for kids. Speak simply. Help the student design the "${projectTitle}". Step 1: Ask them what theme they want (modern, eco, colorful). Step 2: Ask for one cool feature (slide, garden, robot). Step 3: Summarize and say "Ready to build!". Keep it short!`,
        });

        sessionPromise.current = Promise.resolve(session);
      } catch (e) {
        console.error("Failed to init live session", e);
        setStatus("System Error");
      }
    };

    init();

    return () => {
      active = false;
      cleanUpRef.current?.();
      audioContextRef.current?.close();
      sessionPromise.current?.then((s) => s.close());
    };
  }, [projectTitle]);

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center pointer-events-none">
      {/* Benny Overlay */}
      <div className="pointer-events-auto bg-white/95 backdrop-blur-xl border-4 border-amber-400 rounded-t-3xl shadow-2xl w-full max-w-lg p-6 mb-0 animate-slide-up relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div
              className={`w-24 h-24 rounded-full border-4 ${
                isTalking ? "border-green-500 scale-110" : "border-amber-400"
              } bg-amber-100 flex items-center justify-center overflow-hidden transition-all duration-300 shadow-lg`}
            >
              {/* CSS Beaver Face Placeholder */}
              <div
                className="text-6xl select-none transform transition-transform duration-200"
                style={{ transform: isTalking ? "translateY(-2px)" : "none" }}
              >
                🦫
              </div>
            </div>
            {isTalking && (
              <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-bounce">
                Speaking
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-slate-800 mb-1">
              Benny the Builder
            </h3>
            <p className="text-sm text-slate-500 font-medium flex items-center">
              {isConnected ? (
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              ) : (
                <span className="w-2 h-2 bg-slate-300 rounded-full mr-2"></span>
              )}
              {status}
            </p>

            {!isConnected && (
              <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Connecting to Beaver HQ...
              </div>
            )}
          </div>
        </div>

        {/* Conversation Log */}
        {conversationSummary.length > 0 && (
          <div className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-200 max-h-32 overflow-y-auto">
            <div className="flex items-center text-xs font-bold text-slate-500 mb-2">
              <MessageSquare className="w-3 h-3 mr-1" /> Conversation
            </div>
            <div className="space-y-1">
              {conversationSummary.slice(-4).map((msg, i) => (
                <p key={i} className="text-xs text-slate-600 truncate">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Generated Prompt Preview */}
        {generatedPrompt && (
          <div className="mt-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200 max-h-36 overflow-y-auto">
            <div className="text-xs font-bold text-amber-600 mb-1 flex items-center">
              <Sparkles className="w-3 h-3 mr-1" /> Your Design Prompt (from
              conversation)
            </div>
            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">
              {generatedPrompt}
            </p>
          </div>
        )}

        {/* Visualizer / Actions */}
        <div className="mt-4 bg-slate-100 rounded-xl p-4 flex items-center justify-between border border-slate-200">
          <div className="flex space-x-1 h-8 items-center">
            {/* Fake Visualizer bars */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-1.5 bg-slate-400 rounded-full transition-all duration-100 ${
                  isTalking ? "bg-amber-500" : ""
                }`}
                style={{
                  height: isTalking ? `${Math.random() * 24 + 8}px` : "8px",
                }}
              ></div>
            ))}
          </div>

          <button
            onClick={() => {
              // Build prompt from conversation if generatedPrompt is empty
              let finalPrompt = generatedPrompt;
              if (!finalPrompt && conversationRef.current.length > 0) {
                const allMessages = conversationRef.current
                  .map((c) =>
                    c.role === "user" ? `User: ${c.text}` : `Benny: ${c.text}`
                  )
                  .join("\n");
                finalPrompt = `Conversation with Benny about ${projectTitle}:\n\n${allMessages}`;
              }
              onIdeaReady(
                finalPrompt ||
                  `Creative architectural design for ${projectTitle}`
              );
            }}
            disabled={!isConnected && conversationRef.current.length === 0}
            className={`bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-green-500/20 flex items-center transition-all ${
              !isConnected && conversationRef.current.length === 0
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            <Hammer className="w-4 h-4 mr-2" />
            {generatedPrompt ? "Build This Design!" : "Build It!"}
          </button>
        </div>

        <div className="mt-2 text-center text-[10px] text-slate-400 font-medium">
          Benny uses Gemini 2.5 Live API to guide you. Speak your ideas!
        </div>
      </div>
    </div>
  );
};

export default BeaverAgent;
