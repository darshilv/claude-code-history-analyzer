import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchAnalyticsSummary,
  fetchSourceOverviews,
  type AnalyticsSummary,
  type AnalyticsSource,
  type SourceOverviewResponse
} from '@/lib/api';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from 'recharts';

const REFRESH_INTERVAL_MS = 30000;
const SOURCES: Array<Exclude<AnalyticsSource, 'all'>> = ['claude', 'codex', 'cursor'];
const SOURCE_DESCRIPTIONS: Record<Exclude<AnalyticsSource, 'all'>, string> = {
  claude: 'Claude Code local history',
  codex: 'Codex desktop session logs',
  cursor: 'Cursor agent transcripts'
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatTimelineDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    return dateString;
  }
  return DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}

function formatSourceName(source: Exclude<AnalyticsSource, 'all'>) {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

interface SummaryPageProps {
  onOpenSource: (source: Exclude<AnalyticsSource, 'all'>) => void;
}

export function SummaryPage({ onOpenSource }: SummaryPageProps) {
  const [allSummary, setAllSummary] = useState<AnalyticsSummary | null>(null);
  const [sourceOverviews, setSourceOverviews] = useState<SourceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
    const intervalId = window.setInterval(() => loadSummary(false), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadSummary(showLoadingState = true) {
    try {
      if (showLoadingState) {
        setLoading(true);
      }

      const [summaryData, overviewsData] = await Promise.all([
        fetchAnalyticsSummary('all'),
        fetchSourceOverviews()
      ]);

      setAllSummary(summaryData);
      setSourceOverviews(overviewsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics summary');
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (error || !allSummary || !sourceOverviews) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[460px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error || 'Summary unavailable'}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => loadSummary()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timelineData = allSummary.timeline.byDay.map(point => ({
    ...point,
    label: formatTimelineDate(point.date)
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">AI Coding Assistant Analytics</h1>
        <p className="text-muted-foreground">Cross-tool summary before diving into source-specific details</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversation Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allSummary.overview.totalConversations}</div>
            <p className="text-xs text-muted-foreground">
              {allSummary.overview.totalSessions} sessions + {allSummary.overview.totalSubagentRuns} subagent runs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allSummary.overview.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg {allSummary.overview.avgMessagesPerConversation} per conversation file
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tool Uses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allSummary.overview.totalToolUses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all connected sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allSummary.overview.totalProjects}</div>
            <p className="text-xs text-muted-foreground">Active codebases represented</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Combined Timeline</CardTitle>
          <CardDescription>Daily progression across Claude, Codex, and Cursor</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip labelFormatter={(value, payload) => payload?.[0]?.payload?.date || String(value)} />
              <Legend />
              <Bar yAxisId="left" dataKey="sessions" stackId="count" fill="#3b82f6" name="Sessions" />
              <Bar yAxisId="left" dataKey="subagentRuns" stackId="count" fill="#06b6d4" name="Subagent Runs" />
              <Line yAxisId="right" type="monotone" dataKey="chatMessages" stroke="#f59e0b" strokeWidth={2} dot={false} name="Chat Messages" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {SOURCES.map(source => {
          const data = sourceOverviews.sources[source];
          return (
            <Card key={source}>
              <CardHeader>
                <CardTitle>{formatSourceName(source)}</CardTitle>
                <CardDescription>{SOURCE_DESCRIPTIONS[source]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-bold">{data.overview?.totalConversations ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Conversation files</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {data.firstDay && data.lastDay
                    ? `${data.firstDay} to ${data.lastDay}`
                    : 'No timeline data yet'}
                </div>
                <button
                  onClick={() => onOpenSource(source)}
                  className="w-full px-3 py-2 rounded-md border hover:bg-secondary transition-colors text-sm"
                >
                  Open {formatSourceName(source)} Details
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
