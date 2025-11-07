/**
 * Analyze conversation patterns and extract insights
 */

/**
 * Extract tool usage from conversation messages
 */
export function analyzeToolUsage(conversations) {
  const toolCounts = {};
  const toolsByProject = {};

  conversations.forEach(conv => {
    const projectName = conv.project || 'unknown';
    if (!toolsByProject[projectName]) {
      toolsByProject[projectName] = {};
    }

    conv.messages.forEach(msg => {
      if (msg.type === 'assistant' && msg.message?.content) {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          content.forEach(item => {
            if (item.type === 'tool_use' && item.name) {
              const toolName = item.name;
              toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
              toolsByProject[projectName][toolName] =
                (toolsByProject[projectName][toolName] || 0) + 1;
            }
          });
        }
      }
    });
  });

  return {
    overall: toolCounts,
    byProject: toolsByProject
  };
}

/**
 * Analyze conversation length and complexity
 */
export function analyzeConversationMetrics(conversations) {
  const metrics = conversations.map(conv => {
    const messageCount = conv.messages.length;
    const userMessages = conv.messages.filter(m => m.type === 'user').length;
    const assistantMessages = conv.messages.filter(m => m.type === 'assistant').length;

    // Count tool uses
    let toolUseCount = 0;
    conv.messages.forEach(msg => {
      if (msg.type === 'assistant' && msg.message?.content) {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          toolUseCount += content.filter(item => item.type === 'tool_use').length;
        }
      }
    });

    // Get timestamps
    const timestamps = conv.messages
      .map(m => m.timestamp)
      .filter(Boolean);

    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const duration = firstTimestamp && lastTimestamp
      ? new Date(lastTimestamp) - new Date(firstTimestamp)
      : 0;

    return {
      conversationId: conv.conversationId,
      project: conv.project,
      messageCount,
      userMessages,
      assistantMessages,
      toolUseCount,
      duration,
      timestamp: firstTimestamp
    };
  });

  return metrics;
}

/**
 * Identify common task patterns from user messages
 */
export function analyzeTaskPatterns(conversations) {
  const patterns = {
    debugging: 0,
    featureImplementation: 0,
    codeReview: 0,
    documentation: 0,
    refactoring: 0,
    testing: 0,
    exploration: 0,
    configuration: 0,
    update: 0,
    question: 0
  };

  const keywords = {
    debugging: ['fix', 'error', 'bug', 'issue', 'broken', 'not working', 'debug', 'failing', 'crash'],
    featureImplementation: ['add', 'create', 'implement', 'build', 'new feature', 'functionality', 'need to', 'want to'],
    codeReview: ['review', 'look at', 'analyze', 'examine', 'can you check'],
    documentation: ['document', 'readme', 'comment', 'docs', 'documentation'],
    refactoring: ['refactor', 'improve', 'optimize', 'clean up', 'restructure', 'reorganize'],
    testing: ['test', 'testing', 'unit test', 'integration test'],
    exploration: ['how do', 'how can', 'what is', 'what does', 'explain', 'understand', 'learn', 'find', 'search', 'where'],
    configuration: ['config', 'setup', 'install', 'configure', 'settings'],
    update: ['update', 'change', 'modify', 'edit', 'replace', 'remove'],
    question: ['?', 'why', 'when', 'should', 'could', 'would']
  };

  conversations.forEach(conv => {
    const userMessages = conv.messages.filter(m => m.type === 'user');

    userMessages.forEach(msg => {
      const content = msg.message?.content;
      if (typeof content === 'string') {
        const lowerContent = content.toLowerCase();

        // Try to match patterns with priority (more specific first)
        let matched = false;
        const priorityOrder = [
          'debugging',
          'featureImplementation',
          'testing',
          'refactoring',
          'update',
          'configuration',
          'documentation',
          'codeReview',
          'exploration',
          'question'
        ];

        for (const pattern of priorityOrder) {
          const words = keywords[pattern];
          if (words.some(word => lowerContent.includes(word))) {
            patterns[pattern]++;
            matched = true;
            break;
          }
        }
      }
    });
  });

  return patterns;
}

/**
 * Analyze prompting patterns to understand what makes effective prompts
 */
