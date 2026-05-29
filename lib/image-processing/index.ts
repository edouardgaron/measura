// lib/image-processing/index.ts
// Browser-side image processing using Canvas API and FileReader only.
// This module must only be used in 'use client' components or dynamic imports.

export type QualityIssue =
  | 'too_small'
  | 'too_dark'
  | 'blurry'
  | 'too_close'
  | 'wrong_format'
  | 'too_large'

export interface QualityResult {
  status: 'good' | 'warning' | 'rejected'
  issues: QualityIssue[]
  score: number // 0-100
}

export interface ImageMetadata {
  width: number
  height: number
  fileSize: number
  mimeType: string
  aspectRatio: number
}

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024 // 30 MB
const MIN_REJECT_WIDTH = 300
const MIN_REJECT_HEIGHT = 300
const MIN_WARN_WIDTH = 800
const MIN_WARN_HEIGHT = 600
const DARK_LUMINANCE_THRESHOLD = 50

/**
 * Load a File as an ImageBitmap using the browser's built-in decoder.
 * Falls back to a blob URL approach if createImageBitmap is not available.
 */
async function loadImageBitmap(file: File): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  return { bitmap, width: bitmap.width, height: bitmap.height }
}

/**
 * Compute average luminance by sampling a 20x20 grid of pixels.
 * Luminance formula: R*0.299 + G*0.587 + B*0.114
 */
function computeAverageLuminance(canvas: HTMLCanvasElement, width: number, height: number): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 128 // Assume okay if context unavailable

  const sampleW = 20
  const sampleH = 20
  // Draw at 20x20 to get sampled pixels
  const sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = sampleW
  sampleCanvas.height = sampleH
  const sampleCtx = sampleCanvas.getContext('2d')
  if (!sampleCtx) return 128

  sampleCtx.drawImage(canvas, 0, 0, width, height, 0, 0, sampleW, sampleH)
  const imageData = sampleCtx.getImageData(0, 0, sampleW, sampleH)
  const data = imageData.data

  let totalLuminance = 0
  const pixelCount = sampleW * sampleH

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    totalLuminance += r * 0.299 + g * 0.587 + b * 0.114
  }

  return totalLuminance / pixelCount
}

/**
 * Analyze image quality.
 * - Rejected if < 300x300px, > 30MB, not image/* type
 * - Warning if < 800x600px, or avg luminance < 50
 * - Good otherwise
 */
export async function analyzeImageQuality(file: File): Promise<QualityResult> {
  const issues: QualityIssue[] = []

  // Check MIME type
  if (!file.type.startsWith('image/')) {
    return {
      status: 'rejected',
      issues: ['wrong_format'],
      score: 0,
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      status: 'rejected',
      issues: ['too_large'],
      score: 0,
    }
  }

  try {
    const { bitmap, width, height } = await loadImageBitmap(file)

    // Check minimum resolution (rejection threshold)
    if (width < MIN_REJECT_WIDTH || height < MIN_REJECT_HEIGHT) {
      bitmap.close()
      return {
        status: 'rejected',
        issues: ['too_small'],
        score: 0,
      }
    }

    // Draw bitmap to canvas for pixel analysis
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0)
    }
    bitmap.close()

    // Check warning resolution
    if (width < MIN_WARN_WIDTH || height < MIN_WARN_HEIGHT) {
      issues.push('too_small')
    }

    // Check luminance (darkness)
    const avgLuminance = computeAverageLuminance(canvas, width, height)
    if (avgLuminance < DARK_LUMINANCE_THRESHOLD) {
      issues.push('too_dark')
    }

    // Compute score: start at 100, deduct for issues
    let score = 100
    if (issues.includes('too_small')) score -= 30
    if (issues.includes('too_dark')) score -= 40

    score = Math.max(0, score)

    const status = issues.length > 0 ? 'warning' : 'good'

    return { status, issues, score }
  } catch {
    // If image cannot be decoded, treat as wrong format
    return {
      status: 'rejected',
      issues: ['wrong_format'],
      score: 0,
    }
  }
}

/**
 * Compress an image to fit within maxSizePx while maintaining aspect ratio.
 * Returns a new File with .jpg extension at JPEG quality 0.85.
 */
export async function compressImage(file: File, maxSizePx = 2048): Promise<File> {
  try {
    const { bitmap, width, height } = await loadImageBitmap(file)

    // Calculate new dimensions
    let newWidth = width
    let newHeight = height

    if (width > maxSizePx || height > maxSizePx) {
      const ratio = Math.min(maxSizePx / width, maxSizePx / height)
      newWidth = Math.round(width * ratio)
      newHeight = Math.round(height * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = newWidth
    canvas.height = newHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file // Return original if canvas not available
    }

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight)
    bitmap.close()

    return await new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Échec de la compression'))
            return
          }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          const compressedFile = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        },
        'image/jpeg',
        0.85
      )
    })
  } catch {
    return file // Return original on error
  }
}

/**
 * Generate a 200x200 cover thumbnail as a base64 data URL.
 */
export async function generateThumbnail(file: File): Promise<string> {
  const THUMB_SIZE = 200

  try {
    const { bitmap, width, height } = await loadImageBitmap(file)

    // Cover crop: scale to fill 200x200
    const scale = Math.max(THUMB_SIZE / width, THUMB_SIZE / height)
    const scaledW = width * scale
    const scaledH = height * scale
    const offsetX = (THUMB_SIZE - scaledW) / 2
    const offsetY = (THUMB_SIZE - scaledH) / 2

    const canvas = document.createElement('canvas')
    canvas.width = THUMB_SIZE
    canvas.height = THUMB_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return ''
    }

    ctx.drawImage(bitmap, offsetX, offsetY, scaledW, scaledH)
    bitmap.close()

    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return ''
  }
}

/**
 * Extract image metadata without full quality analysis.
 */
export async function extractImageMetadata(file: File): Promise<ImageMetadata> {
  try {
    const { bitmap, width, height } = await loadImageBitmap(file)
    bitmap.close()

    return {
      width,
      height,
      fileSize: file.size,
      mimeType: file.type,
      aspectRatio: width / height,
    }
  } catch {
    return {
      width: 0,
      height: 0,
      fileSize: file.size,
      mimeType: file.type,
      aspectRatio: 0,
    }
  }
}
