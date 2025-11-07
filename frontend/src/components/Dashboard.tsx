import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAnalyticsSummary, type AnalyticsSummary } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, MessageSquare, Wrench } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export function Dashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const data = await fetchAnalyticsSummary();
      setAnalytics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Make sure the backend server is running on port 3001
            </p>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) return null;

  // Prepare data for charts
  const toolData = Object.entries(analytics.toolUsage.overall)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const taskData = Object.entries(analytics.taskPatterns)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  const projectData = Object.entries(analytics.projectActivity)
    .sort((a, b) => b[1].conversationCount - a[1].conversationCount)
    .slice(0, 8)
    .map(([name, data]) => ({
      name: name.split('-').pop() || name,
      conversations: data.conversationCount,
      messages: data.messageCount
    }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Claude Code Analytics</h1>
        <p className="text-muted-foreground">Insights from your conversation history</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalConversations}</div>
            <p className="text-xs text-muted-foreground">Across {analytics.overview.totalProjects} projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg {analytics.overview.avgMessagesPerConversation} per conversation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tool Uses</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalToolUses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(analytics.toolUsage.overall).length} different tools
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency Insights</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.recommendations.length}</div>
            <p className="text-xs text-muted-foreground">Actionable recommendations</p>
          </CardContent>
        </Card>
      </div>

      {/* Tool Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tool Usage Frequency</CardTitle>
          <CardDescription>Most frequently used Claude Code tools</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={toolData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Workflow Recommendations - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations to Improve Your Workflow</CardTitle>
          <CardDescription>Actionable insights based on your conversation patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analytics.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">
                Keep using Claude Code! Recommendations will appear as patterns emerge.
              </p>
            ) : (
              analytics.recommendations.map((rec, index) => (
                <div key={index} className={`border-l-4 pl-4 ${
                  rec.priority === 'high' ? 'border-red-500' :
                  rec.priority === 'medium' ? 'border-yellow-500' :
                  'border-blue-500'
                }`}>
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-sm">{rec.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{rec.insight}</p>
                  <p className="text-xs text-primary font-medium">💡 {rec.action}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Task Patterns */}
        <Card>
          <CardHeader>
            <CardTitle>Task Patterns</CardTitle>
            <CardDescription>Types of tasks you work on</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Project Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Project Activity</CardTitle>
          <CardDescription>Most active projects</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="conversations" fill="#8b5cf6" name="Conversations" />
              <Bar dataKey="messages" fill="#06b6d4" name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversation Patterns Section */}
      <div className="space-y-2 mt-6">
        <h2 className="text-2xl font-bold">Conversation Patterns</h2>
        <p className="text-muted-foreground">Insights into how you interact with Claude Code</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Prompting Patterns */}
        <Card>
          <CardHeader>
            <CardTitle>Prompting Style</CardTitle>
            <CardDescription>
              Average prompt length: {analytics.promptingPatterns.avgLength} characters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(analytics.promptingPatterns.distribution).map(([key, data]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{key} Prompts</span>
                    <span className="text-muted-foreground">{data.percentage}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${data.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{data.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversation Flows */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation Length</CardTitle>
            <CardDescription>
              Average: {analytics.conversationFlows.avgTurnsPerConversation} turns per conversation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(analytics.conversationFlows.distribution).map(([key, data]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{data.description.split(' - ')[0]}</span>
                    <span className="text-muted-foreground">{data.percentage}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${data.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.description.split(' - ')[1] || data.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tool Sequences */}
      <Card>
        <CardHeader>
          <CardTitle>Common Tool Sequences</CardTitle>
          <CardDescription>Tools frequently used together in sequence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.toolSequences.slice(0, 10).map((seq, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm font-mono">{seq.sequence}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                  {seq.count}x
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Understanding these patterns can help you anticipate your workflow and be more efficient
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
