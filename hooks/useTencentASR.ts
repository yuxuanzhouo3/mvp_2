import { useCallback, useRef, useState } from "react"
import { encodeFloat32ToPcm16le, resampleTo16kSync } from "@/lib/audio-utils"

interface UseTencentASROptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
  language?: string
}

interface TencentAsrMessage {
  code?: number
  message?: string
  final?: number
  result?: {
    slice_type?: number
    index?: number
    voice_text_str?: string
  }
  slice_type?: number
  index?: number
  voice_text_str?: string
}

const TARGET_SAMPLE_RATE = 16000
const CHUNK_DURATION_MS = 200
const TARGET_CHUNK_BYTES = TARGET_SAMPLE_RATE * (CHUNK_DURATION_MS / 1000) * 2
const PREOPEN_BUFFER_MAX_CHUNKS = 10
const CLEANUP_DELAY_MS = 300
const MAX_SESSION_MS = 60000
const RECONNECT_DELAY_MS = 180

const ENDING_PUNCTUATION = new Set(["。", "！", "？", "，", ".", "!", "?", ",", "；", ";", "：", ":"])

function sanitizeTranscriptText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function appendPunctuationIfNeeded(text: string): string {
  const normalized = text.trim()
  if (!normalized) {
    return normalized
  }

  const lastChar = normalized.slice(-1)
  if (ENDING_PUNCTUATION.has(lastChar)) {
    return normalized
  }

  const hasCjk = /[\u4e00-\u9fff]/.test(normalized)
  return hasCjk ? `${normalized}。` : `${normalized}.`
}

function resolveEngineModelType(language: string): string {
  const envModel = process.env.NEXT_PUBLIC_TENCENT_ASR_ENGINE_MODEL?.trim()
  if (envModel) {
    return envModel
  }

  if (language.startsWith("zh")) {
    return "16k_zh"
  }

  if (language.startsWith("en")) {
    return "16k_en"
  }

  return "16k_zh"
}

function safeParseAsrMessage(raw: string): TencentAsrMessage | null {
  try {
    return JSON.parse(raw) as TencentAsrMessage
  } catch {
    return null
  }
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length === 0) {
    return right
  }

  if (right.length === 0) {
    return left
  }

  const merged = new Uint8Array(left.length + right.length)
  merged.set(left)
  merged.set(right, left.length)
  return merged
}

function getAsrMessageText(message: TencentAsrMessage): string {
  return message.result?.voice_text_str ?? message.voice_text_str ?? ""
}

function getAsrSliceType(message: TencentAsrMessage): number | undefined {
  return message.result?.slice_type ?? message.slice_type
}

function getAsrResultIndex(message: TencentAsrMessage): number | undefined {
  return message.result?.index ?? message.index
}

