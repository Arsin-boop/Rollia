# Setup Guide

## Quick Start

### 1. Install Dependencies

**Frontend:**
```bash
cd D:\CODE
npm install
```

**Backend:**
```bash
cd D:\CODE\backend
npm install
```

### 2. Environment Variables

The backend `.env` file is already configured with your OpenAI-compatible API settings:
- `OPENAI_API_KEY` - Your OpenAI (or Groq) API key (already set)
- `OPENAI_BASE_URL` - Defaults to Groq's OpenAI-compatible endpoint (`https://api.groq.com/openai/v1`)
- `OPENAI_MODEL` - Model to request (default: `openai/gpt-oss-120b`)
- `PORT` - Backend server port (default: 3001)

The frontend `.env` file is configured to connect to the backend:
- `VITE_API_URL` - Backend API URL (default: http://localhost:3001/api)

### 3. Start the Application

**Terminal 1 - Backend:**
```bash
cd D:\CODE\backend
npm run dev
```

You should see: `рџљЂ Server running on http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd D:\CODE
npm run dev
```

You should see: `Local: http://localhost:5173`

### 4. Open in Browser

Navigate to: `http://localhost:5173`

## Testing the Features

### Custom Class Generation
1. Go to Character Creation
2. Select "Custom Class (AI)"
3. Enter a description like: "A shadow mage who can phase through walls"
4. Click "Generate Class with AI"
5. Wait for AI to generate stats, hit die, proficiencies, and features

### AI DM
1. Create a character and campaign
2. Start a game session
3. Type actions like: "I search the room for hidden doors"
4. The AI DM will respond with narrative and handle any necessary dice rolls

### Dice Rolling
The AI DM automatically handles dice rolls when needed. You can also manually roll dice through the API endpoints if needed.

## Troubleshooting

### Backend won't start
- Check that port 3001 is not in use
- Verify `.env` file exists in `backend/` directory
- Check that `OPENAI_API_KEY` is set correctly

### Frontend can't connect to backend
- Ensure backend is running on port 3001
- Check `VITE_API_URL` in frontend `.env` file
- Check browser console for CORS errors

### AI responses not working
- Verify OpenAI API key is valid
- Check backend console for error messages
- Ensure you have internet connection (OpenAI API requires internet)

## Development

### Backend Development
- Backend uses `tsx` for hot reloading
- Changes to backend files will automatically restart the server
- Check `backend/src/server.ts` for server configuration

### Frontend Development
- Frontend uses Vite for fast HMR (Hot Module Replacement)
- Changes to React components will update instantly
- API calls are in `src/utils/api.ts`

