import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { Search, Navigation } from 'lucide-react';
import { searchLocations } from '../services/gemini';
import GoogleMap from './GoogleMap';

interface MapInterfaceProps {
    projects: Project[];
    onSelectProject: (project: Project) => void;
}

const MapInterface: React.FC<MapInterfaceProps> = ({ projects, onSelectProject }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ title: string, uri: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mapError, setMapError] = useState(false);

    useEffect(() => {
        const handleAuthFailure = () => setMapError(true);
        window.addEventListener('gm_authFailure', handleAuthFailure);
        return () => window.removeEventListener('gm_authFailure', handleAuthFailure);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const results = await searchLocations(searchQuery);
            setSearchResults(results);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="relative w-full h-full bg-slate-50 overflow-hidden">

            {/* Search Bar */}
            <div className="absolute top-4 left-4 right-4 z-[400] max-w-md mx-auto">
                <form onSubmit={handleSearch} className="relative shadow-xl">
                    <input
                        type="text"
                        placeholder="Search Berlin..."
                        className="w-full bg-white text-slate-800 border-2 border-slate-200 rounded-full py-3 px-12 focus:ring-4 focus:ring-sky-500/20 outline-none font-medium shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                    <button type="submit" className="absolute right-2 top-2 bg-slate-900 p-1.5 rounded-full hover:bg-slate-700 transition">
                        {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Navigation className="w-4 h-4 text-white" />}
                    </button>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="mt-2 bg-white rounded-xl shadow-xl overflow-hidden border border-slate-100 relative z-[500]">
                        <div className="p-2 text-xs text-slate-400 font-bold uppercase tracking-wider bg-slate-50">Results</div>
                        {searchResults.map((res, i) => (
                            <a key={i} href={res.uri} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-slate-50 text-sm text-sky-600 border-b border-slate-100 last:border-0 truncate font-medium">
                                {res.title}
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* Map Container */}
            <div id="map-container" className="absolute inset-0 z-0 h-full w-full outline-none bg-slate-100">
                <GoogleMap
                    projects={projects}
                    selectedProjectId={null}
                    onMarkerClick={onSelectProject}
                    hasError={mapError}
                />
            </div>
        </div>
    );
};

export default MapInterface;