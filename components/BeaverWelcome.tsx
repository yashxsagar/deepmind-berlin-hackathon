import React, { useEffect, useState, useRef } from "react";
import { Mic, MicOff, ChevronRight, HardHat, Sparkles } from "lucide-react";
import { LiveSessionManager } from "../services/liveSessionManager";
import { BennyAvatar } from "./BennyAvatar";

interface BeaverWelcomeProps {
  onContinue: () => void;
}

const BeaverWelcome: React.FC<BeaverWelcomeProps> = ({ onContinue }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showContinue, setShowContinue] = useState(false);
  const liveManager = useRef<LiveSessionManager | null>(null);

  useEffect(() => {
    liveManager.current = new LiveSessionManager();
    return () => {
      liveManager.current?.disconnect();
    };
  }, []);

  const toggleConnection = async () => {
    if (isConnected) {
      await liveManager.current?.disconnect();
      setIsConnected(false);
      setAudioLevel(0);
    } else {
      setError(null);
      await liveManager.current?.connect(
        (level) => setAudioLevel(level),
        (err) => {
          console.error("🦫 Error:", err);
          setError("Oops! Benny couldn't hear you. Check your mic!");
          setIsConnected(false);
        },
        () => {
          // onConnected callback
          setIsConnected(true);
          // Show continue button after a few seconds
          setTimeout(() => setShowContinue(true), 10000);
        }
      );
      // Set connected immediately for UI feedback (will be confirmed by onConnected)
      setIsConnected(true);
    }
  };

  const getAvatarMode = (): "idle" | "listening" | "talking" | "working" => {
    if (audioLevel > 0.1) return "talking";
    if (isConnected) return "listening";
    return "idle";
  };

  return (
    <div className="fixed inset-0 bg-slate-50 wood-pattern overflow-hidden">
      {/* Wood pattern style */}
      <style>{`
        .wood-pattern {
          background-color: #eab308;
          background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px);
        }
      `}</style>

      {/* Floating construction elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-10 left-10 animate-bounce"
          style={{ animationDuration: "3s" }}
        >
          <HardHat className="w-12 h-12 text-yellow-600/40" />
        </div>
        <div
          className="absolute top-20 right-20 animate-bounce"
          style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
        >
          <Sparkles className="w-8 h-8 text-yellow-500/50" />
        </div>
        <div
          className="absolute bottom-40 left-20 animate-bounce"
          style={{ animationDuration: "4s", animationDelay: "1s" }}
        >
          <div className="w-6 h-6 bg-yellow-600/30 rounded rotate-45"></div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white/90 backdrop-blur-md w-full max-w-2xl rounded-[40px] shadow-2xl border-8 border-white overflow-hidden p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1
              className="text-4xl md:text-5xl font-bold text-amber-500 drop-shadow-sm mb-2"
              style={{ fontFamily: "'Fredoka', 'Comic Sans MS', cursive" }}
            >
              CivicScape
            </h1>
            <p className="text-amber-700 text-lg">
              Design Your Dream School! 🏫
            </p>
          </div>

          {/* Main Content */}
          <div className="flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-bold text-amber-800 mb-2">
              Chat with Benny!
            </h2>
            <p className="text-amber-700 mb-6">
              {isConnected
                ? "Listening... Say hello to Benny! 🎤"
                : 'Click the button and say "Hello Benny!"'}
            </p>

            {/* Benny Avatar */}
            <BennyAvatar
              isSpeaking={audioLevel > 0.05}
              audioLevel={audioLevel}
              mode={getAvatarMode()}
            />

            {/* Microphone Button */}
            <div className="mt-8">
              <button
                onClick={toggleConnection}
                className={`relative group p-6 rounded-full shadow-xl transition-all duration-300 ${
                  isConnected
                    ? "bg-red-500 hover:bg-red-600 scale-110"
                    : "bg-green-500 hover:bg-green-600"
                }`}
              >
                {isConnected ? (
                  <div className="animate-pulse">
                    <Mic className="w-10 h-10 text-white" />
                  </div>
                ) : (
                  <MicOff className="w-10 h-10 text-white" />
                )}

                {/* Ripple effect when listening */}
                {isConnected && (
                  <>
                    <div
                      className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping"
                      style={{ animationDuration: "1.5s" }}
                    ></div>
                    <div
                      className="absolute inset-0 rounded-full border border-red-300 animate-ping"
                      style={{
                        animationDuration: "2s",
                        animationDelay: "0.5s",
                      }}
                    ></div>
                  </>
                )}
              </button>
              <p className="mt-3 text-amber-600 font-bold">
                {isConnected ? "Tap to Stop" : "Tap to Talk"}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl border border-red-200 max-w-sm">
                {error}
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={onContinue}
              className={`mt-8 group relative overflow-hidden bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-sky-500/30 ${
                showContinue ? "animate-bounce-slow" : ""
              }`}
            >
              <span className="relative z-10 flex items-center gap-2 text-lg">
                {showContinue ? "Let's Explore the Map!" : "Skip to Map"}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>

              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </button>

            {/* Hint text */}
            <p className="mt-4 text-amber-600/70 text-sm text-center max-w-sm">
              {showContinue
                ? "Benny thinks you're ready to explore Berlin schools! 🗺️"
                : "Chat with Benny or skip ahead to see the map"}
            </p>
          </div>
        </div>
      </div>

      {/* Custom animation */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default BeaverWelcome;
