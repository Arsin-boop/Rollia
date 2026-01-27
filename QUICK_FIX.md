# Quick Fix Guide - AI Not Working

## Immediate Steps to Debug

### 1. Check Backend is Running

Open a terminal and run:
```bash
cd D:\CODE\backend
npm run dev
```

**Look for these messages:**
- РІСљвЂ¦ `СЂСџС™Р‚ Server running on http://localhost:3001`
- РІСљвЂ¦ `РІСљвЂ¦ OpenAI API key is set`
- РІСљвЂ¦ `РІСљвЂ¦ OpenAI client initialized successfully`

**If you see:**
- РІСњРЉ `РІС™В РїС‘РЏ WARNING: OPENAI_API_KEY is not set` РІвЂ вЂ™ Check `backend/.env` file exists

### 2. Test Backend Connection

Open your browser and go to:
- Health check: http://localhost:3001/api/health
- AI test: http://localhost:3001/api/test-ai

**Expected results:**
- Health check should return: `{"status":"ok","message":"D&D AI DM Backend is running"}`
- AI test should return a JSON with `success: true` and a response

### 3. Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Try generating a class or sending a message
4. Look for error messages - they will now show the actual error

### 4. Check Backend Console

When you try to use AI features, the backend console will show:
- What action is being processed
- Any errors that occur
- Detailed error messages

### 5. Common Issues and Fixes

#### Issue: "Network error: Could not connect to backend"
**Fix:** 
- Make sure backend is running on port 3001
- Check `http://localhost:3001/api/health` in browser
- Verify frontend `.env` has: `VITE_API_URL=http://localhost:3001/api`

#### Issue: "Invalid or missing OpenAI API key"
**Fix:**
- Check `backend/.env` file exists
- Verify it contains your `OPENAI_API_KEY`
- If you're using a Groq key, keep the same value and set `OPENAI_BASE_URL=https://api.groq.com/openai/v1`
- Restart the backend server after changing `.env`

#### Issue: "Unauthorized" or "401" errors
**Fix:**
- The API key might be invalid or expired
- Verify your key is still valid in the OpenAI dashboard (or equivalent provider portal)

#### Issue: Backend shows errors about model not found
**Fix:**
- Confirm `OPENAI_MODEL` (default `openai/gpt-oss-120b`) is available to your account
- Update the model name in `backend/.env` if needed

### 6. Verify Files Are Correct

Make sure these files exist:
- РІСљвЂ¦ `D:\CODE\backend\.env` (with your API key)
- РІСљвЂ¦ `D:\CODE\backend\package.json` (with the openai dependency)
- РІСљвЂ¦ `D:\CODE\.env` (with `VITE_API_URL=http://localhost:3001/api`)

### 7. Reinstall Dependencies (if needed)

If nothing works, try:
```bash
# Backend
cd D:\CODE\backend
rm -rf node_modules
npm install

# Frontend  
cd D:\CODE
rm -rf node_modules
npm install
```

## What Changed

The code has been updated to:
1. РІСљвЂ¦ Show actual error messages instead of generic ones
2. РІСљвЂ¦ Log detailed errors in both frontend and backend consoles
3. РІСљвЂ¦ Test backend connection before making API calls
4. РІСљвЂ¦ Return specific error messages from the backend

## Next Steps

1. **Restart both servers:**
   - Backend: `cd D:\CODE\backend && npm run dev`
   - Frontend: `cd D:\CODE && npm run dev`

2. **Check the console messages** - they will tell you exactly what's wrong

3. **Share the error messages** you see in:
   - Backend console
   - Browser console (F12)
   - The error message shown in the UI

The improved error handling will now show you the exact problem!

