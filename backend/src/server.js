import express from 'express';
import cors from 'cors';
import parser from './parsers/jsonl-parser.js';
import analyzer from './analyzers/conversation-analyzer.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Cache for conversations (reload on startup or manually)
let cachedConversations = null;
let cachedAnalytics = null;
let lastLoadTime = null;

/**
 * Load all conversations into memory
 */
function loadConversations() {
  console.log('Loading conversations...');
  const startTime = Date.now();

  cachedConversations = parser.getAllConversations();
  cachedAnalytics = analyzer.generateSummary(cachedConversations);
  lastLoadTime = new Date().toISOString();

  const loadTime = Date.now() - startTime;
  console.log(`Loaded ${cachedConversations.length} conversations in ${loadTime}ms`);

  return cachedConversations;
}

// Load conversations on startup
loadConversations();

// API Routes

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    conversationsLoaded: cachedConversations?.length || 0,
    lastLoadTime
  });
});

/**
 * GET /api/analytics/summary
 * Get overall analytics summary
 */
app.get('/api/analytics/summary', (req, res) => {
  if (!cachedAnalytics) {
    return res.status(503).json({ error: 'Analytics not ready' });
  }

  res.json(cachedAnalytics);
});

/**
 * GET /api/analytics/tools
 * Get tool usage statistics
 */
app.get('/api/analytics/tools', (req, res) => {
  if (!cachedConversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const toolUsage = analyzer.analyzeToolUsage(cachedConversations);
  res.json(toolUsage);
});

/**
 * GET /api/analytics/tasks
 * Get task pattern analysis
 */
app.get('/api/analytics/tasks', (req, res) => {
  if (!cachedConversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const taskPatterns = analyzer.analyzeTaskPatterns(cachedConversations);
  res.json(taskPatterns);
});

/**
 * GET /api/analytics/projects
 * Get project activity statistics
 */
app.get('/api/analytics/projects', (req, res) => {
  if (!cachedConversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const projectActivity = analyzer.analyzeProjectActivity(cachedConversations);
  res.json(projectActivity);
});

/**
 * GET /api/analytics/metrics
 * Get conversation metrics
 */
app.get('/api/analytics/metrics', (req, res) => {
  if (!cachedConversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const metrics = analyzer.analyzeConversationMetrics(cachedConversations);
  res.json(metrics);
});

/**
 * GET /api/conversations
 * List all conversations with basic info
 */
app.get('/api/conversations', (req, res) => {
  if (!cachedConversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  // Return lightweight conversation list
  const conversationList = cachedConversations.map(conv => ({
    conversationId: conv.conversationId,
    project: conv.project,
    messageCount: conv.messages.length,
    firstMessage: conv.messages[0]?.timestamp,
    lastMessage: conv.messages[conv.messages.length - 1]?.timestamp
  }));

  res.json(conversationList);
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with full details
 */
app.get('/api/conversations/:id', (req, res) => {
  const { id } = req.params;

  const conversation = cachedConversations?.find(conv => conv.conversationId === id);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json(conversation);
});

/**
 * GET /api/history
 * Get conversation history from history.jsonl
 */
app.get('/api/history', (req, res) => {
  const history = parser.getHistory();
  res.json(history);
});

/**
 * POST /api/reload
 * Reload conversations from disk
 */
app.post('/api/reload', (req, res) => {
  try {
    loadConversations();
    res.json({
      success: true,
      conversationsLoaded: cachedConversations.length,
      lastLoadTime
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search
 * Search conversations by keyword
 */
app.get('/api/search', (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  if (!cachedConversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const query = q.toLowerCase();
  const results = [];

  cachedConversations.forEach(conv => {
    const matchingMessages = conv.messages.filter(msg => {
      const content = msg.message?.content;
      if (typeof content === 'string') {
        return content.toLowerCase().includes(query);
      }
      return false;
    });

    if (matchingMessages.length > 0) {
      results.push({
        conversationId: conv.conversationId,
        project: conv.project,
        matches: matchingMessages.length,
        preview: matchingMessages[0].message.content.substring(0, 200)
      });
    }
  });

  res.json({
    query: q,
    resultsCount: results.length,
    results: results.slice(0, 50) // Limit to 50 results
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude Analytics API running on http://localhost:${PORT}`);
  console.log(`Loaded ${cachedConversations?.length || 0} conversations`);
});
