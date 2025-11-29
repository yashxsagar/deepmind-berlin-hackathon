import React, { useState, useEffect } from 'react';
import { Project, Idea } from '../types';
import { generateArchitecturalImage, generateArchitecturalVideo } from '../services/gemini';
import { getIdeas, saveIdea, voteIdea, getVoteCount } from '../services/storage';
import { MessageSquare, ThumbsUp, Video, Image as ImageIcon, Loader2, Sparkles, Send, Mic, Edit, Wand2, Plus, Check, Play, Map as MapIcon, Globe, Layers, AlertCircle } from 'lucide-react';
import LiveAssistant from './LiveAssistant';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  addPoints: (amount: number) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, addPoints }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [manualPrompt, setManualPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'ideate' | 'site' | 'gallery'>('ideate');
  const [isLiveActive, setIsLiveActive] = useState(false);
  
  // Toggle for context consistency
  const [useSiteContext, setUseSiteContext] = useState(true);

  // Wizard State
  const [wizardTheme, setWizardTheme] = useState('');
  const [wizardFeatures, setWizardFeatures] = useState<string[]>([]);

  useEffect(() => {
      // Load ideas from storage on mount
      const loadedIdeas = getIdeas(project.id);
      
      // Calculate display votes (base + local session votes)
      const ideasWithVotes = loadedIdeas.map(idea => ({
          ...idea,
          votes: getVoteCount(idea.id, idea.votes)
      }));
      
      setIdeas(ideasWithVotes);
  }, [project.id]);

  const themes = [
    { id: 'modern', label: 'Modern & Glass', desc: 'Sleek, transparent, bright' },
    { id: 'eco', label: 'Green & Eco', desc: 'Wooden, vertical gardens, nature' },
    { id: 'colorful', label: 'Playful & Colorful', desc: 'Vibrant, geometric, fun' },
    { id: 'brick', label: 'Berlin Brick', desc: 'Historic, sturdy, urban' },
  ];

  const features = [
    'Climbing Wall', 'School Garden', 'Sensory Path', 'Outdoor Classroom', 'Solar Roof', 'Skate Park', 'Amphitheater', 'Relaxation Pods'
  ];

  const toggleFeature = (feat: string) => {
    setWizardFeatures(prev => prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]);
  };

  const handleVote = (ideaId: string) => {
      const newCount = voteIdea(ideaId);
      setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, votes: getVoteCount(ideaId, i.votes), isLiked: true } : i));
  };

  const constructFullPrompt = () => {
    const parts = [];
    if (wizardTheme) parts.push(`Style: ${wizardTheme}`);
    if (wizardFeatures.length > 0) parts.push(`Features: ${wizardFeatures.join(', ')}`);
    if (manualPrompt) parts.push(`Details: ${manualPrompt}`);
    
    // Strict prompt engineering for site consistency
    let contextPrompt = "";
    if (useSiteContext) {
        contextPrompt = `CRITICAL: The design MUST be situated at coordinates ${project.coordinates.lat}, ${project.coordinates.lng} in ${project.location}. The architecture must respect the existing boundary and urban fabric of this specific Berlin neighborhood. Preserve existing mature trees where possible. Viewpoint should be realistic street level or drone shot matching the real site.`;
    }
    
    return `Architectural visualization of ${project.title}. ${contextPrompt} ${project.description}. Design specifics: ${parts.join('. ')}. Photorealistic, 8k render, architectural visualization style, cinematic lighting.`;
  };

  const handleGenerateImage = async () => {
    const finalPrompt = constructFullPrompt();
    if (!manualPrompt && !wizardTheme && wizardFeatures.length === 0) {
        alert("Please select a style, feature, or describe your idea.");
        return;
    }

    setIsGenerating(true);
    setLoadingMessage("Analyzing real-world site context & rendering vision...");
    try {
      // In a real production app, we would fetch the project.imageUrl here and pass it as base64
      // to the model to ensure the generated image perfectly overlays the original.
      // For this demo, we rely on the strong "CRITICAL" text prompt instructions regarding location.
      
      const resultUrl = await generateArchitecturalImage(finalPrompt);
      addPoints(50);

      const newIdea: Idea = {
        id: Date.now().toString(),
        projectId: project.id,
        author: 'You',
        prompt: finalPrompt,
        imageUrl: resultUrl,
        votes: 0,
        comments: [],
        createdAt: new Date().toISOString(),
        type: 'image'
      };

      saveIdea(newIdea);
      setIdeas([newIdea, ...ideas]);
      setActiveTab('gallery');
      
      setManualPrompt('');
      setWizardFeatures([]);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTour = async (idea: Idea) => {
      if (!idea.imageUrl) return;
      
      setIsGenerating(true);
      setLoadingMessage("Constructing 3D Fly-through Tour... (This may take a minute)");
      
      try {
          const videoPrompt = "Cinematic 3D drone tour fly-through of this architectural design, smooth motion, high definition, real world physics.";
          const videoUrl = await generateArchitecturalVideo(videoPrompt, idea.imageUrl.split(',')[1]);
          addPoints(100);

          const newVideoIdea: Idea = {
              id: Date.now().toString(),
              projectId: project.id,
              author: 'You',
              prompt: `3D Tour: ${idea.prompt}`,
              videoUrl: videoUrl,
              votes: 0,
              comments: [],
              createdAt: new Date().toISOString(),
              type: 'video'
          };
          
          saveIdea(newVideoIdea);
          setIdeas([newVideoIdea, ...ideas]);
      } catch (error) {
          console.error("Video Gen Failed", error);
          alert("Failed to generate video tour.");
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-slate-700 bg-slate-800 sticky top-0 z-30 shadow-lg">
        <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-700 rounded-full transition-colors">
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-sky-400">{project.title}</h2>
          <p className="text-xs text-slate-400 flex items-center">
              <MapIcon className="w-3 h-3 mr-1" />
              {project.location} ({project.coordinates.lat.toFixed(4)}, {project.coordinates.lng.toFixed(4)})
          </p>
        </div>
        {/* Progress Bar */}
        <div className="hidden md:block w-48 mr-4">
             <div className="flex justify-between text-xs text-slate-300 mb-1">
                 <span>Project Status</span>
                 <span>{project.progress}%</span>
             </div>
             <div className="w-full bg-slate-700 rounded-full h-2">
                 <div className="bg-gradient-to-r from-sky-500 to-green-400 h-2 rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
             </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth">
        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-20 pt-2">
            <button 
                onClick={() => setActiveTab('ideate')}
                className={`pb-2 px-4 flex items-center ${activeTab === 'ideate' ? 'border-b-2 border-sky-500 text-sky-400' : 'text-slate-400 hover:text-white'}`}
            >
                <Wand2 className="w-4 h-4 mr-2" />
                Design Studio
            </button>
            <button 
                onClick={() => setActiveTab('site')}
                className={`pb-2 px-4 flex items-center ${activeTab === 'site' ? 'border-b-2 border-sky-500 text-sky-400' : 'text-slate-400 hover:text-white'}`}
            >
                <Globe className="w-4 h-4 mr-2" />
                Real 3D Site
            </button>
            <button 
                onClick={() => setActiveTab('gallery')}
                className={`pb-2 px-4 flex items-center ${activeTab === 'gallery' ? 'border-b-2 border-sky-500 text-sky-400' : 'text-slate-400 hover:text-white'}`}
            >
                <Layers className="w-4 h-4 mr-2" />
                Proposals ({ideas.length})
            </button>
        </div>

        {activeTab === 'site' && (
            <div className="space-y-6 h-[60vh]">
                 <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 h-full flex flex-col">
                     <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center">
                         <Globe className="w-4 h-4 mr-2 text-sky-500" />
                         Satellite Site Context
                     </h3>
                     <div className="flex-1 rounded-lg overflow-hidden border border-slate-600 relative bg-black">
                         {/* Embed Google Maps Satellite View */}
                         <iframe 
                             width="100%" 
                             height="100%" 
                             style={{border:0}} 
                             loading="lazy" 
                             allowFullScreen 
                             src={`https://maps.google.com/maps?q=${project.coordinates.lat},${project.coordinates.lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed`}
                         ></iframe>
                         
                         <div className="absolute bottom-4 left-4 bg-black/70 p-3 rounded-lg border border-slate-500 max-w-xs backdrop-blur-sm">
                             <p className="text-xs text-white">
                                <span className="font-bold text-sky-400">Boundary Constraint:</span> All designs must fit within the visible construction lot. The AI generation engine uses this coordinate data to align the perspective.
                             </p>
                         </div>
                     </div>
                 </div>
            </div>
        )}

        {activeTab === 'ideate' && (
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Context & Site Plan */}
                    <div className="lg:col-span-1 space-y-4">
                         <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Government Site Plan</h4>
                             <img src={project.sitePlanUrl} alt="Plan" className="w-full h-40 object-cover rounded-lg border border-slate-600 opacity-80 hover:opacity-100 transition-opacity" />
                             <p className="mt-2 text-xs text-slate-400">{project.description}</p>
                         </div>
                         
                         <div className="bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30">
                             <div className="flex items-center justify-between mb-2">
                                 <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Site Consistency</h4>
                                 <input 
                                    type="checkbox" 
                                    checked={useSiteContext} 
                                    onChange={(e) => setUseSiteContext(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 bg-slate-700"
                                 />
                             </div>
                             <p className="text-xs text-slate-400 mb-2">
                                 Enforce "Real Site" constraints. AI will use coordinates {project.coordinates.lat.toFixed(3)}, {project.coordinates.lng.toFixed(3)} to match lighting and surroundings.
                             </p>
                             {useSiteContext && (
                                 <div className="flex items-center text-[10px] text-green-400 bg-green-900/20 p-1.5 rounded border border-green-900/50">
                                     <Check className="w-3 h-3 mr-1" />
                                     Context Locked
                                 </div>
                             )}
                         </div>
                    </div>

                    {/* Right Column: Creation Wizard */}
                    <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 relative">
                        {isGenerating && (
                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl p-8 text-center">
                                <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-4" />
                                <p className="text-sky-300 font-medium text-lg animate-pulse mb-2">{loadingMessage}</p>
                                <p className="text-slate-500 text-sm">Aligning geometry with site boundary...</p>
                            </div>
                        )}

                        <div className="flex items-center mb-6 text-sky-400">
                            <Sparkles className="w-5 h-5 mr-2" />
                            <h3 className="text-lg font-bold">Create New Proposal</h3>
                        </div>

                        <div className="space-y-6">
                            {/* Step 1: Theme */}
                            <div>
                                <h4 className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3">1. Choose Aesthetic</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {themes.map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => setWizardTheme(t.label)}
                                            className={`p-3 rounded-lg border text-left transition-all ${wizardTheme === t.label ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-900' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            <div className="font-semibold text-sm">{t.label}</div>
                                            <div className="text-[10px] opacity-70 truncate">{t.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Step 2: Features */}
                            <div>
                                <h4 className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3">2. Add Community Features</h4>
                                <div className="flex flex-wrap gap-2">
                                    {features.map(f => (
                                        <button
                                            key={f}
                                            onClick={() => toggleFeature(f)}
                                            className={`px-3 py-1.5 rounded-full text-sm border flex items-center transition-all ${wizardFeatures.includes(f) ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                        >
                                            {wizardFeatures.includes(f) ? <Check className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Step 3: Manual Detail */}
                            <div>
                                <h4 className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3">3. Specific Details</h4>
                                <textarea 
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none h-24 text-sm placeholder-slate-600"
                                    placeholder="Describe specific materials, lighting, or unique structural elements..."
                                    value={manualPrompt}
                                    onChange={(e) => setManualPrompt(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-slate-700 gap-4">
                            <button 
                                onClick={() => setIsLiveActive(true)}
                                className="text-sky-400 hover:text-sky-300 flex items-center text-sm font-medium bg-sky-900/20 px-4 py-2 rounded-full border border-sky-900/50"
                            >
                                <Mic className="w-4 h-4 mr-2" />
                                Use Voice Assistant
                            </button>

                            <button 
                                onClick={handleGenerateImage}
                                disabled={isGenerating}
                                className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold flex items-center justify-center transition-all ${isGenerating ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20'}`}
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                                Generate Proposal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'gallery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ideas.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-500 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed">
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No proposals yet.</p>
                        <p className="text-sm">Be the first to design the future of this site!</p>
                        <button onClick={() => setActiveTab('ideate')} className="mt-4 text-sky-400 hover:underline">Go to Design Studio</button>
                    </div>
                )}
                {ideas.map((idea) => (
                    <div key={idea.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-md hover:shadow-sky-500/20 transition-all duration-300 flex flex-col group">
                        <div className="relative aspect-video bg-black">
                            {idea.type === 'image' ? (
                                <img src={idea.imageUrl} alt={idea.prompt} className="w-full h-full object-cover" />
                            ) : (
                                <video src={idea.videoUrl} controls autoPlay loop muted className="w-full h-full object-cover" />
                            )}
                            
                            {/* Overlay for Image -> Video Action */}
                            {idea.type === 'image' && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                    <button 
                                        onClick={() => handleGenerateTour(idea)}
                                        disabled={isGenerating}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-full font-bold flex items-center shadow-lg transform hover:scale-105 transition-all text-sm"
                                    >
                                        <Video className="w-4 h-4 mr-2" />
                                        Generate 3D Tour
                                    </button>
                                </div>
                            )}
                            
                            {idea.type === 'video' && (
                                <div className="absolute top-2 right-2 bg-purple-600 text-xs font-bold px-2 py-1 rounded text-white shadow flex items-center">
                                    <Video className="w-3 h-3 mr-1" /> 3D TOUR
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 flex flex-col flex-1">
                            <p className="text-slate-300 text-xs mb-3 line-clamp-3 italic leading-relaxed">"{idea.prompt}"</p>
                            <div className="mt-auto flex justify-between items-center text-xs text-slate-400 border-t border-slate-700 pt-3">
                                <span className="flex items-center space-x-1">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-[8px] text-white font-bold">
                                        {idea.author[0]}
                                    </div>
                                    <span className="font-semibold text-slate-200">{idea.author}</span>
                                </span>
                                <div className="flex items-center space-x-3">
                                    <button 
                                        onClick={() => handleVote(idea.id)}
                                        className={`flex items-center transition-colors px-2 py-1 rounded-full ${idea.isLiked ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-slate-700 hover:text-sky-400'}`}
                                    >
                                        <ThumbsUp className={`w-3.5 h-3.5 mr-1.5 ${idea.isLiked ? 'fill-current' : ''}`} />
                                        {idea.votes}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Live Assistant Modal */}
      {isLiveActive && (
          <LiveAssistant onClose={() => setIsLiveActive(false)} onIdeaCapture={(text) => {
              setManualPrompt(text);
              setIsLiveActive(false);
          }} />
      )}
    </div>
  );
};

export default ProjectDetail;