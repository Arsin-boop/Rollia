# Troubleshooting Guide

## AI DM Not Working - "The DM seems distracted" Error

If you're seeing the error message "The DM seems distracted. Try your action again.", follow these steps:

### Step 1: Check Backend Server is Running

1. Open a terminal and navigate to the backend:
   ```bash
   cd D:\CODE\backend
   ```

2. Check if the server is running:
   ```bash
   npm run dev
   ```

3. You should see:
   ```
   СЂСџС™Р‚ Server running on http://localhost:3001
   РІСљвЂ¦ OpenAI API key loaded (length: XX)
   ```

### Step 2: Test AI Connection

1. Open your browser and go to:
   ```
   http://localhost:3001/api/test-ai
   ```

2. You should see a JSON response. If it shows an error, check the backend console for details.

### Step 3: Check Backend Console for Errors

When you send a message in the game, check the backend terminal for error messages. Look for:
- `AI Service Error Details:`
- `Error message:`
- `Error code:`
- `Error status:`

### Step 4: Verify API Key

1. Check that `backend/.env` file exists and contains:
   (sensitive values omitted)

2. When the backend starts, you should see:
   ```
   РІСљвЂ¦ OpenAI API key loaded (length: 51)
   ```

   If you see:
   ```
   РІС™В РїС‘РЏ  WARNING: OPENAI_API_KEY is not set
   ```
   Then the .env file is not being read correctly.

### Step 5: Check Dependencies

Make sure all backend dependencies are installed:

```bash
cd D:\CODE\backend
npm install
```

### Step 6: Common Issues

#### Issue: "Invalid or missing OpenAI API key"
- **Solution**: Check that the API key in `backend/.env` is correct and doesn't have extra spaces
- **Solution**: Make sure the `.env` file is in the `backend/` directory, not the root

#### Issue: "Unauthorized - Check your OpenAI API key"
- **Solution**: The API key might be invalid or expired. Verify it's correct on the OpenAI dashboard

#### Issue: "Rate limit exceeded"
- **Solution**: You've hit the API rate limit. Wait a few minutes and try again

#### Issue: Model not found errors
- **Solution**: Confirm that `OPENAI_MODEL` (default `openai/gpt-oss-120b`) is available to your API key
- **Solution**: Update the model value in `backend/.env` if you need a different model

### Step 7: Check Network Connection

The OpenAI API requires an internet connection. Make sure:
- Your computer is connected to the internet
- No firewall is blocking the connection
- No VPN is interfering

### Step 8: View Detailed Error Logs

The updated code now provides detailed error logging. When an error occurs, check the backend console for:
- Exact error messages
- Error codes
- API response details

### Still Not Working?

1. **Check the backend console** - It now shows detailed error information
2. **Test the API directly** - Visit `http://localhost:3001/api/test-ai` in your browser
3. **Check browser console** - Open browser DevTools (F12) and check the Network tab for API call errors
4. **Verify CORS** - Make sure the frontend can reach the backend (check browser console for CORS errors)

## Quick Test Commands

```bash
# Test backend health
curl http://localhost:3001/api/health

# Test AI connection
curl http://localhost:3001/api/test-ai
```

Or open these URLs in your browser:
- Health: http://localhost:3001/api/health
- AI Test: http://localhost:3001/api/test-ai

