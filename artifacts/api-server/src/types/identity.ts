export interface IdentityProfile {
  userId: string;
  archetypes: string[];
  strengths: string[];
  growthEdges: string[];
  coreValues: string[];
  lastUpdatedAt: string;
}

export interface IdentityMilestone {
  id: string;
  userId: string;
  title: string;
  description: string;
  achievedAt: string;
}
