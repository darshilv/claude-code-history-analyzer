import express from 'express';
import cors from 'cors';
import parser from './parsers/jsonl-parser.js';
import analyzer from './analyzers/conversation-analyzer.js';

const app = express();
const PORT = 3001;
const SOURCES = ['claude', 'codex', 'cursor'];

// Middleware
app.use(cors());
app.use(express.json());

// Cache for conversations (reload on startup or manually)
let cachedConversations = [];
let cachedConversationsBySource = {};
let cachedAnalytics = null;
let cachedAnalyticsBySource = {};
let cachedSchemaAll = null;
let cachedSchemaBySource = {};
let cachedFingerprint = null;
let lastLoadTime = null;

/**
 * Load all conversations into memory
 */
function loadConversations({ force = false } = {}) {
  const currentFingerprint = parser.getConversationsFingerprint();

  if (!force && cachedConversations && cachedFingerprint === currentFingerprint) {
    return false;
  }

  console.log('Loading conversations...');
  const startTime = Date.now();

  cachedConversationsBySource = parser.getAllConversationsBySource();
  cachedConversations = SOURCES.flatMap(source => cachedConversationsBySource[source] || []);
  cachedAnalyticsBySource = SOURCES.reduce((acc, source) => {
    acc[source] = analyzer.generateSummary(cachedConversationsBySource[source] || []);
    return acc;
  }, {});
  cachedAnalytics = analyzer.generateSummary(cachedConversations);
  const schemaSnapshot = buildSchemaSnapshot(cachedConversationsBySource, cachedConversations);
  cachedSchemaBySource = schemaSnapshot.bySource;
  cachedSchemaAll = schemaSnapshot.all;
  cachedFingerprint = currentFingerprint;
  lastLoadTime = new Date().toISOString();

  const loadTime = Date.now() - startTime;
  console.log(`Loaded ${cachedConversations.length} conversations in ${loadTime}ms`);

  return true;
}

function normalizeSource(source) {
  if (!source || source === 'all') {
    return 'all';
  }
  return source.toLowerCase();
}

function getConversationsForSource(source) {
  if (source === 'all') {
    return cachedConversations;
  }
  return cachedConversationsBySource[source] || [];
}

function getAnalyticsForSource(source) {
  if (source === 'all') {
    return cachedAnalytics;
  }
  return cachedAnalyticsBySource[source] || null;
}

function getSchemaForSource(source) {
  if (source === 'all') {
    return cachedSchemaAll;
  }
  return cachedSchemaBySource[source] || null;
}

function incrementCount(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function sortCountMap(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function createSourceSchema(source, conversations) {
  const conversationFieldCounts = {};
  const metadataFieldCounts = {};
  const messageFieldCounts = {};
  const messageTypeCounts = {};
  const contentShapeCounts = {};
  const contentItemTypeCounts = {};
  const toolNameCounts = {};

  let messageCount = 0;

  conversations.forEach(conv => {
    Object.keys(conv).forEach(field => incrementCount(conversationFieldCounts, field));

    if (conv.metadata && typeof conv.metadata === 'object' && !Array.isArray(conv.metadata)) {
      Object.keys(conv.metadata).forEach(field => incrementCount(metadataFieldCounts, field));
    }

    conv.messages.forEach(msg => {
      messageCount++;
      Object.keys(msg).forEach(field => incrementCount(messageFieldCounts, field));
      incrementCount(messageTypeCounts, msg.type || 'unknown');

      const content = msg.message?.content;
      if (typeof content === 'string') {
        incrementCount(contentShapeCounts, 'string');
      } else if (Array.isArray(content)) {
        incrementCount(contentShapeCounts, 'array');
        content.forEach(item => {
          if (item && typeof item === 'object') {
            if (item.type) {
              incrementCount(contentItemTypeCounts, item.type);
            }
            if (item.type === 'tool_use' && item.name) {
              incrementCount(toolNameCounts, item.name);
            }
          }
        });
      } else if (content === null || content === undefined) {
        incrementCount(contentShapeCounts, 'nullish');
      } else {
        incrementCount(contentShapeCounts, 'object');
      }
    });
  });

  return {
    source,
    conversationCount: conversations.length,
    messageCount,
    conversationFields: sortCountMap(conversationFieldCounts),
    metadataFields: sortCountMap(metadataFieldCounts),
    messageFields: sortCountMap(messageFieldCounts),
    messageTypes: sortCountMap(messageTypeCounts),
    contentShapes: sortCountMap(contentShapeCounts),
    contentItemTypes: sortCountMap(contentItemTypeCounts),
    toolNames: sortCountMap(toolNameCounts),
    uniqueConversationFields: [],
    uniqueMetadataFields: [],
    uniqueMessageFields: []
  };
}

function createUniqueFieldList(rawBySource, source, selector) {
  const ownFields = new Set(selector(rawBySource[source]).map(item => item.name));
  const otherFields = new Set(
    SOURCES
      .filter(otherSource => otherSource !== source)
      .flatMap(otherSource => selector(rawBySource[otherSource]).map(item => item.name))
  );

  return Array.from(ownFields)
    .filter(field => !otherFields.has(field))
    .sort();
}

function buildSchemaSnapshot(conversationsBySource, allConversations) {
  const rawBySource = SOURCES.reduce((acc, source) => {
    acc[source] = createSourceSchema(source, conversationsBySource[source] || []);
    return acc;
  }, {});

  SOURCES.forEach(source => {
    rawBySource[source].uniqueConversationFields = createUniqueFieldList(rawBySource, source, schema => schema.conversationFields);
    rawBySource[source].uniqueMetadataFields = createUniqueFieldList(rawBySource, source, schema => schema.metadataFields);
    rawBySource[source].uniqueMessageFields = createUniqueFieldList(rawBySource, source, schema => schema.messageFields);
  });

  const allSchema = createSourceSchema('all', allConversations || []);
  allSchema.uniqueConversationFields = [];
  allSchema.uniqueMetadataFields = [];
  allSchema.uniqueMessageFields = [];

  return {
    bySource: rawBySource,
    all: allSchema
  };
}

function extractMessageTextForSearch(msg) {
  const content = msg.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item?.text === 'string') {
        return item.text;
      }
      if (typeof item?.input_text === 'string') {
        return item.input_text;
      }
      if (typeof item?.output_text === 'string') {
        return item.output_text;
      }
      return '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

function ensureConversationDataFresh(req, res, next) {
  try {
    loadConversations();
    next();
  } catch (error) {
    console.error('Failed to refresh conversation data:', error);
    res.status(500).json({ error: 'Failed to load conversation data' });
  }
}

// Load conversations on startup
loadConversations({ force: true });

// API Routes

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', ensureConversationDataFresh, (req, res) => {
  const conversationsBySource = SOURCES.reduce((acc, source) => {
    acc[source] = getConversationsForSource(source).length;
    return acc;
  }, {});

  res.json({
    status: 'ok',
    conversationsLoaded: cachedConversations?.length || 0,
    conversationsBySource,
    lastLoadTime
  });
});

