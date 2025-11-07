import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the Claude directory path
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const TODOS_DIR = path.join(CLAUDE_DIR, 'todos');

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

  const files = fs.readdirSync(projectPath)
    .filter(file => file.endsWith('.jsonl'));

  return files.map(file => ({
    conversationId: file.replace('.jsonl', ''),
    path: path.join(projectPath, file),
    messages: parseJSONL(path.join(projectPath, file))
  }));
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
  getConversationById,
  getAllConversations,
  getTodos
};