export function analyzePromptingPatterns(conversations) {
  let totalPrompts = 0;
  let totalLength = 0;
  let shortPromptsCount = 0; // < 50 chars
  let mediumPromptsCount = 0; // 50-200 chars
  let longPromptsCount = 0; // > 200 chars

  const promptLengths = [];
  const examples = {
    short: [],
    medium: [],
    long: []
  };

  conversations.forEach(conv => {
    const userMessages = conv.messages.filter(m => m.type === 'user');

    userMessages.forEach(msg => {
      const content = msg.message?.content;
      if (typeof content === 'string' && content.length > 0) {
        totalPrompts++;
        totalLength += content.length;
        promptLengths.push(content.length);

        if (content.length < 50) {
          shortPromptsCount++;
          if (examples.short.length < 3) {
            examples.short.push(content.substring(0, 100));
          }
        } else if (content.length < 200) {
          mediumPromptsCount++;
          if (examples.medium.length < 3) {
            examples.medium.push(content.substring(0, 100));
          }
        } else {
          longPromptsCount++;
          if (examples.long.length < 3) {
            examples.long.push(content.substring(0, 100) + '...');
          }
        }
      }
    });
  });

  return {
    totalPrompts,
    avgLength: totalPrompts > 0 ? Math.round(totalLength / totalPrompts) : 0,
    distribution: {
      short: {
        count: shortPromptsCount,
        percentage: totalPrompts > 0 ? Math.round((shortPromptsCount / totalPrompts) * 100) : 0,
        description: 'Under 50 characters - quick questions or commands'
      },
      medium: {
        count: mediumPromptsCount,
        percentage: totalPrompts > 0 ? Math.round((mediumPromptsCount / totalPrompts) * 100) : 0,
        description: '50-200 characters - clear, focused requests'
      },
      long: {
        count: longPromptsCount,
        percentage: totalPrompts > 0 ? Math.round((longPromptsCount / totalPrompts) * 100) : 0,
        description: 'Over 200 characters - detailed context and requirements'
      }
    }
  };
}

/**
 * Analyze conversation flow patterns
 */
export function analyzeConversationFlows(conversations) {
  let singleTurnCount = 0;
  let shortConvCount = 0; // 2-5 turns
  let mediumConvCount = 0; // 6-15 turns
  let longConvCount = 0; // 16+ turns

  const conversationLengths = [];

  conversations.forEach(conv => {
    const userMessages = conv.messages.filter(m => m.type === 'user');
    const turnCount = userMessages.length;

    conversationLengths.push(turnCount);

    if (turnCount === 1) {
      singleTurnCount++;
    } else if (turnCount <= 5) {
      shortConvCount++;
    } else if (turnCount <= 15) {
      mediumConvCount++;
    } else {
      longConvCount++;
    }
  });

  const avgTurns = conversationLengths.length > 0
    ? conversationLengths.reduce((a, b) => a + b, 0) / conversationLengths.length
    : 0;

  return {
    avgTurnsPerConversation: Math.round(avgTurns * 10) / 10,
    distribution: {
      singleTurn: {
        count: singleTurnCount,
        percentage: Math.round((singleTurnCount / conversations.length) * 100),
        description: 'One question, quick answer'
      },
      shortConversations: {
        count: shortConvCount,
        percentage: Math.round((shortConvCount / conversations.length) * 100),
        description: '2-5 back-and-forth exchanges'
      },
      mediumConversations: {
        count: mediumConvCount,
        percentage: Math.round((mediumConvCount / conversations.length) * 100),
        description: '6-15 exchanges - typical task completion'
      },
      longConversations: {
        count: longConvCount,
        percentage: Math.round((longConvCount / conversations.length) * 100),
        description: '16+ exchanges - complex or iterative work'
      }
    }
  };
}

/**
 * Analyze tool usage sequences - what tools are commonly used together
 */
export function analyzeToolSequences(conversations) {
  const sequences = {};

  conversations.forEach(conv => {
    const tools = [];

    conv.messages.forEach(msg => {
      if (msg.type === 'assistant' && msg.message?.content) {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          content.forEach(item => {
            if (item.type === 'tool_use' && item.name) {
              tools.push(item.name);
            }
          });
        }
      }
    });

    // Look for 2-tool sequences
    for (let i = 0; i < tools.length - 1; i++) {
      const seq = `${tools[i]} → ${tools[i + 1]}`;
      sequences[seq] = (sequences[seq] || 0) + 1;
    }
  });

  // Get top 10 sequences
  const topSequences = Object.entries(sequences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sequence, count]) => ({ sequence, count }));

  return topSequences;
}

/**
 * Analyze project activity
 */
