import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';
import { connectLiveSession, createBlob, decode, decodeAudioData } from '../services/gemini';
import { LiveServerMessage } from '@google/genai';

interface LiveAssistantProps {
  onClose: () => void;
  onIdeaCapture: (text: string) => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ onClose, onIdeaCapture }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null); // For visualizer if we wanted
  const canvasRef = useRef<HTMLCanvasElement>(null); // Visualizer
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  const sessionResolveRef = useRef<Function | null>(null);
  const sessionPromise = useRef<Promise<any>>(new Promise(r => sessionResolveRef.current = r));

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        // Setup Audio Contexts
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        // Connect Live API
        const session = await connectLiveSession({
            onOpen: async () => {
                if (!active) return;
                setIsConnected(true);
                
                // Start Microphone Stream
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    streamRef.current = stream;
                    
                    const source = inputContext.createMediaStreamSource(stream);
                    const processor = inputContext.createScriptProcessor(4096, 1, 1);
                    
                    processor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.current.then(sess => {
                            sess.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    source.connect(processor);
                    processor.connect(inputContext.destination);
                    
                    sourceRef.current = source;
                    processorRef.current = processor;
                } catch (err) {
                    console.error("Mic Error:", err);
                }
            },
            onMessage: async (msg: LiveServerMessage) => {
                if (!active) return;
                
                const data = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (data && audioContextRef.current) {
                    setIsTalking(true);
                    const ctx = audioContextRef.current;
                    
                    // Simple logic to keep time moving forward
                    if (nextStartTimeRef.current < ctx.currentTime) {
                        nextStartTimeRef.current = ctx.currentTime;
                    }
                    
                    const audioBuffer = await decodeAudioData(decode(data), ctx, 24000, 1);
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    
                    source.onended = () => {
                        // Rough check if talking stopped
                        if (ctx.currentTime >= nextStartTimeRef.current - 0.1) {
                            setIsTalking(false);
                        }
                    };
                }

                // Handle turn complete for transcription if we enabled it (not in this basic setup but good to know)
                if (msg.serverContent?.turnComplete) {
                    setIsTalking(false);
                }
            },
            onError: (err) => {
                console.error("Live API Error", err);
                setIsConnected(false);
            },
            onClose: () => {
                setIsConnected(false);
            }
        });

        if (sessionResolveRef.current) {
            sessionResolveRef.current(session);
        }

      } catch (e) {
        console.error("Failed to init live session", e);
      }
    };

    init();

    return () => {
      active = false;
      // Cleanup
      streamRef.current?.getTracks().forEach(t => t.stop());
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
      // session close is tricky without the session object ref here directly, usually handled by closure or ref
      sessionPromise.current.then(s => s.close());
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-sky-500/50 rounded-2xl w-full max-w-md p-6 flex flex-col items-center relative shadow-2xl shadow-sky-500/20">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>

        <div className="mb-8 mt-4 relative">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isTalking ? 'bg-sky-500 shadow-[0_0_40px_rgba(14,165,233,0.6)] scale-110' : 'bg-slate-800 border-2 border-slate-700'}`}>
             <Volume2 className={`w-10 h-10 ${isTalking ? 'text-white animate-pulse' : 'text-slate-500'}`} />
          </div>
          {/* Ripple rings */}
          {isConnected && (
             <>
                <div className="absolute inset-0 rounded-full border border-sky-500/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                <div className="absolute inset-0 rounded-full border border-sky-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
             </>
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-2">Architectural Assistant</h3>
        <p className="text-slate-400 text-center mb-8 text-sm">
          {isConnected ? "Listening... Discuss your ideas freely." : "Connecting to Gemini..."}
        </p>

        <div className="w-full bg-slate-800 rounded-lg p-3 text-center text-xs text-slate-500">
           Say "I want to design a..." or "What if we added..."
        </div>
      </div>
    </div>
  );
};

export default LiveAssistant;
