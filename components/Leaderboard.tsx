import React from 'react';
import { UserStats } from '../types';
import { Trophy, Star, Medal } from 'lucide-react';

interface LeaderboardProps {
  stats: UserStats;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ stats }) => {
  return (
    <div className="p-6 bg-slate-900 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Trophy className="text-yellow-500 mr-3" />
        Community Leaders
      </h2>

      {/* User Stats Card */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-800 rounded-2xl p-6 mb-8 border border-indigo-500/30 shadow-lg">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-slate-400 text-sm uppercase tracking-wider font-semibold">My Rank</h3>
                <div className="text-3xl font-bold text-white mt-1">{stats.rank}</div>
                <div className="text-indigo-400 text-sm mt-1">{stats.points} Points</div>
            </div>
            <div className="p-3 bg-indigo-500/20 rounded-full">
                <Star className="w-8 h-8 text-indigo-400 fill-current" />
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-900/50 p-3 rounded-lg">
                <div className="text-slate-400 text-xs">Contributions</div>
                <div className="text-xl font-semibold text-white">{stats.submissions}</div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-lg">
                <div className="text-slate-400 text-xs">Community Votes</div>
                <div className="text-xl font-semibold text-white">{stats.votesReceived}</div>
            </div>
        </div>
      </div>

      <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className={`font-bold w-8 text-center ${i === 1 ? 'text-yellow-400 text-xl' : i === 2 ? 'text-slate-300 text-lg' : i === 3 ? 'text-amber-600 text-lg' : 'text-slate-500'}`}>
                      {i}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-600 mx-4 overflow-hidden">
                      <img src={`https://picsum.photos/50?random=${i + 10}`} alt="User" />
                  </div>
                  <div className="flex-1">
                      <div className="text-white font-medium">Student_Designer_{i * 23}</div>
                      <div className="text-xs text-slate-400">{1000 - (i * 50)} Points</div>
                  </div>
                  {i === 1 && <Medal className="text-yellow-500 w-6 h-6" />}
              </div>
          ))}
      </div>
    </div>
  );
};

export default Leaderboard;
