import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const STYLE_VERSION = 'v3'
const MODELSLAB_ENDPOINT = 'https://modelslab.com/api/v6/images/text2img'
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars')

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

const normalizeAppearance = (appearance: string | Record<string, any>) => {
  if (typeof appearance === 'string') {
    return appearance.replace(/\s+/g, ' ').trim()
  }
  try {
    return JSON.stringify(appearance)
  } catch {
    return String(appearance)
  }
}

export type AvatarPromptInput = {
  appearanceDescription: string | Record<string, any>
  appearanceSpec: {
    sex: 'male' | 'female' | 'unknown'
    genderPresentation: 'masculine' | 'feminine' | 'androgynous' | 'unknown'
    ageRange: 'teen' | '20s' | '30s' | '40s' | '50+' | 'unknown'
    hairLength: 'short' | 'medium' | 'long' | 'unknown'
    bodyType: 'slim' | 'average' | 'athletic' | 'muscular' | 'unknown'
    notableFeatures?: string[]
    clothingStyle?: string[]
    palette?: string[]
    confidence?: number
  }
  className?: string
  classTags?: string[]
  forceStrength?: 'normal' | 'strong'
}

const composeGenderAnchors = (input: AvatarPromptInput) => {
  const sex = input.appearanceSpec.sex
  const genderPresentation = input.appearanceSpec.genderPresentation
  const confidence = typeof input.appearanceSpec.confidence === 'number' ? input.appearanceSpec.confidence : 0
  const baseMale =
    'adult man, masculine male, male face, angular jawline, pronounced brow ridge, broad shoulders, light stubble'
  const baseFemale = 'adult woman, feminine female, female face'
  const maleNegative =
    'female, woman, girl, feminine face, delicate features, makeup, lipstick, eyeliner, long eyelashes, cleavage'
  const femaleNegative = 'male, man, boy, masculine jawline, beard, moustache'

  if (genderPresentation === 'androgynous') {
    return {
      prefix: sex === 'male' ? 'adult man, androgynous features' : 'adult woman, androgynous features',
      negative: ''
    }
  }

  if (sex === 'male' || genderPresentation === 'masculine') {
    const longHair =
      input.appearanceSpec.hairLength === 'long'
        ? ', long hair tied back, masculine face'
        : ''
    const strongBoost =
      input.forceStrength === 'strong'
        ? ', strong jawline, pronounced brow, visible stubble'
        : ''
    return {
      prefix: `${baseMale}${longHair}${strongBoost}`,
      negative: maleNegative
    }
  }

  const strongBoost =
    input.forceStrength === 'strong'
      ? ', soft facial features, feminine cheeks'
      : ''
  if (sex === 'female' || genderPresentation === 'feminine') {
    return { prefix: `${baseFemale}${strongBoost}`, negative: femaleNegative }
  }

  if (confidence < 0.6) {
    return {
      prefix: 'adult adventurer, realistic fantasy portrait',
      negative: ''
    }
  }

  return {
    prefix: 'adult adventurer, realistic fantasy portrait',
    negative: ''
  }
}

const composeBodyAnchors = (input: AvatarPromptInput) => {
  const parts: string[] = []
  if (input.appearanceSpec.ageRange && input.appearanceSpec.ageRange !== 'unknown') {
    parts.push(input.appearanceSpec.ageRange === '50+' ? 'age 50 plus' : `age ${input.appearanceSpec.ageRange}`)
  }
  if (input.appearanceSpec.bodyType && input.appearanceSpec.bodyType !== 'unknown') {
    parts.push(`${input.appearanceSpec.bodyType} build`)
  }
  if (input.appearanceSpec.hairLength && input.appearanceSpec.hairLength !== 'unknown') {
    parts.push(`${input.appearanceSpec.hairLength} hair`)
  }
  return parts.join(', ')
}

const buildClassLayer = (className?: string, classTags?: string[]) => {
  if (!className && (!classTags || !classTags.length)) {
    return ''
  }
  const tags = classTags?.length ? classTags.join(', ') : ''
  if (className && tags) {
    return `Class: ${className}. Visual motifs: ${tags}`
  }
  if (className) {
    return `Class: ${className}`
  }
  return `Visual motifs: ${tags}`
}

