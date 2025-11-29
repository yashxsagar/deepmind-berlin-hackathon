import React, { useState, useEffect, useRef } from "react";
import { Project, Idea } from "../types";
import {
  generateArchitecturalImage,
  generateArchitecturalVideo,
} from "../services/gemini";
import {
  getIdeas,
  saveIdea,
  voteIdea,
  getVoteCount,
} from "../services/storage";
import { DESIGN_PRESETS } from "../constants";
import {
  MessageSquare,
  ThumbsUp,
  Video,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Send,
  Mic,
  Edit,
  Wand2,
  Plus,
  Check,
  Play,
  Map as MapIcon,
  Globe,
  Layers,
  AlertCircle,
  Eye,
  PenTool,
  Palette,
  Maximize2,
  FileImage,
} from "lucide-react";
import BeaverAgent from "./BeaverAgent";
import ImageLightbox from "./ImageLightbox";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  addPoints: (amount: number) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  addPoints,
}) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [activeTab, setActiveTab] = useState<
    "ideate" | "site" | "gallery" | "drawings"
  >("ideate");
  const [isBeaverActive, setIsBeaverActive] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [ideaReactions, setIdeaReactions] = useState<{
    [key: string]: string[];
  }>({});

  // Design Input State
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Leaflet Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    const loadedIdeas = getIdeas(project.id);
    const ideasWithVotes = loadedIdeas.map((idea) => ({
      ...idea,
      votes: getVoteCount(idea.id, idea.votes),
    }));
    setIdeas(ideasWithVotes);
  }, [project.id]);

  // Init Map when tab changes
  useEffect(() => {
    if (
      activeTab === "site" &&
      mapContainerRef.current &&
      !mapInstanceRef.current
    ) {
      const L = (window as any).L;
      if (!L) {
        setMapError("Map library not found");
        return;
      }

      try {
        const map = L.map(mapContainerRef.current, {
          center: [project.coordinates.lat, project.coordinates.lng],
          zoom: 19,
          zoomControl: true,
        });

        // Esri World Imagery (Satellite)
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri",
          }
        ).addTo(map);

        // Boundary
        const latLngs = (project.boundary as any[]).map((p) => [p.lat, p.lng]);
        L.polygon(latLngs, {
          color: "#22c55e",
          weight: 3,
          fillColor: "#22c55e",
          fillOpacity: 0.1,
        }).addTo(map);

        // Marker
        const icon = L.divIcon({
          className: "custom-site-marker",
          html: '<div style="background-color: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
          iconSize: [16, 16],
        });
        L.marker([project.coordinates.lat, project.coordinates.lng], {
          icon,
        }).addTo(map);

        mapInstanceRef.current = map;
      } catch (e) {
        console.error("Map init error:", e);
        setMapError("Could not initialize view.");
      }
    }

    return () => {
      if (activeTab !== "site" && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab, project]);

  const handleVote = (ideaId: string) => {
    const newCount = voteIdea(ideaId);
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId
          ? { ...i, votes: getVoteCount(ideaId, i.votes), isLiked: true }
          : i
      )
    );
  };

  const handleBeaverIdea = async (promptFromBeaver: string) => {
    setIsBeaverActive(false);
    setCustomPrompt(promptFromBeaver); // Fill input with beaver's idea
  };

  const handleGenerateClick = async () => {
    if (!customPrompt && !selectedPreset) {
      alert("Please describe your idea or select a style!");
      return;
    }

    const presetPrompt = selectedPreset
      ? DESIGN_PRESETS.find((p) => p.id === selectedPreset)?.prompt
      : "";

    const complexPrompt = `
        High-quality architectural visualization, highly detailed, photorealistic render.
        Subject: ${project.title} located at ${project.location}.
        Design Specs: ${customPrompt}.
        Style Modifier: ${presetPrompt}.
        Requirements: Realistic architectural drawing, 8k resolution, cinematic lighting, precise perspective matching a real construction site boundary.
      `;

    await executeGeneration(complexPrompt, customPrompt); // Pass original prompt for display
  };

  const executeGeneration = async (
    finalPrompt: string,
    displayPrompt: string
  ) => {
    setIsGenerating(true);
    setLoadingMessage("Architecting your vision...");
    try {
      // Uses gemini-3-pro-image-preview internally in services/gemini.ts
      const resultUrl = await generateArchitecturalImage(finalPrompt);
      addPoints(50);

      const newIdea: Idea = {
        id: Date.now().toString(),
        projectId: project.id,
        author: "You",
        prompt: displayPrompt || "Custom Design",
        imageUrl: resultUrl,
        votes: 0,
        comments: [],
        createdAt: new Date().toISOString(),
        type: "image",
      };

      saveIdea(newIdea);
      setIdeas([newIdea, ...ideas]);
      setActiveTab("gallery");
      setCustomPrompt("");
      setSelectedPreset(null);
    } catch (error: any) {
      console.error("Generation failed:", error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      alert(
        `Failed to generate content: ${errorMessage}\n\nNote: Image generation requires a Gemini API key with access to gemini-2.5-flash-image model.`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTour = async (idea: Idea) => {
    if (!idea.imageUrl) return;
    setIsGenerating(true);
    setLoadingMessage(
      "Constructing 3D Fly-through Tour... (This may take a minute)"
    );
    try {
      const videoPrompt =
        "Cinematic 3D drone tour fly-through of this architectural design, smooth motion, high definition, real world physics.";
      const videoUrl = await generateArchitecturalVideo(
        videoPrompt,
        idea.imageUrl.split(",")[1]
      );
      addPoints(100);

      // Update the existing idea with video URL
      const updatedIdea = { ...idea, videoUrl };
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? updatedIdea : i)));
      if (selectedIdea?.id === idea.id) {
        setSelectedIdea(updatedIdea);
      }

      // Also create a separate video entry
      const newVideoIdea: Idea = {
        id: Date.now().toString(),
        projectId: project.id,
        author: "You",
        prompt: `3D Tour: ${idea.prompt}`,
        videoUrl: videoUrl,
        votes: 0,
        comments: [],
        createdAt: new Date().toISOString(),
        type: "video",
      };
      saveIdea(newVideoIdea);
      setIdeas((prev) => [newVideoIdea, ...prev]);
    } catch (error) {
      console.error("Video Gen Failed", error);
      alert("Failed to generate video tour.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReaction = (ideaId: string, emoji: string) => {
    setIdeaReactions((prev) => ({
      ...prev,
      [ideaId]: [...(prev[ideaId] || []), emoji],
    }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-slate-700 bg-slate-800 sticky top-0 z-30 shadow-lg">
        <button
          onClick={onBack}
          className="mr-4 p-2 hover:bg-slate-700 rounded-full transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-sky-400">{project.title}</h2>
          <p className="text-xs text-slate-400 flex items-center">
            <MapIcon className="w-3 h-3 mr-1" />
            {project.location}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth">
        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-20 pt-2">
          <button
            onClick={() => setActiveTab("ideate")}
            className={`pb-2 px-4 flex items-center ${
              activeTab === "ideate"
                ? "border-b-2 border-sky-500 text-sky-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Design Studio
          </button>
          <button
            onClick={() => setActiveTab("site")}
            className={`pb-2 px-4 flex items-center ${
              activeTab === "site"
                ? "border-b-2 border-sky-500 text-sky-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4 mr-2" />
            Site View (Satellite)
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`pb-2 px-4 flex items-center ${
              activeTab === "gallery"
                ? "border-b-2 border-sky-500 text-sky-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4 mr-2" />
            Gallery
          </button>
          <button
            onClick={() => setActiveTab("drawings")}
            className={`pb-2 px-4 flex items-center ${
              activeTab === "drawings"
                ? "border-b-2 border-sky-500 text-sky-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileImage className="w-4 h-4 mr-2" />
            Architect Plans
          </button>
        </div>

        {activeTab === "site" && (
          <div className="space-y-6 h-[70vh]">
            <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden relative group">
              {/* Leaflet Container */}
              <div
                ref={mapContainerRef}
                className="w-full h-full bg-slate-900 relative"
              >
                {mapError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
                    <div className="text-red-400 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      {mapError}
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute top-4 left-4 bg-black/80 backdrop-blur text-white px-4 py-2 rounded-lg font-bold flex items-center border border-white/20 z-[500]">
                <Globe className="w-4 h-4 mr-2 text-sky-400" />
                Live Satellite Feed
              </div>
            </div>
          </div>
        )}

        {activeTab === "ideate" && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Design Controls */}
            <div className="lg:col-span-8 space-y-6">
              {/* Design Input Area */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <PenTool className="w-32 h-32 text-white" />
                </div>

                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />
                  Create New Design
                </h3>

                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe your vision... (e.g., 'A modern library with glass walls and a rooftop garden') or chat with Benny to generate ideas!"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none min-h-32 max-h-64 resize-y transition-all"
                />

                {/* Presets */}
                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center">
                    <Palette className="w-3 h-3 mr-1" /> Style Presets
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DESIGN_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() =>
                          setSelectedPreset(
                            selectedPreset === preset.id ? null : preset.id
                          )
                        }
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          selectedPreset === preset.id
                            ? "bg-sky-600 border-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                            : "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <button
                    onClick={() => setIsBeaverActive(true)}
                    className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center transition-colors"
                  >
                    <Mic className="w-4 h-4 mr-1" /> Ask Benny for ideas
                  </button>

                  <button
                    onClick={handleGenerateClick}
                    disabled={isGenerating}
                    className={`bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-8 py-3 rounded-full font-bold shadow-lg transform transition-all hover:scale-105 flex items-center ${
                      isGenerating ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Wand2 className="w-5 h-5 mr-2" />
                    )}
                    {isGenerating ? "Rendering..." : "Generate Design"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Benny & Context */}
            <div className="lg:col-span-4 space-y-6">
              {/* Benny The Beaver Agent */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 p-6 rounded-2xl flex flex-col items-center justify-center text-center relative group">
                <div className="absolute inset-0 bg-amber-500/5 blur-3xl rounded-full group-hover:bg-amber-500/10 transition-all"></div>
                <div
                  className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center text-6xl shadow-xl border-4 border-amber-400 cursor-pointer transform group-hover:scale-110 transition-transform mb-4 z-10"
                  onClick={() => setIsBeaverActive(true)}
                >
                  🦫
                </div>
                <h3 className="text-amber-400 font-bold mb-1">
                  Benny the Builder
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  "I can help brainstorm ideas! Click me to chat."
                </p>
                <button
                  onClick={() => setIsBeaverActive(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg transition-colors z-10"
                >
                  Open Voice Chat
                </button>
              </div>

              {/* Project Mini Specs */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                  Site Context
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                    <span className="text-slate-500">Zone</span>
                    <span className="text-white font-medium">Educational</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                    <span className="text-slate-500">Max Height</span>
                    <span className="text-white font-medium">22m</span>
                  </div>
                  <div className="text-xs text-slate-500 italic mt-2">
                    "Please respect the marked structural boundaries. Focus on
                    sustainable materials."
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "gallery" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ideas.map((idea) => (
              <div
                key={idea.id}
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-md hover:border-sky-500/50 transition-colors group"
              >
                <div
                  className="relative aspect-video bg-black cursor-pointer"
                  onClick={() => setSelectedIdea(idea)}
                >
                  {idea.type === "image" ? (
                    <img
                      src={idea.imageUrl}
                      alt={idea.prompt}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={idea.videoUrl}
                      className="w-full h-full object-cover"
                      muted
                    />
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIdea(idea);
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-all"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                    {idea.type === "image" && !idea.videoUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateTour(idea);
                        }}
                        disabled={isGenerating}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full font-bold flex items-center shadow-lg text-sm"
                      >
                        <Video className="w-4 h-4 mr-1" />
                        3D Tour
                      </button>
                    )}
                  </div>

                  {/* Video Badge */}
                  {idea.videoUrl && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                      <Video className="w-3 h-3 mr-1" /> Video
                    </div>
                  )}

                  {/* Reactions Display */}
                  {ideaReactions[idea.id]?.length > 0 && (
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      {[...new Set(ideaReactions[idea.id])]
                        .slice(0, 3)
                        .map((emoji, i) => (
                          <span
                            key={i}
                            className="text-lg bg-black/50 rounded-full px-1"
                          >
                            {emoji}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span className="truncate max-w-[150px]">
                      {idea.prompt}
                    </span>
                    <button
                      onClick={() => handleVote(idea.id)}
                      className="flex items-center hover:text-sky-400 group"
                    >
                      <ThumbsUp
                        className={`w-3 h-3 mr-1 ${
                          idea.isLiked ? "text-sky-500 fill-sky-500" : ""
                        } group-hover:scale-125 transition-transform`}
                      />
                      {idea.votes}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "drawings" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-amber-400 mb-2 flex items-center">
                <FileImage className="w-6 h-6 mr-2" />
                Official Architectural Plans
              </h3>
              <p className="text-slate-400 text-sm">
                These are real architectural drawings from professional
                architects working on this project. Use them as reference for
                your designs.
              </p>
            </div>

            {/* Drawings Grid */}
            {project.architecturalDrawings &&
            project.architecturalDrawings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {project.architecturalDrawings.map((drawing) => (
                  <div
                    key={drawing.id}
                    className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-amber-500/50 transition-all group"
                  >
                    <div className="relative aspect-[4/3] bg-slate-900">
                      <img
                        src={drawing.imageUrl}
                        alt={drawing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Type Badge */}
                      <div className="absolute top-3 left-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            drawing.type === "floor_plan"
                              ? "bg-blue-500/90 text-white"
                              : drawing.type === "elevation"
                              ? "bg-green-500/90 text-white"
                              : drawing.type === "section"
                              ? "bg-purple-500/90 text-white"
                              : drawing.type === "perspective"
                              ? "bg-pink-500/90 text-white"
                              : "bg-amber-500/90 text-white"
                          }`}
                        >
                          {drawing.type.replace("_", " ")}
                        </span>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-full transition-all">
                          <Maximize2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-white mb-1">
                        {drawing.title}
                      </h4>
                      <p className="text-sm text-slate-400 flex items-center">
                        <span className="w-2 h-2 bg-amber-400 rounded-full mr-2"></span>
                        {drawing.architect}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                <FileImage className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-400 mb-2">
                  No Drawings Available
                </h4>
                <p className="text-slate-500 text-sm">
                  Architectural plans for this project are coming soon.
                </p>
              </div>
            )}

            {/* Site Plan Section */}
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h4 className="font-bold text-white flex items-center">
                  <MapIcon className="w-4 h-4 mr-2 text-sky-400" />
                  Official Site Plan
                </h4>
              </div>
              <div className="aspect-video relative">
                <img
                  src={project.sitePlanUrl}
                  alt="Site Plan"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center">
          <div className="bg-slate-900 border border-sky-500/50 rounded-2xl p-8 max-w-md text-center shadow-2xl shadow-sky-500/20">
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto"></div>
              <Sparkles className="w-8 h-8 text-sky-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Creating Magic ✨
            </h3>
            <p className="text-slate-400">
              {loadingMessage || "Generating your architectural vision..."}
            </p>
          </div>
        </div>
      )}

      {/* Benny Modal */}
      {isBeaverActive && (
        <BeaverAgent
          projectTitle={project.title}
          onClose={() => setIsBeaverActive(false)}
          onIdeaReady={handleBeaverIdea}
        />
      )}

      {/* Image Lightbox */}
      {selectedIdea && (
        <ImageLightbox
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onGenerateVideo={handleGenerateTour}
          onReact={handleReaction}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
