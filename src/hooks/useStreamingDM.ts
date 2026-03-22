import { useCallback } from 'react'
import { API_ORIGIN } from '../utils/api'

const STREAM_URL = `${API_ORIGIN}/api/game/dm-response-stream`

export interface StreamingMeta {
  scene?: { location: string; time: string }
  choices?: string[]
  narration?: string
  npcRegistry?: Array<{ id: string; name: string; dialogueColorId?: string }>
  npcPalette?: any[]
  updatedWorldState?: any
  pending_check?: any
  checkRequest?: any
  requiresRoll?: boolean
  battle?: any
  events?: any[]
}

export function useStreamingDM() {
  const streamDMResponse = useCallback(
    async (
      payload: Record<string, unknown>,
      onChunk: (text: string) => void,
      onDone: (meta: StreamingMeta) => void,
      onPending: (check: any, checkRequest: any) => void,
      signal?: AbortSignal
    ): Promise<void> => {
      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      })

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        throw new Error((err as any).error || `Stream failed (${resp.status})`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let leftover = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = leftover + decoder.decode(value, { stream: true })
        const lines = text.split('\n')
        leftover = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') return

          try {
            const event = JSON.parse(raw) as { type: string } & Record<string, any>
            if (event.type === 'chunk') {
              onChunk(event.text ?? '')
            } else if (event.type === 'done') {
              onDone(event as StreamingMeta)
            } else if (event.type === 'pending') {
              onPending(event.pending_check, event.checkRequest)
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Stream error from server')
            }
          } catch (e: any) {
            // If it's a throw from inside, rethrow
            if (e?.message && !e.message.startsWith('JSON')) throw e
          }
        }
      }
    },
    []
  )

  return { streamDMResponse }
}
