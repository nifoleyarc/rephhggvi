import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import fetch from 'node-fetch'

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.IMAGE_MAX_UPLOAD_MB || '20', 10)
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

const STORAGE_ROOT = path.resolve(
  process.env.IMAGE_STORAGE_ROOT || path.join(process.cwd(), 'storage', 'images')
)

const CDN_BASE_URL = (process.env.IMAGE_CDN_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const IMAGES_PUBLIC_PATH = normalizePath(process.env.IMAGE_PUBLIC_PATH || '/images')
const IMAGINARY_RESIZE_PATH = process.env.IMAGINARY_RESIZE_PATH || '/cdn/resize'

const DEFAULT_PREVIEW_WIDTH = parseInt(process.env.IMAGE_PREVIEW_WIDTH || '320', 10)
const DEFAULT_CARD_WIDTH = parseInt(process.env.IMAGE_CARD_WIDTH || '640', 10)
const DEFAULT_FULL_WIDTH = parseInt(process.env.IMAGE_FULL_WIDTH || '1280', 10)
const DEFAULT_QUALITY = parseInt(process.env.IMAGE_DEFAULT_QUALITY || '85', 10)
const DEFAULT_FORMAT = (process.env.IMAGE_DEFAULT_FORMAT || 'webp').toLowerCase()

const ALLOWED_FORMATS = new Set(
  (process.env.IMAGE_ALLOWED_FORMATS || 'jpeg,jpg,png,webp')
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)
)

const IMAGE_TIMEOUT_MS = parseInt(process.env.IMAGE_DOWNLOAD_TIMEOUT_MS || '20000', 10)

function normalizePath(rawPath) {
  if (!rawPath) return '/images'
  let normalized = rawPath.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  return normalized.replace(/\/+$/, '') || '/'
}

function getImagesBaseUrl() {
  return `${CDN_BASE_URL}${IMAGES_PUBLIC_PATH === '/' ? '' : IMAGES_PUBLIC_PATH}`
}

function getImaginaryBaseUrl() {
  if (IMAGINARY_RESIZE_PATH.startsWith('http://') || IMAGINARY_RESIZE_PATH.startsWith('https://')) {
    return IMAGINARY_RESIZE_PATH
  }
  const prefix = IMAGINARY_RESIZE_PATH.startsWith('/') ? '' : '/'
  return `${CDN_BASE_URL}${prefix}${IMAGINARY_RESIZE_PATH}`
}

function normalizeFormat(format) {
  if (!format) return null
  if (format.toLowerCase() === 'jpeg') return 'jpg'
  return format.toLowerCase()
}

function buildRelativePath(extension) {
  const now = new Date()
  const segments = [
    now.getUTCFullYear().toString(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0')
  ]
  const filename = `${crypto.randomUUID()}.${extension}`
  return [...segments, filename].join('/')
}

function resolveStoragePath(relativePath) {
  const safePath = relativePath.replace(/\\/g, '/').split('/').filter(Boolean)
  return path.join(STORAGE_ROOT, ...safePath)
}

async function ensureDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

function buildImaginaryUrl(relativePath, overrides = {}) {
  const target = new URL(getImaginaryBaseUrl())
  const params = new URLSearchParams()
  const defaults = {
    url: `${getImagesBaseUrl()}/${relativePath}`,
    width: overrides.width,
    height: overrides.height ?? 0,
    type: overrides.type || DEFAULT_FORMAT,
    quality: overrides.quality ?? DEFAULT_QUALITY,
    stripmeta: overrides.stripmeta ?? 1,
    progressive: overrides.progressive ?? 1,
    enlarge: overrides.enlarge ?? 0,
    fit: overrides.fit,
    crop: overrides.crop,
    gravity: overrides.gravity,
    sharpen: overrides.sharpen
  }

  Object.entries(defaults).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, value.toString())
  })

  target.search = params.toString()
  return target.toString()
}

export function buildVariantUrls(relativePath) {
  if (!relativePath) return null
  return {
    original: `${getImagesBaseUrl()}/${relativePath}`,
    preview: buildImaginaryUrl(relativePath, { width: DEFAULT_PREVIEW_WIDTH }),
    card: buildImaginaryUrl(relativePath, { width: DEFAULT_CARD_WIDTH }),
    full: buildImaginaryUrl(relativePath, {
      width: DEFAULT_FULL_WIDTH,
      quality: Math.min(DEFAULT_QUALITY + 5, 95)
    })
  }
}

function buildThumbnailPayload(relativePath, metadata = {}) {
  const variants = buildVariantUrls(relativePath)
  return {
    url: metadata.urlOverride || variants.card,
    publicId: relativePath,
    source: 'local',
    originalUrl: variants.original,
    variants,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format ?? null,
    bytes: metadata.bytes ?? null,
    createdAt: metadata.createdAt || new Date().toISOString()
  }
}

async function analyzeImage(buffer) {
  const metadata = await sharp(buffer).metadata()
  const format = normalizeFormat(metadata.format)

  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new Error(`Недопустимый формат изображения: ${metadata.format}`)
  }

  return {
    width: metadata.width || null,
    height: metadata.height || null,
    format,
    bytes: buffer.length
  }
}