export function analyzeProjectActivity(conversations) {
  const projectStats = {};

  conversations.forEach(conv => {
    const project = conv.project || 'unknown';
    if (!projectStats[project]) {
      projectStats[project] = {
        conversationCount: 0,
        messageCount: 0,
        timestamps: []
      };
    }

    projectStats[project].conversationCount++;
    projectStats[project].messageCount += conv.messages.length;

    // Collect timestamps
    conv.messages.forEach(msg => {
      if (msg.timestamp) {
        projectStats[project].timestamps.push(msg.timestamp);
      }
    });
  });

  // Calculate additional metrics for each project
  Object.keys(projectStats).forEach(project => {
    const stats = projectStats[project];
    const timestamps = stats.timestamps.sort();

    if (timestamps.length > 0) {
      stats.firstActivity = timestamps[0];
      stats.lastActivity = timestamps[timestamps.length - 1];
    }

    delete stats.timestamps; // Remove raw timestamps from response
  });

  return projectStats;
}

/**
 * Generate intelligent recommendations based on conversation patterns
 */
export function generateRecommendations(conversations, toolUsage, taskPatterns, promptingPatterns, conversationFlows) {
  const recommendations = [];

  // Analyze tool usage for batch operation opportunities
  const readCount = toolUsage.overall['Read'] || 0;
  const editCount = toolUsage.overall['Edit'] || 0;
  const grepCount = toolUsage.overall['Grep'] || 0;
  const globCount = toolUsage.overall['Glob'] || 0;
  const taskCount = toolUsage.overall['Task'] || 0;
  const todoCount = toolUsage.overall['TodoWrite'] || 0;

  // Recommendation: Use Task agent for complex searches
  if (grepCount > 50 && taskCount < 10) {
    recommendations.push({
      type: 'efficiency',
      title: 'Use Task Agent for Complex Searches',
      insight: `You've used Grep ${grepCount} times. For complex multi-file searches, the Task agent can search more effectively.`,
      action: 'Try using the Task tool for searches across multiple files or complex refactoring tasks.',
      priority: 'high'
    });
  }

  // Recommendation: Use TodoWrite for complex tasks
  const longConvPercentage = conversationFlows.distribution.longConversations.percentage;
  if (longConvPercentage > 30 && todoCount < 50) {
    recommendations.push({
      type: 'workflow',
      title: 'Track Complex Tasks with TodoWrite',
      insight: `${longConvPercentage}% of your conversations are long (16+ exchanges). TodoWrite helps track multi-step tasks.`,
      action: 'Ask Claude to use TodoWrite at the start of complex implementations to track progress.',
      priority: 'high'
    });
  }

  // Recommendation: Batch file operations
  if (readCount > 100 && editCount > 100) {
    const ratio = readCount / editCount;
    if (ratio < 1.5) {
      recommendations.push({
        type: 'efficiency',
        title: 'Consider Batching Read Operations',
        insight: 'You often read and edit files separately. Claude can read multiple files at once.',
        action: 'Try asking "Read files X, Y, and Z" in one message to batch operations.',
        priority: 'medium'
      });
    }
  }

  // Recommendation: Improve prompting
  const shortPromptPercentage = promptingPatterns.distribution.short.percentage;
  if (shortPromptPercentage > 40) {
    recommendations.push({
      type: 'prompting',
      title: 'Provide More Context in Prompts',
      insight: `${shortPromptPercentage}% of your prompts are very short (<50 chars). More context leads to better results.`,
      action: 'Include file paths, expected behavior, and constraints in your requests for more accurate assistance.',
      priority: 'medium'
    });
  }

  // Recommendation: Use Glob instead of multiple Reads
  if (readCount > 200 && globCount < 50) {
    recommendations.push({
      type: 'efficiency',
      title: 'Use Glob for File Discovery',
      insight: `You've used Read ${readCount} times. Glob can find files matching patterns more efficiently.`,
      action: 'Ask Claude to "find all .tsx files" or "glob for test files" to discover files faster.',
      priority: 'medium'
    });
  }

  // Recommendation based on debugging patterns
  const debuggingCount = taskPatterns.debugging || 0;
  const totalTasks = Object.values(taskPatterns).reduce((a, b) => a + b, 0);
  if (debuggingCount > totalTasks * 0.3) {
    recommendations.push({
      type: 'workflow',
      title: 'Debugging Strategy',
      insight: `${Math.round((debuggingCount / totalTasks) * 100)}% of your tasks are debugging. Consider a systematic approach.`,
      action: 'Start debugging sessions with "Run the tests first" or "Check the error logs" to establish baseline.',
      priority: 'low'
    });
  }

  // Recommendation: Use parallel tool calls
  const avgToolsPerMessage = conversations.reduce((sum, conv) => {
    let toolCallMessages = 0;
    let totalTools = 0;
    conv.messages.forEach(msg => {
      if (msg.type === 'assistant' && msg.message?.content && Array.isArray(msg.message.content)) {
        const tools = msg.message.content.filter(item => item.type === 'tool_use');
        if (tools.length > 0) {
          toolCallMessages++;
          totalTools += tools.length;
        }
      }
    });
    return sum + (toolCallMessages > 0 ? totalTools / toolCallMessages : 0);
  }, 0) / conversations.length;

  if (avgToolsPerMessage < 1.5 && (readCount > 100 || grepCount > 50)) {
    recommendations.push({
      type: 'efficiency',
      title: 'Request Parallel Operations',
      insight: 'Claude can run multiple operations in parallel but usually does them one at a time for you.',
      action: 'Try asking "Read these 3 files in parallel" or "Check both implementations simultaneously".',
      priority: 'high'
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations.slice(0, 5); // Return top 5 recommendations
}

function getToolDescription(tool) {
  const descriptions = {
    'Task': 'Launch specialized agents for complex, multi-step tasks',
    'TodoWrite': 'Track and manage tasks during coding sessions',
    'WebFetch': 'Fetch and analyze web content',
    'NotebookEdit': 'Edit Jupyter notebook cells',
    'Glob': 'Fast file pattern matching',
    'Grep': 'Search code with regex patterns',
    'Read': 'Read file contents',
    'Write': 'Create new files',
    'Edit': 'Modify existing files',
    'Bash': 'Execute terminal commands'
  };
  return descriptions[tool] || 'Tool for development tasks';
}

function getToolUseCase(tool) {
  const useCases = {
    'Task': 'Use for complex searches across codebase or multi-file refactoring',
    'TodoWrite': 'Keep track of multi-step implementations',
    'WebFetch': 'Fetch documentation or examples from the web',
    'NotebookEdit': 'Work with Jupyter notebooks for data analysis',
    'Glob': 'Find files matching patterns like "**/*.test.js"',
    'Grep': 'Search for specific code patterns or function definitions',
    'Read': 'View file contents before editing',
    'Write': 'Create configuration files or new modules',
    'Edit': 'Make precise changes to existing code',
    'Bash': 'Run builds, tests, or git commands'
  };
  return useCases[tool] || 'Improve your workflow efficiency';
}

/**
 * Generate overall analytics summary
 */
export function generateSummary(conversations) {
  const toolUsage = analyzeToolUsage(conversations);
  const metrics = analyzeConversationMetrics(conversations);
  const taskPatterns = analyzeTaskPatterns(conversations);
  const projectActivity = analyzeProjectActivity(conversations);
  const promptingPatterns = analyzePromptingPatterns(conversations);
  const conversationFlows = analyzeConversationFlows(conversations);
  const toolSequences = analyzeToolSequences(conversations);

  // Generate intelligent recommendations based on all patterns
  const recommendations = generateRecommendations(
    conversations,
    toolUsage,
    taskPatterns,
    promptingPatterns,
    conversationFlows
  );

  const totalMessages = metrics.reduce((sum, m) => sum + m.messageCount, 0);
  const totalToolUses = metrics.reduce((sum, m) => sum + m.toolUseCount, 0);
  const avgMessagesPerConversation = totalMessages / conversations.length || 0;

  return {
    overview: {
      totalConversations: conversations.length,
      totalMessages,
      totalToolUses,
      avgMessagesPerConversation: Math.round(avgMessagesPerConversation * 10) / 10,
      totalProjects: Object.keys(projectActivity).length
    },
    toolUsage,
    conversationMetrics: metrics.slice(0, 20), // Latest 20 for overview
    taskPatterns,
    projectActivity,
    recommendations,
    promptingPatterns,
    conversationFlows,
    toolSequences
  };
}

export default {
  analyzeToolUsage,
  analyzeConversationMetrics,
  analyzeTaskPatterns,
  analyzeProjectActivity,
  generateRecommendations,
  analyzePromptingPatterns,
  analyzeConversationFlows,
  analyzeToolSequences,
  generateSummary
};