export const composeAvatarPrompt = (input: AvatarPromptInput) => {
  const normalized = normalizeAppearance(input.appearanceDescription || '')
  const genderAnchors = composeGenderAnchors(input)
  const bodyAnchors = composeBodyAnchors(input)
  const classLayer = buildClassLayer(input.className, input.classTags)
  const notable = input.appearanceSpec.notableFeatures?.length
    ? input.appearanceSpec.notableFeatures.join(', ')
    : ''
  const clothing = input.appearanceSpec.clothingStyle?.length
    ? input.appearanceSpec.clothingStyle.join(', ')
    : ''
  const palette = input.appearanceSpec.palette?.length
    ? input.appearanceSpec.palette.join(', ')
    : ''
  const qualityBoost =
    'Best quality, masterpiece, ultra high resolution, 4k, highly detailed, sharp focus, professional fantasy illustration, artbook quality, realistic lighting, high dynamic range, global illumination, fine details, crisp edges, no noise, no blur'
  const portraitLock =
    'Centered head-and-shoulders portrait, looking directly at the viewer, symmetrical composition, face and upper torso only, clean neutral background, suitable for circular avatar crop'
  const styleLock =
    'dark anime style, semi-realistic, cinematic lighting, dramatic shadows, high detail, sharp focus'
  const promptParts = [
    qualityBoost,
    portraitLock,
    styleLock,
    classLayer,
    genderAnchors.prefix,
    bodyAnchors,
    notable,
    clothing,
    palette
  ]
    .filter(Boolean)
  const prompt = `${promptParts.join('. ')}. Appearance description: ${normalized}.`
  const negativePrompt =
    'low quality, worst quality, blurry, noisy, grainy, jpeg artifacts, watermark, text, logo, signature, deformed, bad anatomy, extra fingers, extra limbs, multiple faces, cropped face, out of frame, full body, character sheet, multiple poses, turnarounds, lineup, concept art sheet, reference sheet, standing figure, weapon showcase, scene, environment, background characters' +
    (genderAnchors.negative ? `, ${genderAnchors.negative}` : '')
  return { prompt, negativePrompt }
}

export const computeAppearanceHash = (
  appearance: string | Record<string, any>,
  styleVersion: string = STYLE_VERSION,
  extras: Record<string, any> = {}
) => {
  const normalized = normalizeAppearance(appearance)
  const extraPayload = JSON.stringify(extras)
  const payload = `${normalized}|style:${styleVersion}|extras:${extraPayload}`
  return crypto.createHash('sha256').update(payload).digest('hex')
}

const getNumberEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getAvatarConfig = () => {
  const model = process.env.AVATAR_MODEL || 'flux-2-max'
  const steps = getNumberEnv(process.env.AVATAR_STEPS, 31)
  const guidance = getNumberEnv(process.env.AVATAR_GUIDANCE, 7.5)
  const size = getNumberEnv(process.env.AVATAR_SIZE, 1024)
  const genderModel = process.env.AVATAR_GENDER_MODEL || 'nateraw/age-gender-classification'
  const genderThreshold = getNumberEnv(process.env.AVATAR_GENDER_THRESHOLD, 0.7)
  const genderRetries = Math.max(0, Math.floor(getNumberEnv(process.env.AVATAR_GENDER_RETRIES, 2)))
  const validateGender = process.env.AVATAR_VALIDATE_GENDER !== 'false'
  return {
    model,
    steps,
    guidance,
    size,
    genderModel,
    genderThreshold,
    genderRetries,
    validateGender
  }
}

const computeSeedFromHash = (hash?: string) => {
  if (!hash || hash.length < 8) return undefined
  const seed = Number.parseInt(hash.slice(0, 8), 16)
  if (!Number.isFinite(seed)) return undefined
  return seed % 2147483647
}

// --- HuggingFace provider ---
const generateAvatarPngHuggingFace = async (
  prompt: string,
  negativePrompt: string,
  hash?: string
): Promise<Buffer> => {
  const token = process.env.HF_TOKEN
  if (!token) throw new Error('HF_TOKEN is not configured')

  const { steps, guidance, size } = getAvatarConfig()
  const seed = computeSeedFromHash(hash)

  // SDXL expects size as multiples of 8, min 512
  const clampedSize = Math.max(512, Math.min(1024, Math.round(size / 8) * 8))

  const body: Record<string, any> = {
    inputs: prompt,
    parameters: {
      negative_prompt: negativePrompt || undefined,
      num_inference_steps: steps,
      guidance_scale: guidance,
      width: clampedSize,
      height: clampedSize,
      ...(typeof seed === 'number' ? { seed } : {})
    }
  }

  const hfModel = process.env.HF_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0'
  console.log(`HuggingFace avatar generation: model=${hfModel} size=${clampedSize}`)

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${hfModel}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true'   // don't get 503 if model is loading
      },
      body: JSON.stringify(body)
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`HuggingFace request failed: ${response.status} ${errorText}`)
  }

  const contentType = response.headers.get('content-type') || ''

  // HF returns raw image bytes when the model responds with an image
  if (contentType.startsWith('image/')) {
    const ab = await response.arrayBuffer()
    return Buffer.from(ab)
  }

  // Some models return JSON with base64
  const data = await response.json()
  const base64 = data?.generated_image || data?.image || data?.data?.[0]
  if (base64 && typeof base64 === 'string') {
    const cleaned = base64.includes(',') ? base64.split(',').pop()! : base64
    return Buffer.from(cleaned, 'base64')
  }

  throw new Error(`HuggingFace response did not include image data. content-type=${contentType}`)
}

