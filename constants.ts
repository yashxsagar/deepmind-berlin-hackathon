import { Project, UserStats, Idea } from './types';

// Using specific Unsplash IDs for consistent "Berlin-like" architecture
const IMAGES = {
    school1: "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1600&auto=format&fit=crop", // Modern brick
    school2: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop", // Open campus
    school3: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1600&auto=format&fit=crop", // Kids playing
    school4: "https://images.unsplash.com/photo-1596496050844-461ac76b2979?q=80&w=1600&auto=format&fit=crop", // Library
    school5: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1600&auto=format&fit=crop", // Modern classroom
    school6: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop", // Corporate/Modern
    plan: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1600&auto=format&fit=crop", // Blueprints
};

// Helper to create a small polygon around a center point
const createPolygon = (lat: number, lng: number): [number, number][] => {
    const d = 0.002; // Roughly 200m
    return [
        [lat + d, lng - d],
        [lat + d, lng + d],
        [lat - d, lng + d],
        [lat - d, lng - d]
    ];
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Nelson Mandela School Extension',
    description: 'GOVERNMENT AIM: To expand the bilingual campus in Charlottenburg with a sustainable annex. The goal is to create flexible learning spaces that support project-based learning and multicultural exchange.',
    status: 'Active',
    location: 'Charlottenburg-Wilmersdorf, Berlin',
    coordinates: { lat: 52.502, lng: 13.315 },
    boundary: createPolygon(52.502, 13.315),
    imageUrl: IMAGES.school1,
    sitePlanUrl: IMAGES.plan,
    progress: 75,
    type: 'School'
  },
  {
    id: '2',
    title: 'Grundschule am Kollwitzplatz',
    description: 'GOVERNMENT AIM: A complete redesign of the schoolyard in Prenzlauer Berg. The focus is on "Active Breaks" - integrating climbing structures, sensory gardens, and an open-air classroom.',
    status: 'Planning',
    location: 'Prenzlauer Berg, Berlin',
    coordinates: { lat: 52.536, lng: 13.418 },
    boundary: createPolygon(52.536, 13.418),
    imageUrl: IMAGES.school3,
    sitePlanUrl: IMAGES.plan,
    progress: 30,
    type: 'School'
  },
  {
    id: '3',
    title: 'Campus Rütli Integration Center',
    description: 'GOVERNMENT AIM: Building a new community hub in Neukölln. Key requirements include a public library, vocational workshops for teenagers, and a safe, transparent facade.',
    status: 'Review',
    location: 'Neukölln, Berlin',
    coordinates: { lat: 52.486, lng: 13.438 },
    boundary: createPolygon(52.486, 13.438),
    imageUrl: IMAGES.school2,
    sitePlanUrl: IMAGES.plan,
    progress: 90,
    type: 'School'
  },
  {
    id: '4',
    title: 'John F. Kennedy School Library',
    description: 'GOVERNMENT AIM: Modernizing the learning resources center in Zehlendorf. The state aims to digitize the library while creating "Deep Work" pods.',
    status: 'Active',
    location: 'Zehlendorf, Berlin',
    coordinates: { lat: 52.429, lng: 13.262 },
    boundary: createPolygon(52.429, 13.262),
    imageUrl: IMAGES.school4,
    sitePlanUrl: IMAGES.plan,
    progress: 60,
    type: 'School'
  },
  {
    id: '5',
    title: 'Europaschule Gymnasium',
    description: 'GOVERNMENT AIM: Retrofitting the facade for energy efficiency and adding a rooftop solar garden for science classes.',
    status: 'Planning',
    location: 'Lichtenberg, Berlin',
    coordinates: { lat: 52.518, lng: 13.480 },
    boundary: createPolygon(52.518, 13.480),
    imageUrl: IMAGES.school5,
    sitePlanUrl: IMAGES.plan,
    progress: 15,
    type: 'School'
  },
  {
    id: '6',
    title: 'Sophie Scholl Gesamtschule',
    description: 'GOVERNMENT AIM: Creating a safe bike shelter and entry plaza to encourage sustainable commuting among students.',
    status: 'Active',
    location: 'Schöneberg, Berlin',
    coordinates: { lat: 52.490, lng: 13.355 },
    boundary: createPolygon(52.490, 13.355),
    imageUrl: IMAGES.school6,
    sitePlanUrl: IMAGES.plan,
    progress: 45,
    type: 'School'
  }
];

export const INITIAL_USER_STATS: UserStats = {
  rank: 'City Architect',
  points: 350,
  submissions: 12,
  votesReceived: 89,
  achievements: ['Berlin Builder', 'School Hero']
};

export const MOCK_EXISTING_IDEAS: Idea[] = [
    {
        id: 'mock1',
        projectId: '1',
        author: 'Anna S.',
        prompt: 'A glass walkway connecting the old building with the new annex, surrounded by cherry blossom trees.',
        imageUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&q=80&w=800',
        votes: 124,
        comments: [],
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        type: 'image'
    },
    {
        id: 'mock2',
        projectId: '1',
        author: 'Lukas M.',
        prompt: 'Wooden facade with vertical gardens to match the park environment.',
        imageUrl: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&q=80&w=800',
        votes: 89,
        comments: [],
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        type: 'image'
    },
    {
        id: 'mock3',
        projectId: '2',
        author: 'Sophie K.',
        prompt: 'Colorful rubber ground for safety with abstract climbing shapes.',
        imageUrl: 'https://images.unsplash.com/photo-1522008342704-6b265b543028?auto=format&fit=crop&q=80&w=800',
        votes: 45,
        comments: [],
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        type: 'image'
    }
];

export const SAMPLE_COMMENTS = [
  "More trees for the playground please!",
  "Can we make the roof accessible for students?",
  "This fits the Berlin vibe perfectly.",
  "I like the safety features near the street."
];