import { Project, Idea, UserStats } from '../types';
import { INITIAL_PROJECTS, INITIAL_USER_STATS, MOCK_EXISTING_IDEAS } from '../constants';

const STORAGE_KEYS = {
  IDEAS: 'civicscape_ideas',
  STATS: 'civicscape_stats',
  VOTES: 'civicscape_votes'
};

export const getProjects = (): Project[] => {
  return INITIAL_PROJECTS;
};

export const getIdeas = (projectId: string): Idea[] => {
  // Load saved ideas
  const saved = localStorage.getItem(STORAGE_KEYS.IDEAS);
  let allIdeas: Idea[] = saved ? JSON.parse(saved) : [];
  
  // If no saved ideas exist for this project, checking if we should add mock ones
  // In a real app we'd just query DB. Here we merge Mock + Saved.
  // We filter to ensure we don't duplicate mocks if they were already "saved" (not doing complex dedup here for simplicity)
  
  const projectIdeas = allIdeas.filter(i => i.projectId === projectId);
  const mockIdeas = MOCK_EXISTING_IDEAS.filter(i => i.projectId === projectId);
  
  // Combine: If we have saved ideas, use them. If we have none in storage for this project, show mocks.
  // Better approach: Return mocks + saved items that match project ID
  
  return [...mockIdeas, ...projectIdeas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveIdea = (idea: Idea) => {
  const saved = localStorage.getItem(STORAGE_KEYS.IDEAS);
  const ideas: Idea[] = saved ? JSON.parse(saved) : [];
  ideas.push(idea);
  localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(ideas));
};

export const voteIdea = (ideaId: string): number => {
  // Retrieve all ideas (we need to update the mock ones in memory concept or just track votes separately)
  // For simplicity, we will track votes in a separate object map to overlay on top of ideas
  const votesData = localStorage.getItem(STORAGE_KEYS.VOTES);
  const votes: Record<string, number> = votesData ? JSON.parse(votesData) : {};
  
  const currentVotes = votes[ideaId] || 0;
  votes[ideaId] = currentVotes + 1;
  
  localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
  return votes[ideaId];
};

export const getVoteCount = (ideaId: string, baseVotes: number): number => {
  const votesData = localStorage.getItem(STORAGE_KEYS.VOTES);
  const votes: Record<string, number> = votesData ? JSON.parse(votesData) : {};
  return baseVotes + (votes[ideaId] || 0);
};

export const getUserStats = (): UserStats => {
  const saved = localStorage.getItem(STORAGE_KEYS.STATS);
  return saved ? JSON.parse(saved) : INITIAL_USER_STATS;
};

export const updateUserStats = (newStats: UserStats) => {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(newStats));
};
