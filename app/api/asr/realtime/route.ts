import { createHmac, randomUUID } from "crypto"
import process from "process"

export const runtime = "nodejs"

function resolveEnvValue(key: string, tencentKey: string): string | undefined {
  const env = process.env as Record<string, string | undefined>
  return env[tencentKey] ?? env[key]
}

function getSearchValue(searchParams: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = searchParams.get(key)
    if (value !== null) {
      return value
    }
  }
  return null
}

function parseIntParam(
  searchParams: URLSearchParams,
  keys: string[],
  options: { min?: number; max?: number } = {},
): number | undefined {
  const raw = getSearchValue(searchParams, keys)
  if (raw === null) {
    return undefined
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  const rounded = Math.round(parsed)
  if (typeof options.min === "number" && rounded < options.min) {
    return undefined
  }

  if (typeof options.max === "number" && rounded > options.max) {
    return undefined
  }

  return rounded
}

function buildSignature(params: Record<string, string | number>, appId: string, secretKey: string): string {
  const keys = Object.keys(params).sort()
  const query = keys.map((key) => `${key}=${params[key]}`).join("&")
  const source = `asr.cloud.tencent.com/asr/v2/${appId}?${query}`
  const signature = createHmac("sha1", secretKey).update(source).digest("base64")
  return `wss://${source}&signature=${encodeURIComponent(signature)}`
}

export async function GET(req: Request) {
  try {
    const appId = resolveEnvValue("ASR_APP_ID", "TENCENT_ASR_APP_ID")
    const secretId = resolveEnvValue("ASR_SECRET_ID", "TENCENT_ASR_SECRET_ID")
    const secretKey = resolveEnvValue("ASR_SECRET_KEY", "TENCENT_ASR_SECRET_KEY")

    if (!appId || !secretId || !secretKey) {
      return Response.json({ error: "Missing Tencent ASR credentials" }, { status: 500 })
    }

    const url = new URL(req.url)
    const searchParams = url.searchParams
    const defaultEngineModel = resolveEnvValue("ASR_ENGINE_MODEL", "TENCENT_ASR_ENGINE_MODEL")?.trim()
    const engineModelType = searchParams.get("engineModelType")?.trim() || defaultEngineModel || "16k_zh"
    const voiceFormatRaw = Number(searchParams.get("voiceFormat") ?? 1)
    const needVadRaw = Number(searchParams.get("needVad") ?? 1)
    const supportedVoiceFormats = new Set([1, 4, 6, 8, 10, 12, 14, 16])
    const voiceFormat = Number.isFinite(voiceFormatRaw) && supportedVoiceFormats.has(Math.round(voiceFormatRaw))
      ? Math.round(voiceFormatRaw)
      : 1
    const needVad = needVadRaw === 0 ? 0 : 1

    const vadSilenceTime = parseIntParam(searchParams, ["vadSilenceTime", "vad_silence_time"], { min: 500, max: 2000 })
    const maxSpeakTime = parseIntParam(searchParams, ["maxSpeakTime", "max_speak_time"], { min: 5000, max: 90000 })
    const filterModal = parseIntParam(searchParams, ["filterModal", "filter_modal"], { min: 0, max: 2 })
    const filterDirty = parseIntParam(searchParams, ["filterDirty", "filter_dirty"], { min: 0, max: 2 })
    const filterPunc = parseIntParam(searchParams, ["filterPunc", "filter_punc"], { min: 0, max: 1 })
    const filterEmptyResult = parseIntParam(searchParams, ["filterEmptyResult", "filter_empty_result"], { min: 0, max: 1 })
    const convertNumMode = parseIntParam(searchParams, ["convertNumMode", "convert_num_mode"], { min: 0, max: 3 })
    const wordInfo = parseIntParam(searchParams, ["wordInfo", "word_info"], { min: 0, max: 100 })

    const timestamp = Math.floor(Date.now() / 1000)
    const expired = timestamp + 60 * 60
    const nonce = Math.floor(Math.random() * 10 ** 10)
    const voiceId = randomUUID()

    const params: Record<string, string | number> = {
      engine_model_type: engineModelType,
      expired,
      needvad: needVad,
      nonce,
      secretid: secretId,
      timestamp,
      voice_format: voiceFormat,
      voice_id: voiceId,
    }

    if (typeof vadSilenceTime === "number") {
      params.vad_silence_time = vadSilenceTime
    }

    if (typeof maxSpeakTime === "number") {
      params.max_speak_time = maxSpeakTime
    }

    if (typeof filterModal === "number") {
      params.filter_modal = filterModal
    }

    if (typeof filterDirty === "number") {
      params.filter_dirty = filterDirty
    }

    if (typeof filterPunc === "number") {
      params.filter_punc = filterPunc
    }

    if (typeof filterEmptyResult === "number") {
      params.filter_empty_result = filterEmptyResult
    }

    if (typeof convertNumMode === "number") {
      params.convert_num_mode = convertNumMode
    }

    if (typeof wordInfo === "number") {
      params.word_info = wordInfo
    }

    const signedUrl = buildSignature(params, appId, secretKey)

    return Response.json({
      url: signedUrl,
      voiceId,
      timestamp,
      expired,
      engineModelType,
      voiceFormat,
    })
  } catch (error) {
    console.error("[ASR] Tencent realtime ASR error:", error)
    return Response.json({ error: "Failed to create realtime ASR signature" }, { status: 500 })
  }
}
