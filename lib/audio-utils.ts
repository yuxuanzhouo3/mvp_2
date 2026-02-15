// 同步线性插值重采样到 16kHz
export function resampleTo16kSync(audioData: Float32Array, originalSampleRate: number): Float32Array {
  if (originalSampleRate === 16000) return audioData

  const targetSampleRate = 16000
  const ratio = originalSampleRate / targetSampleRate
  const outputLength = Math.floor(audioData.length / ratio)
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1)
    const fraction = srcIndex - srcIndexFloor

    // 线性插值
    output[i] = audioData[srcIndexFloor] * (1 - fraction) + audioData[srcIndexCeil] * fraction
  }

  return output
}

// 将 Float32 音频数据编码为 PCM16LE 格式
export function encodeFloat32ToPcm16le(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  let offset = 0
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true)
    offset += 2
  }
  return buffer
}

// 计算音频 RMS (均方根) 值，用于检测静音
export function calculateRMS(audioData: Float32Array): number {
  let sum = 0
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i]
  }
  return Math.sqrt(sum / audioData.length)
}
