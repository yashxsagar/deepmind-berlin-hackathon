export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'Planning' | 'Active' | 'Review' | 'Completed';
  location: string;
  coordinates: { lat: number; lng: number }; 
  boundary: [number, number][]; // New: Polygon coordinates for the construction site
  imageUrl: string;
  sitePlanUrl: string; // New: Government construction plan
  progress: number;    // New: Project progress percentage
  type: 'School' | 'Park' | 'Public Building' | 'Infrastructure';
}

export interface Idea {
  id: string;
  projectId: string;
  author: string;
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  votes: number;
  comments: Comment[];
  createdAt: string; // Changed to string for serialization stability
  type: 'image' | 'video';
  isLiked?: boolean; // Local state for user
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface UserStats {
  rank: string;
  points: number;
  submissions: number;
  votesReceived: number;
  achievements: string[];
}

export enum ViewState {
  MAP = 'MAP',
  PROJECT_DETAIL = 'PROJECT_DETAIL',
  LEADERBOARD = 'LEADERBOARD',
  PROFILE = 'PROFILE'
}