import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { Search, Navigation } from 'lucide-react';
import { searchLocations } from '../services/gemini';

// Declare Leaflet globally since we loaded it via script tag
declare const L: any;

interface MapInterfaceProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

const MapInterface: React.FC<MapInterfaceProps> = ({ projects, onSelectProject }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{title: string, uri: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Strict cleanup logic to handle React strict mode double-mounting and view switching
    if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
    }

    if (mapContainerRef.current) {
        // Initialize map centered on Berlin
        const map = L.map(mapContainerRef.current).setView([52.5100, 13.4000], 12);
        
        // SATELLITE TILES for "Real" site feel (Esri World Imagery)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(map);
        
        // Add label overlay so users know where they are
        L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.{ext}', {
            attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
            subdomains: 'abcd',
            minZoom: 0,
            maxZoom: 20,
            ext: 'png'
        }).addTo(map);

        mapRef.current = map;
        
        // Add markers and polygons
        projects.forEach(project => {
            // Draw the Construction Boundary
            if (project.boundary) {
                L.polygon(project.boundary, {
                    color: project.status === 'Active' ? '#22c55e' : '#0ea5e9', // Green for active, Blue for planning
                    fillColor: project.status === 'Active' ? '#22c55e' : '#0ea5e9',
                    fillOpacity: 0.3,
                    weight: 2,
                    dashArray: '5, 10'
                }).addTo(map);
            }

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${project.status === 'Active' ? '#22c55e' : '#0ea5e9'}; width: 1.5rem; height: 1.5rem; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([project.coordinates.lat, project.coordinates.lng], { icon: icon }).addTo(map);
            
            // Custom popup
            const popupContent = document.createElement('div');
            popupContent.innerHTML = `
                <div style="font-family: 'Inter', sans-serif; color: #0f172a; min-width: 160px;">
                    <img src="${project.imageUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" />
                    <h3 style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${project.title}</h3>
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                         <span style="font-size: 10px; background: #e2e8f0; padding: 2px 6px; border-radius: 10px;">${project.status}</span>
                         <span style="font-size: 10px; margin-left: auto; color: #64748b;">${project.progress}% Funded</span>
                    </div>
                    <button id="btn-${project.id}" style="background-color: #0284c7; color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px; width: 100%;">View Project</button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            
            marker.on('popupopen', () => {
                const btn = document.getElementById(`btn-${project.id}`);
                if (btn) {
                    btn.onclick = () => onSelectProject(project);
                }
            });
        });
    }

    return () => {
        if (mapRef.current) {
           mapRef.current.remove();
           mapRef.current = null;
        }
    };
  }, [projects, onSelectProject]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
        let loc = undefined;
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (mapRef.current) {
                mapRef.current.setView([loc.lat, loc.lng], 14);
            }
        } catch (e) {
            console.warn("Location denied");
        }

        const results = await searchLocations(searchQuery, loc);
        setSearchResults(results);
    } catch (err) {
        console.error("Search failed", err);
    } finally {
        setIsSearching(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#0B1120] overflow-hidden">
      
      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] max-w-md mx-auto">
        <form onSubmit={handleSearch} className="relative shadow-2xl">
            <input 
                type="text" 
                placeholder="Search for Berlin schools..." 
                className="w-full bg-slate-900/90 backdrop-blur-md text-white border border-slate-600 rounded-full py-3 px-12 focus:ring-2 focus:ring-sky-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
            <button type="submit" className="absolute right-2 top-2 bg-sky-600 p-1.5 rounded-full hover:bg-sky-500 transition">
                {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Navigation className="w-4 h-4 text-white" />}
            </button>
        </form>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
            <div className="mt-2 bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-slate-700">
                <div className="p-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Grounding Results</div>
                {searchResults.map((res, i) => (
                    <a key={i} href={res.uri} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-slate-800 text-sm text-sky-300 border-b border-slate-700/50 last:border-0 truncate">
                        {res.title}
                    </a>
                ))}
            </div>
        )}
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} id="map-container" className="absolute inset-0 z-0 h-full w-full outline-none bg-slate-900"></div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-[400] bg-slate-900/90 backdrop-blur p-4 rounded-xl border border-slate-700 text-xs text-slate-300 shadow-xl">
          <div className="flex items-center mb-2"><span className="w-8 h-8 rounded bg-green-500/30 border border-green-500 mr-2 border-dashed"></span> Active Area</div>
          <div className="flex items-center"><span className="w-8 h-8 rounded bg-sky-500/30 border border-sky-500 mr-2 border-dashed"></span> Planned Area</div>
      </div>
    </div>
  );
};

export default MapInterface;