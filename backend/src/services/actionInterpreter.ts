export interface ActionInterpreterSceneContext {
  location?: string
  activeNPCs?: string[]
  lastNpcPrompt?: string
  lastEvent?: string
}

export interface InterpretedAction {
  originalInput: string
  interpretedInput: string
  intentType: 'direct' | 'confirm' | 'acknowledgment' | 'unclear_short'
  transformed: boolean
  reason: string
}

const normalizeInput = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[!?.,]+$/g, '')
    .trim()

const wordCount = (value: string): number =>
  normalizeInput(value)
    .split(/\s+/)
    .filter(Boolean).length

const isConfirmation = (value: string): boolean => {
  const text = normalizeInput(value)
  const confirmations = new Set([
    'yes',
    'yeah',
    'yep',
    'ok',
    'okay',
    'sure',
    'of course',
    'fine',
    'do it',
    'go on',
    'continue',
    'да',
    'ага',
    'ок',
    'окей',
    'конечно',
    'ладно',
    'давай',
    'продолжай'
  ])
  return confirmations.has(text)
}

const isAcknowledgment = (value: string): boolean => {
  const text = normalizeInput(value)
  const acknowledgments = new Set([
    'alright',
    'got it',
    'understood',
    'i see',
    'понял',
    'поняла',
    'ясно',
    'хорошо'
  ])
  return acknowledgments.has(text)
}

const isShortUnclear = (value: string): boolean => {
  const text = normalizeInput(value)
  if (!text) return true
  if (text.includes(' ')) {
    return wordCount(text) <= 2 && !/[a-zа-я]/i.test(text.replace(/\s+/g, ''))
  }
  return wordCount(text) <= 2 && text.length <= 8
}

const buildReference = (context: ActionInterpreterSceneContext): string => {
  const cue = (context.lastNpcPrompt || '').trim()
  if (cue) {
    return cue
  }
  const event = (context.lastEvent || '').trim()
  if (event) {
    return event
  }
  const location = (context.location || '').trim()
  return location ? `the immediate situation in ${location}` : 'the immediate situation'
}

export function interpretPlayerAction(
  input: string,
  context: ActionInterpreterSceneContext
): InterpretedAction {
  const originalInput = (input || '').trim()
  const reference = buildReference(context)

  if (isConfirmation(originalInput)) {
    return {
      originalInput,
      interpretedInput: `Player confirms and wants to proceed with: ${reference}.`,
      intentType: 'confirm',
      transformed: true,
      reason: 'Short confirmation was mapped to a concrete confirm intent.'
    }
  }

  if (isAcknowledgment(originalInput)) {
    return {
      originalInput,
      interpretedInput: `Player acknowledges the situation and asks to continue from: ${reference}.`,
      intentType: 'acknowledgment',
      transformed: true,
      reason: 'Short acknowledgment was mapped to a concrete continue intent.'
    }
  }

  if (wordCount(originalInput) <= 2 && isShortUnclear(originalInput)) {
    return {
      originalInput,
      interpretedInput: `Player gives a brief unclear response and asks for clarification about: ${reference}.`,
      intentType: 'unclear_short',
      transformed: true,
      reason: 'Ambiguous short input was mapped to a clarification intent.'
    }
  }

  return {
    originalInput,
    interpretedInput: originalInput,
    intentType: 'direct',
    transformed: false,
    reason: 'Input already contains a direct action.'
  }
}

