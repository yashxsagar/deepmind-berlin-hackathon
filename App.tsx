import React, { useState, useEffect } from 'react';
import { ViewState, Project, UserStats } from './types';
import { INITIAL_PROJECTS } from './constants';
import { getUserStats, updateUserStats } from './services/storage';
import MapInterface from './components/MapInterface';
import ProjectDetail from './components/ProjectDetail';
import Leaderboard from './components/Leaderboard';
import { Map, Trophy, User } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.MAP);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [userStats, setUserStats] = useState<UserStats>(getUserStats());

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setView(ViewState.PROJECT_DETAIL);
  };

  const handleBackToMap = () => {
    setSelectedProject(null);
    setView(ViewState.MAP);
  };

  const addPoints = (amount: number) => {
    setUserStats(prev => {
      const newStats = {
        ...prev,
        points: prev.points + amount,
        submissions: prev.submissions + 1
      };
      updateUserStats(newStats); // Persist
      return newStats;
    });
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
      {/* Sidebar / Bottom Nav */}
      <nav className="w-full md:w-20 md:h-full h-16 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-800 fixed bottom-0 md:relative md:left-0 z-50 flex md:flex-col justify-around md:justify-start items-center md:pt-8">
        <button 
          onClick={() => setView(ViewState.MAP)}
          className={`p-3 rounded-xl transition-all ${view === ViewState.MAP && !selectedProject ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/30' : 'text-slate-500 hover:text-sky-400 hover:bg-slate-800'}`}
        >
          <Map className="w-6 h-6" />
          <span className="sr-only">Map</span>
        </button>
        
        <button 
           onClick={() => setView(ViewState.LEADERBOARD)}
           className={`p-3 rounded-xl transition-all md:mt-6 ${view === ViewState.LEADERBOARD ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800'}`}
        >
          <Trophy className="w-6 h-6" />
          <span className="sr-only">Leaderboard</span>
        </button>

        <button 
           className="p-3 rounded-xl transition-all md:mt-6 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
        >
           <User className="w-6 h-6" />
           <span className="sr-only">Profile</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative h-[calc(100vh-64px)] md:h-screen w-full">
        {view === ViewState.MAP && !selectedProject && (
          <MapInterface projects={INITIAL_PROJECTS} onSelectProject={handleProjectSelect} />
        )}

        {view === ViewState.PROJECT_DETAIL && selectedProject && (
          <ProjectDetail 
            project={selectedProject} 
            onBack={handleBackToMap} 
            addPoints={addPoints}
          />
        )}
        
        {view === ViewState.LEADERBOARD && (
          <Leaderboard stats={userStats} />
        )}
      </main>
    </div>
  );
};

export default App;