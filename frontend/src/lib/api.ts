const API_BASE_URL = 'http://localhost:3001/api';

export interface AnalyticsSummary {
  overview: {
    totalConversations: number;
    totalMessages: number;
    totalToolUses: number;
    avgMessagesPerConversation: number;
    totalProjects: number;
  };
  toolUsage: {
    overall: Record<string, number>;
    byProject: Record<string, Record<string, number>>;
  };
  taskPatterns: Record<string, number>;
  projectActivity: Record<string, {
    conversationCount: number;
    messageCount: number;
    firstActivity?: string;
    lastActivity?: string;
  }>;
  recommendations: Array<{
    type: 'efficiency' | 'workflow' | 'prompting';
    title: string;
    insight: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  promptingPatterns: {
    totalPrompts: number;
    avgLength: number;
    distribution: {
      short: { count: number; percentage: number; description: string };
      medium: { count: number; percentage: number; description: string };
      long: { count: number; percentage: number; description: string };
    };
  };
  conversationFlows: {
    avgTurnsPerConversation: number;
    distribution: {
      singleTurn: { count: number; percentage: number; description: string };
      shortConversations: { count: number; percentage: number; description: string };
      mediumConversations: { count: number; percentage: number; description: string };
      longConversations: { count: number; percentage: number; description: string };
    };
  };
  toolSequences: Array<{ sequence: string; count: number }>;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await fetch(`${API_BASE_URL}/analytics/summary`);
  if (!response.ok) {
    throw new Error('Failed to fetch analytics summary');
  }
  return response.json();
}

export async function fetchConversations() {
  const response = await fetch(`${API_BASE_URL}/conversations`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

export async function searchConversations(query: string) {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search conversations');
  }
  return response.json();
}

export async function reloadData() {
  const response = await fetch(`${API_BASE_URL}/reload`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to reload data');
  }
  return response.json();
}
