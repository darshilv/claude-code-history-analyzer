import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the Claude directory path
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const TODOS_DIR = path.join(CLAUDE_DIR, 'todos');
const CODEX_DIR = path.join(os.homedir(), '.codex');
const CODEX_SESSIONS_DIR = path.join(CODEX_DIR, 'sessions');
const CURSOR_DIR = path.join(os.homedir(), '.cursor');
const CURSOR_PROJECTS_DIR = path.join(CURSOR_DIR, 'projects');

/**
 * Parse a JSONL file and return array of JSON objects
 */
export function parseJSONL(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(`Error parsing line: ${line.substring(0, 100)}...`, e);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

/**
 * Get all conversation history entries
 */
export function getHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.error('History file not found:', HISTORY_FILE);
    return [];
  }
  return parseJSONL(HISTORY_FILE);
}

/**
 * Get list of all project directories
 */
export function getProjectDirs() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error('Projects directory not found:', PROJECTS_DIR);
    return [];
  }
  return fs.readdirSync(PROJECTS_DIR)
    .filter(name => fs.statSync(path.join(PROJECTS_DIR, name)).isDirectory());
}

/**
 * Get all conversation files for a specific project
 */
export function getProjectConversations(projectName) {
  const projectPath = path.join(PROJECTS_DIR, projectName);
  if (!fs.existsSync(projectPath)) {
    return [];
  }

  const topLevelFiles = fs.readdirSync(projectPath)
    .filter(file => file.endsWith('.jsonl'));

  const mainConversations = topLevelFiles.map(file => ({
    conversationId: file.replace('.jsonl', ''),
    path: path.join(projectPath, file),
    messages: parseJSONL(path.join(projectPath, file)),
    source: 'main'
  }));

  // Claude Code stores subagent runs under: <sessionId>/subagents/*.jsonl
  const subagentConversations = [];
  const entries = fs.readdirSync(projectPath, { withFileTypes: true });

  entries
    .filter(entry => entry.isDirectory())
    .forEach(entry => {
      const parentSessionId = entry.name;
      const subagentsPath = path.join(projectPath, parentSessionId, 'subagents');
      if (!fs.existsSync(subagentsPath)) {
        return;
      }

      const agentFiles = fs.readdirSync(subagentsPath)
        .filter(file => file.endsWith('.jsonl'));

      agentFiles.forEach(file => {
        const agentId = file.replace('.jsonl', '');
        subagentConversations.push({
          conversationId: `${parentSessionId}__${agentId}`,
          parentConversationId: parentSessionId,
          path: path.join(subagentsPath, file),
          messages: parseJSONL(path.join(subagentsPath, file)),
          source: 'subagent',
          platform: 'claude'
        });
      });
    });

  return [
    ...mainConversations.map(conv => ({
      ...conv,
      platform: 'claude'
    })),
    ...subagentConversations
  ];
}

/**
 * Get all top-level conversation file paths across all projects
 */
export function getConversationFiles() {
  const projects = getProjectDirs();
  const conversationFiles = [];

  for (const project of projects) {
    const projectPath = path.join(PROJECTS_DIR, project);
    if (!fs.existsSync(projectPath)) {
      continue;
    }

    const topLevelFiles = fs.readdirSync(projectPath)
      .filter(file => file.endsWith('.jsonl'))
      .map(file => path.join(projectPath, file));

    conversationFiles.push(...topLevelFiles);

    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    entries
      .filter(entry => entry.isDirectory())
      .forEach(entry => {
        const subagentsPath = path.join(projectPath, entry.name, 'subagents');
        if (!fs.existsSync(subagentsPath)) {
          return;
        }

        const subagentFiles = fs.readdirSync(subagentsPath)
          .filter(file => file.endsWith('.jsonl'))
          .map(file => path.join(subagentsPath, file));

        conversationFiles.push(...subagentFiles);
      });
  }

  return conversationFiles.sort();
}

/**
 * Get a specific conversation by ID
 */
export function getConversationById(conversationId) {
  // Search through all project directories
  const projects = getProjectDirs();

  for (const project of projects) {
    const projectPath = path.join(PROJECTS_DIR, project);
    const conversationFile = path.join(projectPath, `${conversationId}.jsonl`);

    if (fs.existsSync(conversationFile)) {
      return {
        conversationId,
        project,
        messages: parseJSONL(conversationFile)
      };
    }
  }

  return null;
}