export function useTencentASR({ onTranscript, onError, language = "zh-CN" }: UseTencentASROptions) {
  const [isActive, setIsActive] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const sinkNodeRef = useRef<GainNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const isReadyRef = useRef(false)
  const isShuttingDownRef = useRef(false)
  const shouldKeepListeningRef = useRef(false)
  const stopReasonRef = useRef<"manual" | "socket" | "rollover" | null>(null)

  const pendingAudioRef = useRef<Uint8Array>(new Uint8Array(0))
  const preOpenAudioChunksRef = useRef<Uint8Array[]>([])
  const shutdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousInterimTextRef = useRef("")
  const finalizedIndexSetRef = useRef<Set<number>>(new Set())

  const clearShutdownTimer = useCallback(() => {
    if (shutdownTimerRef.current) {
      clearTimeout(shutdownTimerRef.current)
      shutdownTimerRef.current = null
    }
  }, [])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
  }, [])

  const resetRuntimeState = useCallback(() => {
    pendingAudioRef.current = new Uint8Array(0)
    preOpenAudioChunksRef.current = []
    previousInterimTextRef.current = ""
    finalizedIndexSetRef.current = new Set()
  }, [])

  const cleanup = useCallback(() => {
    clearShutdownTimer()
    clearSessionTimer()

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect()
      } catch (error) {
        console.error("断开音频源节点失败:", error)
      }
      sourceNodeRef.current = null
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.onaudioprocess = null
        scriptProcessorRef.current.disconnect()
      } catch (error) {
        console.error("断开音频处理器失败:", error)
      }
      scriptProcessorRef.current = null
    }

    if (sinkNodeRef.current) {
      try {
        sinkNodeRef.current.disconnect()
      } catch (error) {
        console.error("断开音频输出节点失败:", error)
      }
      sinkNodeRef.current = null
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (error) {
        console.error("关闭 AudioContext 失败:", error)
      }
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (wsRef.current) {
      try {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close()
      } catch (error) {
        console.error("关闭 WebSocket 失败:", error)
      }
      wsRef.current = null
    }

    isReadyRef.current = false
    isShuttingDownRef.current = false
    stopReasonRef.current = null
    resetRuntimeState()
    setIsActive(shouldKeepListeningRef.current)
  }, [clearSessionTimer, clearShutdownTimer, resetRuntimeState])

  const flushPendingAudio = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }

    const pending = pendingAudioRef.current
    if (pending.length === 0) {
      return
    }

    const payload = pending.buffer.slice(pending.byteOffset, pending.byteOffset + pending.byteLength)
    ws.send(payload)
    pendingAudioRef.current = new Uint8Array(0)
  }, [])

  const sendEndMessage = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      flushPendingAudio()
      ws.send(JSON.stringify({ type: "end" }))
    } catch (error) {
      console.error("发送结束消息失败:", error)
    }
  }, [flushPendingAudio])

  const appendAudioChunk = useCallback((chunk: Uint8Array) => {
    const ws = wsRef.current
    if (!ws) {
      return
    }

    if (ws.readyState !== WebSocket.OPEN) {
      preOpenAudioChunksRef.current.push(chunk)
      if (preOpenAudioChunksRef.current.length > PREOPEN_BUFFER_MAX_CHUNKS) {
        preOpenAudioChunksRef.current.shift()
      }
      return
    }

    if (preOpenAudioChunksRef.current.length > 0) {
      for (const buffered of preOpenAudioChunksRef.current) {
        pendingAudioRef.current = concatBytes(pendingAudioRef.current, buffered)
      }
      preOpenAudioChunksRef.current = []
    }

    pendingAudioRef.current = concatBytes(pendingAudioRef.current, chunk)

    while (pendingAudioRef.current.length >= TARGET_CHUNK_BYTES) {
      const frame = pendingAudioRef.current.slice(0, TARGET_CHUNK_BYTES)
      ws.send(frame.buffer)
      pendingAudioRef.current = pendingAudioRef.current.slice(TARGET_CHUNK_BYTES)
    }
  }, [])

  const startRef = useRef<() => void>(() => {})

  const scheduleReconnect = useCallback(() => {
    clearReconnectTimer()

    if (!shouldKeepListeningRef.current || isShuttingDownRef.current) {
      return
    }

    reconnectTimerRef.current = setTimeout(() => {
      if (!shouldKeepListeningRef.current || isShuttingDownRef.current || isActive) {
        return
      }

      startRef.current()
    }, RECONNECT_DELAY_MS)
  }, [clearReconnectTimer, isActive])

  const stop = useCallback(() => {
    shouldKeepListeningRef.current = false
    clearReconnectTimer()
    setIsActive(false)

    if (isShuttingDownRef.current) {
      return
    }

    isShuttingDownRef.current = true
    stopReasonRef.current = "manual"

    sendEndMessage()
    clearShutdownTimer()
    shutdownTimerRef.current = setTimeout(() => {
      cleanup()
    }, CLEANUP_DELAY_MS)
  }, [cleanup, clearReconnectTimer, clearShutdownTimer, sendEndMessage])

  const start = useCallback(async () => {
    shouldKeepListeningRef.current = true
    setIsActive(true)

    if (isActive || isShuttingDownRef.current) {
      return
    }

    try {
      resetRuntimeState()

      const engineModelType = resolveEngineModelType(language)
      const query = new URLSearchParams({
        engineModelType,
        voiceFormat: "1",
        needVad: "1",
        vadSilenceTime: "700",
        maxSpeakTime: "60000",
        filterModal: "1",
        filterDirty: "0",
        filterPunc: "0",
        convertNumMode: "1",
      })
      const response = await fetch(`/api/asr/realtime?${query.toString()}`)

      if (!response.ok) {
        throw new Error("获取腾讯云 ASR 签名失败")
      }

      const body = (await response.json()) as { url?: string }
      if (!body.url) {
        throw new Error("腾讯云 ASR 签名地址为空")
      }

      const ws = new WebSocket(body.url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[ASR] WebSocket 连接成功")
        isReadyRef.current = true
        stopReasonRef.current = null

        if (preOpenAudioChunksRef.current.length > 0) {
          for (const buffered of preOpenAudioChunksRef.current) {
            appendAudioChunk(buffered)
          }
          preOpenAudioChunksRef.current = []
        }

        clearSessionTimer()
        sessionTimerRef.current = setTimeout(() => {
          if (!shouldKeepListeningRef.current) {
            return
          }

          stopReasonRef.current = "rollover"
          sendEndMessage()
          clearShutdownTimer()
          shutdownTimerRef.current = setTimeout(() => {
            cleanup()
            scheduleReconnect()
          }, CLEANUP_DELAY_MS)
        }, MAX_SESSION_MS)
      }

      ws.onmessage = (event) => {
        const message = safeParseAsrMessage(String(event.data))
        if (!message) {
          return
        }

        if (typeof message.code === "number" && message.code !== 0) {
          onError(message.message || `语音识别失败，错误码：${message.code}`)

          if (shouldKeepListeningRef.current && stopReasonRef.current !== "manual") {
            cleanup()
            scheduleReconnect()
            return
          }

          cleanup()
          return
        }

        if (message.final === 1) {
          const reason = stopReasonRef.current
          cleanup()

          if (shouldKeepListeningRef.current && reason !== "manual") {
            scheduleReconnect()
          }
          return
        }

        const sliceType = getAsrSliceType(message)
        const index = getAsrResultIndex(message)
        const normalizedText = sanitizeTranscriptText(getAsrMessageText(message))

        if (!normalizedText) {
          return
        }

        if (sliceType === 0) {
          previousInterimTextRef.current = ""
          return
        }

        if (sliceType === 1) {
          if (previousInterimTextRef.current === normalizedText) {
            return
          }

          previousInterimTextRef.current = normalizedText
          onTranscript(normalizedText, false)
          return
        }

        if (sliceType === 2) {
          if (typeof index === "number") {
            if (finalizedIndexSetRef.current.has(index)) {
              return
            }
            finalizedIndexSetRef.current.add(index)
          }

          previousInterimTextRef.current = ""
          onTranscript(appendPunctuationIfNeeded(normalizedText), true)
          return
        }

        onTranscript(normalizedText, false)
      }

      ws.onerror = (error) => {
        console.error("[ASR] WebSocket 错误:", error)
        onError("语音识别连接异常")
        stopReasonRef.current = "socket"
      }

      ws.onclose = () => {
        console.log("[ASR] WebSocket 已关闭")

        const reason = stopReasonRef.current
        const isManual = reason === "manual"
        cleanup()

        if (!isManual && shouldKeepListeningRef.current) {
          scheduleReconnect()
          return
        }

        if (!isManual && reason !== "rollover") {
          onError("语音识别连接已断开")
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ latencyHint: "interactive" })
      audioContextRef.current = audioContext

      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume()
        } catch (error) {
          console.error("恢复 AudioContext 失败:", error)
        }
      }

      const sourceNode = audioContext.createMediaStreamSource(stream)
      sourceNodeRef.current = sourceNode

      const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1)
      scriptProcessorRef.current = scriptProcessor

      const sinkNode = audioContext.createGain()
      sinkNode.gain.value = 0
      sinkNodeRef.current = sinkNode

      scriptProcessor.onaudioprocess = (audioEvent) => {
        const wsClient = wsRef.current
        if (!isReadyRef.current || !wsClient || wsClient.readyState !== WebSocket.OPEN) {
          return
        }

        const inputData = audioEvent.inputBuffer.getChannelData(0)

        try {
          const resampledData = resampleTo16kSync(inputData, audioContext.sampleRate)
          const pcmData = encodeFloat32ToPcm16le(resampledData)
          appendAudioChunk(new Uint8Array(pcmData))
        } catch (error) {
          console.error("编码或发送音频分片失败:", error)
        }
      }

      sourceNode.connect(scriptProcessor)
      scriptProcessor.connect(sinkNode)
      sinkNode.connect(audioContext.destination)

      setIsActive(true)
    } catch (error) {
      console.error("启动腾讯云 ASR 失败:", error)
      onError(error instanceof Error ? error.message : "启动语音识别失败")

      const keepListening = shouldKeepListeningRef.current
      cleanup()
      if (keepListening) {
        scheduleReconnect()
      }
    }
  }, [appendAudioChunk, cleanup, clearSessionTimer, clearShutdownTimer, isActive, language, onError, onTranscript, resetRuntimeState, scheduleReconnect, sendEndMessage])

  startRef.current = start

  return {
    isActive,
    start,
    stop,
  }
}