// --- ModelsLab provider ---
const generateAvatarPngModelsLab = async (
  prompt: string,
  negativePrompt: string,
  hash?: string
): Promise<Buffer> => {
  const token = process.env.MODELSLAB_KEY
  if (!token) throw new Error('MODELSLAB_KEY is not configured')

  const { model, steps, guidance, size } = getAvatarConfig()
  const seed = computeSeedFromHash(hash)
  const negativePromptApplied = Boolean(negativePrompt && negativePrompt.trim())
  console.log('ModelsLab avatar generation config:', { model, steps, size, guidance, seed: typeof seed === 'number' ? seed : 'none' })

  const payload = {
    key: token,
    model_id: model,
    prompt,
    ...(negativePromptApplied ? { negative_prompt: negativePrompt } : {}),
    width: String(size),
    height: String(size),
    samples: '1',
    num_inference_steps: String(steps),
    guidance_scale: guidance,
    enhance_prompt: 'no',
    safety_checker: 'no',
    ...(typeof seed === 'number' ? { seed } : {})
  }

  const response = await fetch(MODELSLAB_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`ModelsLab request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const base64Image =
    data?.output?.[0]?.base64 ||
    data?.output?.[0]?.image ||
    data?.output?.[0] ||
    data?.images?.[0]?.base64 ||
    data?.images?.[0] ||
    data?.image ||
    data?.base64 ||
    data?.data?.[0]

  if (base64Image && typeof base64Image === 'string') {
    const cleaned = base64Image.includes(',') ? base64Image.split(',').pop()! : base64Image
    return Buffer.from(cleaned, 'base64')
  }

  const imageUrl =
    data?.output?.[0]?.url ||
    data?.output?.[0] ||
    data?.images?.[0]?.url ||
    data?.images?.[0] ||
    data?.image_url ||
    data?.data?.[0]

  if (imageUrl && typeof imageUrl === 'string') {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error(`ModelsLab image download failed: ${imageResponse.status}`)
    const ab = await imageResponse.arrayBuffer()
    return Buffer.from(ab)
  }

  const responseKeys = data && typeof data === 'object' ? Object.keys(data) : []
  const status = typeof data?.status === 'string' ? data.status : ''
  const message = typeof data?.message === 'string' ? data.message : ''
  const detail = [status, message].filter(Boolean).join(' ')
  throw new Error(`ModelsLab response did not include image data. keys=${responseKeys.join(',')}${detail ? ` message=${detail}` : ''}`)
}

// --- Public entry point: picks provider based on env ---
export const generateAvatarPng = async (
  prompt: string,
  negativePrompt: string,
  hash?: string
): Promise<Buffer> => {
  const provider = (process.env.AVATAR_PROVIDER || '').toLowerCase()

  if (provider === 'huggingface' || (!provider && process.env.HF_TOKEN && !process.env.MODELSLAB_KEY)) {
    return generateAvatarPngHuggingFace(prompt, negativePrompt, hash)
  }
  if (provider === 'modelslab' || (!provider && process.env.MODELSLAB_KEY)) {
    return generateAvatarPngModelsLab(prompt, negativePrompt, hash)
  }

  throw new Error(
    'No avatar provider configured. Set AVATAR_PROVIDER=huggingface and HF_TOKEN, or AVATAR_PROVIDER=modelslab and MODELSLAB_KEY in backend/.env'
  )
}

const bufferToArrayBuffer = (buffer: Buffer) => {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

export const validateAvatarGender = async (
  pngBuffer: Buffer,
  sex: 'male' | 'female' | 'unknown',
  genderPresentation?: 'masculine' | 'feminine' | 'androgynous' | 'unknown'
) => {
  const { validateGender } = getAvatarConfig()
  if (!validateGender) {
    return { ok: true, reason: 'validation_disabled' }
  }
  if (sex === 'unknown' || genderPresentation === 'androgynous' || genderPresentation === 'unknown') {
    return { ok: true, reason: 'neutral' }
  }
  return { ok: true, reason: 'validation_skipped' }
}

export const getAvatarQualityConfig = () => {
  const { genderModel, genderThreshold, genderRetries, validateGender } = getAvatarConfig()
  return { genderModel, genderThreshold, genderRetries, validateGender }
}

export const saveAvatarPng = (characterId: string, hash: string, pngBuffer: Buffer) => {
  ensureUploadDir()
  const hashPrefix = hash.slice(0, 10)
  const fileName = `${characterId}_${hashPrefix}.png`
  const filePath = path.join(UPLOAD_DIR, fileName)
  fs.writeFileSync(filePath, pngBuffer)
  const avatarUrl = `/uploads/avatars/${fileName}`
  return { avatarUrl, filePath }
}

export const avatarFileExists = (characterId: string, hash: string) => {
  const hashPrefix = hash.slice(0, 10)
  const fileName = `${characterId}_${hashPrefix}.png`
  const filePath = path.join(UPLOAD_DIR, fileName)
  return fs.existsSync(filePath)
}
