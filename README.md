# Claude Code Analytics Dashboard

A local web application that analyzes your Claude Code conversation history to provide insights into your usage patterns, tool usage, workflow efficiency, and feature recommendations.

## Features

- **Usage Overview**: See total conversations, messages, tool uses, and project statistics
- **Tool Usage Analytics**: Visualize which Claude Code tools you use most frequently
- **Task Pattern Analysis**: Understand what types of tasks you commonly work on
- **Project Activity**: Track which projects you're most active in
- **Feature Recommendations**: Discover underutilized Claude Code features that could improve your workflow
- **Conversation Search**: Find past conversations by keyword (coming soon)

## Architecture

- **Frontend**: React + Vite + TypeScript + shadcn/ui + TailwindCSS + Recharts
- **Backend**: Node.js + Express
- **Data Source**: Reads from `~/.claude` directory (JSONL files)

## Getting Started

### Prerequisites

- Node.js v20+ installed
- Claude Code with conversation history in `~/.claude`

### Installation

1. Navigate to the project directory:
   ```bash
   cd ~/Documents/ux_projects/claude-analytics
   ```

2. Install all dependencies (root, backend, and frontend):
   ```bash
   npm run install:all
   ```

### Running the Application

Start both the backend API and frontend dev server:

```bash
npm run dev
```

This will:
- Start the backend API on `http://localhost:3001`
- Start the frontend on `http://localhost:5173`

Open your browser to `http://localhost:5173` to view the dashboard.

### Running Servers Separately

If you prefer to run the servers separately:

**Backend only:**
```bash
npm run dev:backend
```

**Frontend only:**
```bash
npm run dev:frontend
```

## Project Structure

```
claude-analytics/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── ui/       # shadcn/ui components
│   │   │   └── Dashboard.tsx
│   │   ├── lib/          # Utilities (API client, utils)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/               # Node.js + Express backend
│   ├── src/
│   │   ├── parsers/      # JSONL parsing logic
│   │   ├── analyzers/    # Analytics and insights
│   │   └── server.js     # Express server
│   └── package.json
│
├── package.json           # Root package with dev scripts
└── README.md
```

## API Endpoints

The backend exposes these endpoints:

- `GET /api/health` - Health check
- `GET /api/analytics/summary` - Complete analytics summary
- `GET /api/analytics/tools` - Tool usage statistics
- `GET /api/analytics/tasks` - Task pattern analysis
- `GET /api/analytics/projects` - Project activity
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get specific conversation
- `GET /api/search?q=query` - Search conversations
- `POST /api/reload` - Reload data from disk

## Privacy

All your conversation data stays on your local machine. The app:
- Reads directly from `~/.claude` directory
- Runs entirely locally (no external API calls)
- Doesn't send any data to external servers

## Future Enhancements

- Conversation explorer with full-text search
- Temporal analysis (activity over time)
- Prompting effectiveness analysis
- Export reports as PDF/JSON
- Dark mode toggle
- Custom date range filtering
- Tool combination patterns (which tools are used together)

## Troubleshooting

**"Failed to fetch analytics summary"**
- Make sure the backend server is running on port 3001
- Check that `~/.claude` directory exists and contains conversation data

**Port already in use**
- Backend uses port 3001, frontend uses port 5173
- Change ports in `backend/src/server.js` and `frontend/src/lib/api.ts` if needed

## Contributing

This is a personal analytics tool, but feel free to fork and customize for your own needs!

## License

MIT
