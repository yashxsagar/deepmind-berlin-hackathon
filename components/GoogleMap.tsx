import React, { useEffect, useRef, useState } from 'react';
import { Project } from '../types';

// Declare google to fix TS errors
declare var google: any;

interface GoogleMapProps {
    projects: Project[];
    selectedProjectId: string | null;
    onMarkerClick: (project: Project) => void;
    className?: string;
    hasError?: boolean;
}

const GoogleMap: React.FC<GoogleMapProps> = ({ projects, selectedProjectId, onMarkerClick, className, hasError }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any | null>(null);
    const markersRef = useRef<any[]>([]);
    const infoWindowRef = useRef<any>(null);

    // Initialize Map
    useEffect(() => {
        // If we have an API error, do not attempt to initialize map
        if (hasError) return;

        if (mapRef.current && !mapInstance) {
            if (typeof google === 'undefined') {
                // Script not loaded yet, wait or let App.tsx handle error
                return;
            }

            try {
                const map = new google.maps.Map(mapRef.current, {
                    center: { lat: 52.5200, lng: 13.4050 }, // Berlin Center
                    zoom: 13,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    streetViewControl: false,
                    styles: [
                        {
                            "featureType": "poi",
                            "elementType": "labels",
                            "stylers": [{ "visibility": "off" }]
                        }
                    ]
                });
                setMapInstance(map);

                // Initialize one shared InfoWindow
                infoWindowRef.current = new google.maps.InfoWindow({
                    maxWidth: 300,
                    pixelOffset: new google.maps.Size(0, -10)
                });

            } catch (e) {
                console.error("Failed to initialize map:", e);
            }
        }
    }, [mapRef, mapInstance, hasError]);

    // Update Markers
    useEffect(() => {
        if (!mapInstance || hasError) return;

        // Clear existing
        markersRef.current.forEach((m: any) => m.setMap(null));
        markersRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        projects.forEach(project => {
            // Use Custom SVG Icon for "Selfmade points"
            const marker = new google.maps.Marker({
                position: { lat: project.coordinates.lat, lng: project.coordinates.lng },
                map: mapInstance,
                title: project.title,
                animation: google.maps.Animation.DROP,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#3B82F6", // Primary Blue
                    fillOpacity: 1,
                    strokeColor: "#FFFFFF",
                    strokeWeight: 2,
                }
            });

            marker.addListener('click', () => {
                // "When pressed give an overview and information"
                // We open an InfoWindow with details + button instead of navigating immediately.

                if (infoWindowRef.current) {
                    const contentString = `
                <div style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 4px;">
                    <h3 style="font-weight: 700; font-size: 16px; margin: 0 0 4px 0; color: #1F2937;">${project.title}</h3>
                    <div style="margin-bottom: 8px;">
                        <span style="background-color: #EFF6FF; color: #2563EB; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${project.status}</span>
                        <span style="color: #6B7280; font-size: 12px; margin-left: 6px;">${project.type}</span>
                    </div>
                    <p style="font-size: 12px; color: #4B5563; margin: 0 0 12px 0; line-height: 1.4;">${project.description}</p>
                    <button id="btn-project-${project.id}" style="
                        width: 100%;
                        background-color: #3B82F6;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    ">
                        Explore Visualization
                    </button>
                </div>
            `;

                    infoWindowRef.current.setContent(contentString);
                    infoWindowRef.current.open(mapInstance, marker);

                    // Wait for DOM ready to attach click listener to the button
                    google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
                        const btn = document.getElementById(`btn-project-${project.id}`);
                        if (btn) {
                            btn.addEventListener('click', () => {
                                infoWindowRef.current.close();
                                onMarkerClick(project);
                            });
                        }
                    });
                }
            });

            markersRef.current.push(marker);
            bounds.extend(marker.getPosition());
        });

        // Only fit bounds if we aren't focused on a single project or if it's the first load
        if (projects.length > 0 && !selectedProjectId) {
            mapInstance.fitBounds(bounds);
            // Adjust zoom after bounds fit to avoid too close zoom
            const listener = google.maps.event.addListener(mapInstance, "idle", () => {
                if (mapInstance.getZoom() > 14) mapInstance.setZoom(14);
                google.maps.event.removeListener(listener);
            });
        }

    }, [projects, mapInstance, onMarkerClick, selectedProjectId, hasError]);

    // Handle Focus
    useEffect(() => {
        if (mapInstance && selectedProjectId && !hasError) {
            const project = projects.find(p => p.id === selectedProjectId);
            if (project) {
                mapInstance.panTo({ lat: project.coordinates.lat, lng: project.coordinates.lng });
                mapInstance.setZoom(16);
            }
        }
    }, [selectedProjectId, mapInstance, projects, hasError]);

    if (hasError) {
        return (
            <div className={`w-full h-full bg-gray-200 flex flex-col items-center justify-center p-4 text-center ${className}`}>
                <div className="w-16 h-16 bg-gray-300 rounded-full mb-3 flex items-center justify-center">
                    <span className="text-2xl">🗺️</span>
                </div>
                <h3 className="font-bold text-gray-700">Map Unavailable</h3>
                <p className="text-sm text-gray-500">Add a valid Google Maps API Key to view the map.</p>
            </div>
        );
    }

    return <div ref={mapRef} className={`w-full h-full ${className}`} />;
};

export default GoogleMap;