/**
 * Get all conversations across all projects
 */
export function getAllConversations() {
  const projects = getProjectDirs();
  const conversations = [];

  for (const project of projects) {
    const projectConversations = getProjectConversations(project);
    conversations.push(...projectConversations.map(conv => ({
      ...conv,
      project
    })));
  }

  return conversations;
}

function walkFilesRecursively(rootDir, matcher) {
  const results = [];
  if (!fs.existsSync(rootDir)) {
    return results;
  }

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (entry.isFile() && matcher(fullPath)) {
        results.push(fullPath);
      }
    });
  }

  walk(rootDir);
  return results.sort();
}

function getCodexSessionFiles() {
  return walkFilesRecursively(CODEX_SESSIONS_DIR, filePath => filePath.endsWith('.jsonl'));
}

function extractTextFromCodexContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const parts = content.map(item => {
    if (!item || typeof item !== 'object') {
      return '';
    }
    if (typeof item.text === 'string') {
      return item.text;
    }
    if (typeof item.input_text === 'string') {
      return item.input_text;
    }
    if (typeof item.output_text === 'string') {
      return item.output_text;
    }
    return '';
  }).filter(Boolean);

  return parts.join('\n').trim();
}

function parseCodexSession(filePath) {
  const entries = parseJSONL(filePath);
  if (entries.length === 0) {
    return null;
  }

  const stats = fs.statSync(filePath);
  const fallbackTimestamp = new Date(stats.mtimeMs).toISOString();

  const sessionMeta = entries.find(entry => entry.type === 'session_meta');
  const sessionPayload = sessionMeta?.payload || {};
  const project = sessionPayload.cwd || 'unknown';
  const conversationId = sessionPayload.id || path.basename(filePath, '.jsonl');
  const messages = [];
  const recordTypeCounts = {};
  const responseItemTypeCounts = {};
  const eventTypeCounts = {};

  entries.forEach(entry => {
    recordTypeCounts[entry.type] = (recordTypeCounts[entry.type] || 0) + 1;
    const timestamp = entry.timestamp || fallbackTimestamp;

    if (entry.type === 'response_item') {
      const payload = entry.payload || {};
      responseItemTypeCounts[payload.type || 'unknown'] = (responseItemTypeCounts[payload.type || 'unknown'] || 0) + 1;

      if (payload.type === 'message') {
        const role = payload.role;
        const messageType = role === 'user'
          ? 'user'
          : role === 'assistant'
            ? 'assistant'
            : 'system';
        const text = extractTextFromCodexContent(payload.content);
        if (text) {
          messages.push({
            type: messageType,
            timestamp,
            message: { content: text }
          });
        }
        return;
      }

      if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
        if (payload.name) {
          messages.push({
            type: 'assistant',
            timestamp,
            message: {
              content: [{ type: 'tool_use', name: payload.name }]
            }
          });
        }
      }
    }

    if (entry.type === 'event_msg') {
      const eventType = entry.payload?.type || 'unknown';
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
    }
  });

  if (messages.length === 0) {
    messages.push({
      type: 'system',
      timestamp: fallbackTimestamp,
      message: { content: 'Session metadata only' }
    });
  }

  return {
    conversationId,
    project,
    path: filePath,
    source: 'main',
    platform: 'codex',
    messages,
    metadata: {
      cliVersion: sessionPayload.cli_version || null,
      modelProvider: sessionPayload.model_provider || null,
      originator: sessionPayload.originator || null,
      sourceClient: sessionPayload.source || null,
      recordTypeCounts,
      responseItemTypeCounts,
      eventTypeCounts
    }
  };
}

export function getCodexConversations() {
  const files = getCodexSessionFiles();
  return files
    .map(parseCodexSession)
    .filter(Boolean);
}

function getCursorTranscriptFiles() {
  return walkFilesRecursively(
    CURSOR_PROJECTS_DIR,
    filePath => filePath.includes(`${path.sep}agent-transcripts${path.sep}`) && filePath.endsWith('.txt')
  );
}

function normalizeCursorText(text) {
  return text
    .replace(/<user_query>/g, '')
    .replace(/<\/user_query>/g, '')
    .trim();
}

function parseCursorTranscriptBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let role = null;
  let buffer = [];

  function flush() {
    if (!role) {
      return;
    }
    const text = buffer.join('\n').trim();
    if (text) {
      blocks.push({ role, text });
    }
    buffer = [];
  }

  lines.forEach(line => {
    if (line.trim() === 'user:') {
      flush();
      role = 'user';
      return;
    }

    if (line.trim() === 'assistant:') {
      flush();
      role = 'assistant';
      return;
    }

    if (role) {
      buffer.push(line);
    }
  });

  flush();
  return blocks;
}

function parseCursorTranscript(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading Cursor transcript ${filePath}:`, error);
    return null;
  }

  const stats = fs.statSync(filePath);
  const projectIndex = filePath.indexOf(`${path.sep}projects${path.sep}`);
  const afterProjects = projectIndex >= 0
    ? filePath.slice(projectIndex + `${path.sep}projects${path.sep}`.length)
    : filePath;
  const project = afterProjects.split(path.sep)[0] || 'unknown';
  const conversationId = path.basename(filePath, '.txt');
  const blocks = parseCursorTranscriptBlocks(content);
  const messages = [];
  let toolCallCount = 0;

  blocks.forEach((block, index) => {
    const timestamp = new Date(stats.mtimeMs + index).toISOString();
    const normalizedText = normalizeCursorText(block.text);

    if (block.role === 'assistant') {
      const toolCallMatches = [...normalizedText.matchAll(/\[Tool call\]\s*([A-Za-z0-9_.-]+)/g)];
      toolCallCount += toolCallMatches.length;
      toolCallMatches.forEach((match, toolIndex) => {
        messages.push({
          type: 'assistant',
          timestamp: new Date(stats.mtimeMs + index + toolIndex + 1).toISOString(),
          message: {
            content: [{ type: 'tool_use', name: match[1] }]
          }
        });
      });
    }

    const plainText = normalizedText
      .split('\n')
      .filter(line => !line.startsWith('[Tool call]') && !line.startsWith('[Tool result]'))
      .join('\n')
      .trim();

    if (plainText) {
      messages.push({
        type: block.role,
        timestamp,
        message: { content: plainText }
      });
    }
  });

  if (messages.length === 0) {
    messages.push({
      type: 'system',
      timestamp: new Date(stats.mtimeMs).toISOString(),
      message: { content: 'Transcript metadata only' }
    });
  }

  return {
    conversationId,
    project,
    path: filePath,
    source: 'main',
    platform: 'cursor',
    messages,
    metadata: {
      blockCount: blocks.length,
      toolCallCount,
      fileSizeBytes: stats.size
    }
  };
}

export function getCursorConversations() {
  const files = getCursorTranscriptFiles();
  return files
    .map(parseCursorTranscript)
    .filter(Boolean);
}

export function getAllConversationsBySource() {
  return {
    claude: getAllConversations(),
    codex: getCodexConversations(),
    cursor: getCursorConversations()
  };
}

/**
 * Build a lightweight fingerprint of conversation files for cache invalidation
 */
export function getConversationsFingerprint() {
  const files = [
    ...getConversationFiles(),
    ...getCodexSessionFiles(),
    ...getCursorTranscriptFiles()
  ];
  if (files.length === 0) {
    return 'empty';
  }

  const hash = crypto.createHash('sha1');

  files.forEach(filePath => {
    try {
      const stats = fs.statSync(filePath);
      hash.update(`${filePath}:${stats.size}:${stats.mtimeMs}`);
    } catch (error) {
      hash.update(`${filePath}:missing`);
    }
  });

  return hash.digest('hex');
}

/**
 * Get todos for a specific conversation
 */
export function getTodos(conversationId) {
  if (!fs.existsSync(TODOS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(TODOS_DIR)
    .filter(file => file.startsWith(conversationId) && file.endsWith('.json'));

  return files.map(file => {
    try {
      const content = fs.readFileSync(path.join(TODOS_DIR, file), 'utf-8');
      return {
        file,
        todos: JSON.parse(content)
      };
    } catch (error) {
      console.error(`Error parsing todo file ${file}:`, error);
      return null;
    }
  }).filter(Boolean);
}

export default {
  parseJSONL,
  getHistory,
  getProjectDirs,
  getProjectConversations,
  getConversationFiles,
  getConversationById,
  getAllConversations,
  getCodexConversations,
  getCursorConversations,
  getAllConversationsBySource,
  getConversationsFingerprint,
  getTodos
};
