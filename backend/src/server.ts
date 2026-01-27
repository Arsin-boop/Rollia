import dotenv from "dotenv";
dotenv.config();
import express from 'express'
import path from 'path'
import cors from 'cors'
import dotenv from 'dotenv'
import characterRoutes from './routes/characterRoutes.js'
import gameRoutes from './routes/gameRoutes.js'
import diceRoutes from './routes/diceRoutes.js'
import battleRoutes from './routes/battleRoutes.js'
import { generateAIResponse } from './services/aiService.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Routes
app.use('/api/character', characterRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/dice', diceRoutes)
app.use('/api/battle', battleRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'D&D AI DM Backend is running' })
})

// Test AI endpoint
app.get('/api/test-ai', async (req, res) => {
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