async function persistBuffer(buffer, { originalName = 'upload', context = {} } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Буфер изображения не передан')
  }

  if (buffer.length === 0) {
    throw new Error('Пустой файл изображения')
  }

  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`Разрешённый размер превышен (${MAX_UPLOAD_SIZE_MB}MB)`)
  }

  const metadata = await analyzeImage(buffer)
  const relativePath = buildRelativePath(metadata.format)
  const absolutePath = resolveStoragePath(relativePath)

  await ensureDirectory(absolutePath)
  await fs.writeFile(absolutePath, buffer)

  console.log(`💾 Изображение сохранено: ${relativePath} (${originalName})`)

  return buildThumbnailPayload(relativePath, {
    ...metadata,
    context,
    originalName
  })
}

async function downloadImageBuffer(imageUrl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)

  try {
    const response = await fetch(imageUrl, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`Ошибка загрузки изображения: HTTP ${response.status}`)
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error(`Размер файла превышает ${MAX_UPLOAD_SIZE_MB}MB`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error(`Размер файла превышает ${MAX_UPLOAD_SIZE_MB}MB`)
    }

    return buffer
  } finally {
    clearTimeout(timeout)
  }
}

export async function saveRemoteImage(imageUrl, context = {}) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('URL изображения не указан')
  }

  console.log(`🌐 Скачивание изображения: ${imageUrl}`)
  const buffer = await downloadImageBuffer(imageUrl)
  let inferredName = 'remote'
  try {
    inferredName = new URL(imageUrl).pathname.split('/').pop() || 'remote'
  } catch (error) {
    // игнорируем ошибки парсинга URL
  }
  return persistBuffer(buffer, {
    originalName: context.originalName || inferredName,
    context: { ...context, remoteUrl: imageUrl }
  })
}

export async function saveUploadedImage(buffer, originalName, context = {}) {
  return persistBuffer(buffer, {
    originalName: originalName || 'upload',
    context
  })
}

export async function deleteStoredImage(publicId) {
  if (!publicId) return false
  const absolutePath = resolveStoragePath(publicId)

  try {
    await fs.unlink(absolutePath)
    console.log(`🗑️ Файл удалён: ${publicId}`)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️ Файл уже отсутствует: ${publicId}`)
      return false
    }
    console.error(`❌ Ошибка удаления файла ${publicId}:`, error)
    return false
  }
}

export function extractRelativePathFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null

  try {
    if (rawUrl.startsWith('http')) {
      const parsed = new URL(rawUrl)
      const normalizedImagesPath = IMAGES_PUBLIC_PATH === '/' ? '/' : `${IMAGES_PUBLIC_PATH}/`

      if (parsed.pathname.includes(normalizedImagesPath)) {
        return parsed.pathname
          .substring(parsed.pathname.indexOf(normalizedImagesPath) + normalizedImagesPath.length)
          .replace(/^\/+/, '')
      }

      const embeddedUrl = parsed.searchParams.get('url')
      if (embeddedUrl) {
        return extractRelativePathFromUrl(embeddedUrl)
      }
    } else if (rawUrl.startsWith(IMAGES_PUBLIC_PATH)) {
      return rawUrl.replace(IMAGES_PUBLIC_PATH, '').replace(/^\/+/, '')
    } else if (rawUrl.startsWith('/')) {
      const normalizedImagesPath = IMAGES_PUBLIC_PATH === '/' ? '/' : `${IMAGES_PUBLIC_PATH}/`
      if (rawUrl.startsWith(normalizedImagesPath)) {
        return rawUrl.replace(normalizedImagesPath, '').replace(/^\/+/, '')
      }
    } else if (!rawUrl.includes('://')) {
      return rawUrl
    }
  } catch (error) {
    console.error('Не удалось извлечь относительный путь из URL', rawUrl, error.message)
    return null
  }

  return null
}

export function buildThumbnailFromPublicId(publicId, overrides = {}) {
  if (!publicId) return null
  const variants = buildVariantUrls(publicId)
  return {
    url: overrides.url || variants.card,
    publicId,
    source: overrides.source || 'local',
    originalUrl: variants.original,
    variants,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    format: overrides.format ?? null,
    bytes: overrides.bytes ?? null
  }
}

export function checkImageStorageConfig() {
  const missing = []

  if (!process.env.IMAGE_CDN_BASE_URL) {
    missing.push('IMAGE_CDN_BASE_URL')
  }

  if (!process.env.IMAGE_STORAGE_ROOT) {
    console.warn('⚠️ IMAGE_STORAGE_ROOT не задан, используем локальную директорию storage/images')
  }

  return {
    ok: missing.length === 0,
    missing,
    storageRoot: STORAGE_ROOT,
    cdnBaseUrl: CDN_BASE_URL,
    imagesPath: IMAGES_PUBLIC_PATH,
  }
}

export function enrichThumbnailFromRow(streamRow) {
  if (!streamRow) return null

  if (streamRow.thumbnail_public_id) {
    return buildThumbnailFromPublicId(streamRow.thumbnail_public_id, {
      url: streamRow.thumbnail_url,
      width: streamRow.thumbnail_width,
      height: streamRow.thumbnail_height,
      format: streamRow.thumbnail_format,
      bytes: streamRow.thumbnail_bytes,
      source: streamRow.thumbnail_source || 'local'
    })
  }

  if (streamRow.thumbnail_url) {
    return {
      url: streamRow.thumbnail_url,
      source: streamRow.thumbnail_source || 'external'
    }
  }

  return null
}