/**
 * GET /api/analytics/summary
 * Get overall analytics summary
 */
app.get('/api/analytics/summary', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const summary = getAnalyticsForSource(source);
  if (!summary) {
    return res.status(503).json({ error: 'Analytics not ready' });
  }

  res.json(summary);
});

/**
 * GET /api/analytics/sources
 * Get summary overview for all sources
 */
app.get('/api/analytics/sources', ensureConversationDataFresh, (req, res) => {
  function buildOverview(summary) {
    const byDay = summary?.timeline?.byDay || [];
    const lastDay = byDay.length > 0 ? byDay[byDay.length - 1].date : null;
    const firstDay = byDay.length > 0 ? byDay[0].date : null;
    return {
      overview: summary?.overview || null,
      recommendationCount: summary?.recommendations?.length || 0,
      timelineDays: byDay.length,
      firstDay,
      lastDay
    };
  }

  res.json({
    all: buildOverview(cachedAnalytics),
    sources: SOURCES.reduce((acc, source) => {
      acc[source] = buildOverview(cachedAnalyticsBySource[source]);
      return acc;
    }, {})
  });
});

/**
 * GET /api/analytics/schema
 * Get schema-level field analysis by source
 */
app.get('/api/analytics/schema', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  if (source === 'all') {
    return res.json({
      all: cachedSchemaAll,
      sources: cachedSchemaBySource
    });
  }

  const schema = getSchemaForSource(source);
  if (!schema) {
    return res.status(503).json({ error: 'Schema data not ready' });
  }

  res.json(schema);
});

/**
 * GET /api/analytics/tools
 * Get tool usage statistics
 */
app.get('/api/analytics/tools', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  if (!conversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const toolUsage = analyzer.analyzeToolUsage(conversations);
  res.json(toolUsage);
});

/**
 * GET /api/analytics/tasks
 * Get task pattern analysis
 */
app.get('/api/analytics/tasks', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  if (!conversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const taskPatterns = analyzer.analyzeTaskPatterns(conversations);
  res.json(taskPatterns);
});

/**
 * GET /api/analytics/projects
 * Get project activity statistics
 */
app.get('/api/analytics/projects', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  if (!conversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const projectActivity = analyzer.analyzeProjectActivity(conversations);
  res.json(projectActivity);
});

/**
 * GET /api/analytics/metrics
 * Get conversation metrics
 */
app.get('/api/analytics/metrics', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  if (!conversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const metrics = analyzer.analyzeConversationMetrics(conversations);
  res.json(metrics);
});

/**
 * GET /api/conversations
 * List all conversations with basic info
 */
app.get('/api/conversations', ensureConversationDataFresh, (req, res) => {
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  if (!conversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  // Return lightweight conversation list
  const conversationList = conversations.map(conv => ({
    conversationId: conv.conversationId,
    platform: conv.platform || 'claude',
    source: conv.source || 'main',
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
app.get('/api/conversations/:id', ensureConversationDataFresh, (req, res) => {
  const { id } = req.params;
  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  const conversation = conversations?.find(conv => conv.conversationId === id);

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
    loadConversations({ force: true });
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
app.get('/api/search', ensureConversationDataFresh, (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const source = normalizeSource(req.query.source);
  if (source !== 'all' && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid source "${source}"` });
  }

  const conversations = getConversationsForSource(source);
  if (!conversations) {
    return res.status(503).json({ error: 'Data not loaded' });
  }

  const query = q.toLowerCase();
  const results = [];

  conversations.forEach(conv => {
    const matchingMessages = conv.messages.filter(msg => {
      const content = extractMessageTextForSearch(msg);
      return content.toLowerCase().includes(query);
    });

    if (matchingMessages.length > 0) {
      const preview = extractMessageTextForSearch(matchingMessages[0]);
      results.push({
        conversationId: conv.conversationId,
        platform: conv.platform || 'claude',
        project: conv.project,
        matches: matchingMessages.length,
        preview: preview.substring(0, 200)
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
  const sourceCounts = SOURCES
    .map(source => `${source}=${getConversationsForSource(source).length}`)
    .join(', ');
  console.log(`Loaded ${cachedConversations?.length || 0} conversations (${sourceCounts})`);
});
