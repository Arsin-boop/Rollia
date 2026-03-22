import { useRef, useCallback, useEffect } from 'react'

export type SceneType = 'tavern' | 'dungeon' | 'forest' | 'combat' | 'default'

// Map scene types to audio file paths (relative to /public)
const TRACK_MAP: Record<SceneType, string> = {
  tavern:  '/audio/tavern.mp3',
  dungeon: '/audio/dungeon.mp3',
  forest:  '/audio/forest.mp3',
  combat:  '/audio/combat.mp3',
  default: '/audio/ambient.mp3',
}

const FADE_DURATION = 1500 // ms

// Keywords used to detect scene type from DM text / location header
const SCENE_KEYWORDS: Array<{ type: SceneType; words: RegExp }> = [
  { type: 'combat',  words: /\b(attack|combat|fight|battle|enemy|enemies|sword|weapon|strike|initiative)\b/i },
  { type: 'tavern',  words: /\b(tavern|inn|bar|ale|mead|hearth|fire|crowd|music|lute|bard)\b/i },
  { type: 'dungeon', words: /\b(dungeon|cave|cavern|tunnel|crypt|tomb|underground|dark|damp|drip)\b/i },
  { type: 'forest',  words: /\b(forest|woods|tree|grove|leaves|bird|wind|clearing|path|trail)\b/i },
]

export function detectSceneType(text: string): SceneType {
  for (const { type, words } of SCENE_KEYWORDS) {
    if (words.test(text)) return type
  }
  return 'default'
}

export interface AmbientAudioControls {
  /** Update ambience based on new DM text / location */
  updateAmbience: (sceneHeader: string, dmText: string) => void
  /** Toggle mute on/off, returns new muted state */
  toggleMute: () => boolean
  /** Whether audio is currently muted */
  isMuted: () => boolean
}

export function useAmbientAudio(): AmbientAudioControls {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTrackRef = useRef<string>('')
  const mutedRef = useRef<boolean>(false)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const fadeOut = useCallback((audio: HTMLAudioElement, onDone?: () => void) => {
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
    const startVol = audio.volume
    const step = startVol / (FADE_DURATION / 50)
    fadeTimerRef.current = setInterval(() => {
      if (audio.volume > step) {
        audio.volume = Math.max(0, audio.volume - step)
      } else {
        audio.volume = 0
        audio.pause()
        if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
        onDone?.()
      }
    }, 50)
  }, [])

  const fadeIn = useCallback((audio: HTMLAudioElement) => {
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
    audio.volume = 0
    const target = mutedRef.current ? 0 : 0.3
    if (target === 0) return
    const step = target / (FADE_DURATION / 50)
    fadeTimerRef.current = setInterval(() => {
      if (audio.volume < target - step) {
        audio.volume = Math.min(target, audio.volume + step)
      } else {
        audio.volume = target
        if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
      }
    }, 50)
  }, [])

  const playTrack = useCallback((src: string) => {
    if (currentTrackRef.current === src) return
    currentTrackRef.current = src

    const startNew = () => {
      const audio = new Audio(src)
      audio.loop = true
      audio.volume = 0
      audioRef.current = audio
      audio.play().then(() => {
        fadeIn(audio)
      }).catch(() => {
        // Audio autoplay blocked or file missing — silently ignore
      })
    }

    if (audioRef.current && !audioRef.current.paused) {
      const old = audioRef.current
      fadeOut(old, startNew)
    } else {
      startNew()
    }
  }, [fadeIn, fadeOut])

  const updateAmbience = useCallback((sceneHeader: string, dmText: string) => {
    if (mutedRef.current) return
    const combined = `${sceneHeader} ${dmText}`
    const sceneType = detectSceneType(combined)
    playTrack(TRACK_MAP[sceneType])
  }, [playTrack])

  const toggleMute = useCallback((): boolean => {
    mutedRef.current = !mutedRef.current
    if (audioRef.current) {
      if (mutedRef.current) {
        fadeOut(audioRef.current)
      } else {
        // Resume current track at fade-in volume
        if (audioRef.current.paused && currentTrackRef.current) {
          audioRef.current.play().then(() => {
            if (audioRef.current) fadeIn(audioRef.current)
          }).catch(() => {})
        } else {
          fadeIn(audioRef.current)
        }
      }
    }
    return mutedRef.current
  }, [fadeIn, fadeOut])

  const isMuted = useCallback((): boolean => mutedRef.current, [])

  return { updateAmbience, toggleMute, isMuted }
}
