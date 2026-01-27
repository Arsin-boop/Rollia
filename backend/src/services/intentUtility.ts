export type SegmentHint = 'SPEECH' | 'REQUEST' | 'ACTION_NOW' | 'PAST_REF' | 'PLAN' | 'UNKNOWN'

export type Segment = {
  id: string
  text: string
  hint?: SegmentHint
  confidence?: number
  anchorMatch?: boolean
  noRollCandidate?: boolean
  markers?: string[]
}

export type LastResolvedAction = {
  summary: string
  domain: string
  stat: string | null
  skill?: string | null
  timestamp: number
  keywords?: string[]
}

const PAST_REF_MARKERS = [
  /\b(i thought|i tried|turns out|i couldn'?t|i did(?:n'?t)?|i was going to|earlier|a moment ago|just now)\b/i,
  /\b(was|were)\b/i,
  /\b(tried|couldn'?t|didn'?t|wasn'?t|weren'?t)\b/i,
  /\b(my bad|sorry|oops|i didn'?t mean|i just thought)\b/i
]

const REQUEST_MARKERS = [
  /\b(can you|could you|give me|i ask for|i order|i'?d like|please)\b/i,
  /\b(barkeep|bartender)\b/i
]

const SPEECH_MARKERS = [
  /^\s*i\s+(say|tell|ask)\b/i
]

const TRIVIAL_ITEMS = /\b(ale|water|bread|room|information|name)\b/i
const AGGRESSION_WORDS = /\b(threaten|insult|intimidate|steal|refuse|demand)\b/i

const ACTION_NOW_MARKERS = [
  /\b(i\s+)?(attack|strike|swing|shoot|stab|slash|kick|punch|grapple)\b/i,
  /\b(i\s+)?(try|attempt)\s+to\b/i,
  /\b(i\s+)?(jump|climb|flip|vault|sneak|hide|steal)\b/i
]

const stripQuotedSegments = (text: string) => {
  return text.replace(/["“”][^"“”]*["“”]/g, '').trim()
}

const splitQuotedSegments = (line: string) => {
  const segments: { type: 'quote' | 'text'; value: string }[] = []
  let remaining = line
  const regex = /["“”]([^"“”]+)["“”]/
  while (true) {
    const match = remaining.match(regex)
    if (!match) {
      if (remaining.trim()) {
        segments.push({ type: 'text', value: remaining.trim() })
      }
      break
    }
    const before = remaining.slice(0, match.index ?? 0).trim()
    if (before) {
      segments.push({ type: 'text', value: before })
    }
    segments.push({ type: 'quote', value: match[1].trim() })
    remaining = remaining.slice((match.index ?? 0) + match[0].length).trim()
  }
  return segments
}

export const segmentMessage = (text: string): Segment[] => {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const segments: Segment[] = []
  let idCounter = 1

  lines.forEach(line => {
    const quotedSegments = splitQuotedSegments(line)
    const expanded: string[] = []
    quotedSegments.forEach(piece => {
      if (!piece.value) return
      if (piece.type === 'quote') {
        expanded.push(`"${piece.value}"`)
      } else {
        expanded.push(piece.value)
      }
    })
    const lineSegments = expanded.length ? expanded : [line]
    lineSegments.forEach(segmentText => {
      if (!segmentText) return
      if (segmentText.length > 120 && /[.!?]/.test(segmentText)) {
        segmentText
          .split(/(?<=[.!?])\s+/)
          .map(part => part.trim())
          .filter(Boolean)
          .forEach(part => {
            segments.push({ id: `seg-${idCounter++}`, text: part })
          })
      } else {
        segments.push({ id: `seg-${idCounter++}`, text: segmentText })
      }
    })
  })

  if (!segments.length && text.trim()) {
    segments.push({ id: `seg-${idCounter++}`, text: text.trim() })
  }

  return segments
}

const extractKeywords = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2)
}

const hasAnchorMatch = (segmentText: string, lastResolvedAction?: LastResolvedAction | null) => {
  if (!lastResolvedAction) return false
  const keywords = lastResolvedAction.keywords?.length
    ? lastResolvedAction.keywords
    : extractKeywords(lastResolvedAction.summary)
  const lowered = segmentText.toLowerCase()
  return keywords.some(keyword => keyword && lowered.includes(keyword))
}

const detectPastRef = (segmentText: string) => {
  return PAST_REF_MARKERS.some(pattern => pattern.test(segmentText))
}

const detectRequest = (segmentText: string) => {
  return REQUEST_MARKERS.some(pattern => pattern.test(segmentText))
}

const detectSpeech = (segmentText: string) => {
  if (/^["“”].+["“”]$/.test(segmentText.trim())) {
    return true
  }
  return SPEECH_MARKERS.some(pattern => pattern.test(segmentText))
}

const detectActionNow = (segmentText: string) => {
  return ACTION_NOW_MARKERS.some(pattern => pattern.test(segmentText))
}

export const annotateSegments = (
  segments: Segment[],
  lastResolvedAction?: LastResolvedAction | null
): Segment[] => {
  return segments.map(segment => {
    const markers: string[] = []
    let hint: SegmentHint = 'UNKNOWN'
    let confidence = 0.4
    const anchorMatch = hasAnchorMatch(stripQuotedSegments(segment.text), lastResolvedAction)
    const pastRef = detectPastRef(segment.text)
    if (pastRef) {
      hint = 'PAST_REF'
      confidence = 0.85
      markers.push('PAST_REF')
    }
    if (anchorMatch && pastRef) {
      hint = 'PAST_REF'
      confidence = 0.95
      markers.push('ANCHOR_PAST_REF')
    }

    if (hint !== 'PAST_REF' && detectSpeech(segment.text)) {
      hint = 'SPEECH'
      confidence = 0.8
      markers.push('SPEECH')
    }
    if (hint !== 'PAST_REF' && detectRequest(segment.text)) {
      hint = 'REQUEST'
      confidence = 0.8
      markers.push('REQUEST')
    }
    if (hint === 'UNKNOWN' && detectActionNow(segment.text)) {
      hint = 'ACTION_NOW'
      confidence = 0.7
      markers.push('ACTION_NOW')
    }

    let noRollCandidate = false
    if (hint === 'PAST_REF' || hint === 'SPEECH') {
      noRollCandidate = true
    } else if (hint === 'REQUEST') {
      const isTrivial = TRIVIAL_ITEMS.test(segment.text) && !AGGRESSION_WORDS.test(segment.text)
      if (isTrivial) {
        noRollCandidate = true
        markers.push('TRIVIAL_REQUEST')
      }
    }

    return {
      ...segment,
      hint,
      confidence,
      anchorMatch,
      noRollCandidate,
      markers
    }
  })
}
