const API_BASE_URL = 'http://localhost:3001/api';
export type AnalyticsSource = 'all' | 'claude' | 'codex' | 'cursor';

export interface AnalyticsSummary {
  overview: {
    totalConversations: number;
    totalSessions: number;
    totalSubagentRuns: number;
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
  timeline: {
    byDay: Array<{
      date: string;
      sessions: number;
      subagentRuns: number;
      totalConversations: number;
      chatMessages: number;
      totalEvents: number;
      toolUses: number;
      cumulativeConversations: number;
      cumulativeSessions: number;
      cumulativeSubagentRuns: number;
      cumulativeChatMessages: number;
      cumulativeTotalEvents: number;
      cumulativeToolUses: number;
    }>;
  };
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

export interface SourceOverviewResponse {
  all: {
    overview: AnalyticsSummary['overview'] | null;
    recommendationCount: number;
    timelineDays: number;
    firstDay: string | null;
    lastDay: string | null;
  };
  sources: Record<Exclude<AnalyticsSource, 'all'>, {
    overview: AnalyticsSummary['overview'] | null;
    recommendationCount: number;
    timelineDays: number;
    firstDay: string | null;
    lastDay: string | null;
  }>;
}

export interface SourceSchema {
  source: AnalyticsSource;
  conversationCount: number;
  messageCount: number;
  conversationFields: Array<{ name: string; count: number }>;
  metadataFields: Array<{ name: string; count: number }>;
  messageFields: Array<{ name: string; count: number }>;
  messageTypes: Array<{ name: string; count: number }>;
  contentShapes: Array<{ name: string; count: number }>;
  contentItemTypes: Array<{ name: string; count: number }>;
  toolNames: Array<{ name: string; count: number }>;
  uniqueConversationFields: string[];
  uniqueMetadataFields: string[];
  uniqueMessageFields: string[];
}

export async function fetchAnalyticsSummary(source: AnalyticsSource = 'all'): Promise<AnalyticsSummary> {
  const response = await fetch(`${API_BASE_URL}/analytics/summary?source=${encodeURIComponent(source)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch analytics summary');
  }
  return response.json();
}

export async function fetchSourceOverviews(): Promise<SourceOverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/analytics/sources`);
  if (!response.ok) {
    throw new Error('Failed to fetch source overviews');
  }
  return response.json();
}

export async function fetchSourceSchema(source: Exclude<AnalyticsSource, 'all'>): Promise<SourceSchema> {
  const response = await fetch(`${API_BASE_URL}/analytics/schema?source=${encodeURIComponent(source)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch source schema');
  }
  return response.json();
}

export async function fetchConversations(source: AnalyticsSource = 'all') {
  const response = await fetch(`${API_BASE_URL}/conversations?source=${encodeURIComponent(source)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

export async function searchConversations(query: string, source: AnalyticsSource = 'all') {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}`);
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
