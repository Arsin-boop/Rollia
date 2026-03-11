# D&D AI Dungeon Master

A web application for playing Dungeons & Dragons with an AI-powered Dungeon Master. Create characters, manage campaigns, and embark on adventures where the AI handles game mechanics and storytelling.

## Features

### 1. Landing Page
- Welcome page with site description
- "Create Character" button to start character creation

### 2. Character Creation
Multi-stage character creation process:
- **Name**: Enter your character's name
- **Class**: Choose from standard D&D 5e classes or create a custom class with AI assistance
- **Backstory**: Write your character's history and motivations
- **Appearance**: Describe how your character looks
- **Review**: Review and edit all character information before finalizing

### 3. Campaign Hub
- Create new campaigns
- Rename existing campaigns
- Select a campaign to start playing

### 4. Game Session
The main gameplay interface featuring:
- **Chat Interface**: Communicate with the AI DM through text
- **AI DM**: Processes actions, handles dice rolls, skill checks, and provides narrative responses
- **Left Sidebar**: Collapsible panels for:
  - Quests
  - Character Stats
  - Inventory
  - NPC Codex
  - Spellbook
  - Boons & Effects
- **Right Sidebar**: Party information showing:
  - Player characters
  - HP/MP bars
  - Status effects

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **React Router** - Navigation
- **Vite** - Build tool and dev server
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **OpenAI SDK** - AI API integration (openai/gpt-oss-120b)
- **CORS** - Cross-origin resource sharing

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI-compatible API key (already configured in backend/.env)
  - If you're using Groq's OpenAI-compatible endpoint, reuse your Groq key and set `OPENAI_BASE_URL=https://api.groq.com/openai/v1` (the backend will auto-detect this when only `GROQ_API_KEY` is present)

### Installation

1. Navigate to the project directory:
```bash
cd D:\CODE
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
cd ..
```

4. Start the backend server (in one terminal):
```bash
cd backend
npm run dev
```

5. Start the frontend development server (in another terminal):
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

The backend will run on `http://localhost:3001` and the frontend will automatically connect to it.

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
├── package.json                 # Frontend dependencies
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .env                        # Frontend environment variables
├── .gitignore
├── README.md
├── src/                        # Frontend source code
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   ├── utils/
│   │   └── api.ts             # API client functions
│   └── pages/
│       ├── LandingPage.tsx
│       ├── LandingPage.css
│       ├── CharacterCreation.tsx
│       ├── CharacterCreation.css
│       ├── CampaignHub.tsx
│       ├── CampaignHub.css
│       ├── GameSession.tsx
│       └── GameSession.css
└── backend/                    # Backend server
    ├── package.json           # Backend dependencies
    ├── tsconfig.json
    ├── .env                   # Backend environment variables (API key)
    ├── src/
    │   ├── server.ts          # Express server setup
    │   ├── services/
    │   │   ├── aiService.ts   # OpenAI integration
    │   │   └── diceService.ts # D&D 5e dice mechanics
    │   └── routes/
    │       ├── characterRoutes.ts
    │       ├── gameRoutes.ts
    │       └── diceRoutes.ts
    └── dist/                  # Compiled backend code
```

## Features Implemented

✦ **AI-Powered DM**: Integrated with OpenAI API (openai/gpt-oss-120b) for dynamic storytelling
✦ **Custom Class Generation**: AI creates balanced D&D 5e classes based on descriptions
✦ **Dice Rolling System**: Full D&D 5e dice mechanics (d20, skill checks, saving throws)
✦ **Real-time Gameplay**: Chat-based interaction with AI DM
✦ **Character Creation**: Multi-stage character creation with AI-assisted class generation

## API Endpoints

### Character
- `POST /api/character/generate-class` - Generate custom class with AI

### Game
- `POST /api/game/dm-response` - Get AI DM response for player actions

### Dice
- `POST /api/dice/roll` - Roll dice with notation (e.g., "2d6+3")
- `POST /api/dice/roll-d20` - Roll a d20 with modifier
- `POST /api/dice/skill-check` - Perform a skill check
- `POST /api/dice/saving-throw` - Perform a saving throw
- `POST /api/dice/damage` - Roll damage dice
- `POST /api/dice/attack` - Roll attack with bonus
- `POST /api/dice/ability-modifier` - Calculate ability modifier

## Future Enhancements

- Character and campaign persistence (database)
- Real-time multiplayer support
- Advanced combat system
- Spell and ability tracking
- NPC relationship tracking
- Quest management system
- Character sheet export/import

## License

MIT

