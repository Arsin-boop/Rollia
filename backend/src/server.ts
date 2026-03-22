import express from 'express'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import characterRoutes from './routes/characterRoutes.js'
import gameRoutes from './routes/gameRoutes.js'
import diceRoutes from './routes/diceRoutes.js'
import battleRoutes from './routes/battleRoutes.js'
import { generateAIResponse } from './services/aiService.js'

const cwd = process.cwd()
const inferredBackendRoot = fs.existsSync(path.join(cwd, 'src', 'server.ts'))
  ? cwd
  : path.join(cwd, 'backend')
const backendRoot = fs.existsSync(inferredBackendRoot) ? inferredBackendRoot : cwd
const envPath = path.join(backendRoot, '.env')
dotenv.config({ path: envPath })

const requiredEnvVars = ['GROQ_API_KEY_PRIMARY']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`)
    console.error(`Check ${envPath} - see backend/.env.example for reference`)
    process.exit(1)
  }
}

if (!process.env.GROQ_API_KEY_UTILITY) {
  console.warn('GROQ_API_KEY_UTILITY is not set. Utility tasks will use primary model fallback.')
}

const app = express()
const PORT = process.env.PORT || 3001

// Trust Railway's reverse proxy so express-rate-limit reads the correct IP
app.set('trust proxy', 1)

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(backendRoot, 'uploads')))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(globalLimiter)

// Routes
app.use('/api/character', strictLimiter, characterRoutes)
app.use('/api/game', strictLimiter, gameRoutes)
app.use('/api/dice', diceRoutes)
app.use('/api/battle', battleRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'D&D AI DM Backend is running', timestamp: new Date().toISOString() })
})

// Test AI endpoint
app.get('/api/test-ai', async (_req, res) => {
  try {
    console.log('Testing AI connection...')
    const response = await generateAIResponse({
      userPrompt: 'Say "Hello, I am working!" in one sentence.',
      systemPrompt: 'You are a test assistant.',
      maxTokens: 50
    })
    res.json({ success: true, response, message: 'AI is working correctly!' })
  } catch (error: any) {
    console.error('AI test failed:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check backend console for more information'
    })
  }
})

// Keep API failures JSON-shaped (never HTML), which prevents frontend JSON parse crashes.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` })
})

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', error)
  res.status(error?.status || 500).json({
    error: error?.message || 'Internal server error'
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
  console.log(`AI test: http://localhost:${PORT}/api/test-ai`)

  const groqPrimaryKey = process.env.GROQ_API_KEY_PRIMARY
  const groqUtilityKey = process.env.GROQ_API_KEY_UTILITY
  const baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'

  if (groqPrimaryKey) {
    console.log('Groq primary API key is set.')
  } else {
    console.warn('GROQ_API_KEY_PRIMARY is NOT set!')
  }
  if (groqUtilityKey) {
    console.log('Groq utility API key is set.')
  } else {
    console.warn('GROQ_API_KEY_UTILITY is NOT set!')
  }

  console.log(`Using Groq base URL: ${baseUrl}`)
})
