import {
  saveRemoteImage,
  deleteStoredImage,
  checkImageStorageConfig,
  extractRelativePathFromUrl,
  buildThumbnailFromPublicId
} from './imageStorage.js'

/**
 * Генерирует превью для стрима из Telegram URL
 * @param {string} telegramUrl - URL поста в Telegram
 * @param {number} retries - Количество попыток
 * @returns {Promise<object|null>} - Объект с данными о превью или null
 */
export async function generateThumbnailFromTelegramUrl(telegramUrl, retries = 3) {
  console.log(`🖼️ Генерация превью для: ${telegramUrl}`)

  const storageStatus = checkImageStorageConfig()
  if (!storageStatus.ok) {
    console.error('❌ Хранилище изображений не настроено:', storageStatus.missing.join(', '))
    return null
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   🔄 Попытка ${attempt}/${retries}`)

      if (attempt > 1) {
        const delay = 1000 * attempt
        console.log(`   ⏳ Задержка ${delay}мс`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const imageUrl = await extractImageFromTelegramUrl(telegramUrl)

      if (!imageUrl) {
        console.log(`   ⚠️ Изображение не найдено (попытка ${attempt})`)
        if (attempt === retries) return null
        continue
      }

      console.log(`   ✅ Найдено изображение: ${imageUrl}`)

      const storedThumbnail = await saveRemoteImage(imageUrl, {
        reason: 'telegram-preview',
        telegramUrl,
        attempt
      })

      console.log('   🎉 Превью сохранено локально')
      return {
        ...storedThumbnail,
        telegramUrl,
        originalUrl: storedThumbnail.originalUrl,
        source: 'local',
        createdAt: new Date()
      }
    } catch (error) {
      console.error(`   ❌ Ошибка генерации превью (попытка ${attempt}): ${error.message}`)
      if (attempt === retries) {
        return null
      }
    }
  }

  return null
}

/**
 * Извлекает URL изображения из Telegram страницы
 * @param {string} telegramUrl - URL поста в Telegram
 * @returns {Promise<string|null>} - URL изображения или null
 */
async function extractImageFromTelegramUrl(telegramUrl) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 секунд таймаут
  
  try {
    const response = await fetch(telegramUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.log(`   ❌ HTTP ошибка: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // Ищем Open Graph изображения с различными паттернами
    const patterns = [
      /<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i,
      /<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\'][^>]*>/i,
      /<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i,
      /<meta[^>]*name=["\']twitter:image:src["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i,
      /<meta[^>]*property=["\']og:image:url["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i,
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        let imageUrl = match[1]
        
        // Нормализуем URL
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl
        } else if (imageUrl.startsWith('/')) {
          imageUrl = 'https://t.me' + imageUrl
        }
        
        // Проверяем, что это действительно URL изображения
        if (imageUrl.includes('http') && !imageUrl.includes('t.me/s/')) {
          return imageUrl
        }
      }
    }
    
    return null
    
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Обновляет существующее превью (удаляет старое из Cloudinary, создает новое)
 * @param {string} telegramUrl - URL поста в Telegram  
 * @param {object} currentThumbnail - Текущие данные превью
 * @returns {Promise<object|null>} - Новые данные превью или null
 */
export async function updateThumbnail(telegramUrl, currentThumbnail = null) {
  console.log(`🔄 Обновление превью для: ${telegramUrl}`)
  
  if (currentThumbnail?.publicId) {
    if (currentThumbnail.source === 'local') {
      console.log(`   🗑️ Удаляем локальный файл превью: ${currentThumbnail.publicId}`)
      await deleteStoredImage(currentThumbnail.publicId)
    } else {
      console.log(`   ⚠️ Старое превью (${currentThumbnail.source}) не поддерживается, удаление пропущено`)
    }
  }
  
  return await generateThumbnailFromTelegramUrl(telegramUrl)
}

/**
 * Извлекает данные превью из строки (для обратной совместимости)
 * @param {string|object} thumbnailData - Данные превью
 * @returns {object} - Нормализованные данные превью
 */
export async function normalizeThumbnailData(thumbnailData) {
  if (!thumbnailData) return null

  if (typeof thumbnailData === 'object') {
    if (thumbnailData.publicId) {
      return buildThumbnailFromPublicId(thumbnailData.publicId, thumbnailData)
    }

    if (thumbnailData.url && /^https?:\/\//.test(thumbnailData.url)) {
      return await saveRemoteImage(thumbnailData.url, { reason: 'manual-import-object' })
    }

    return thumbnailData
  }

  if (typeof thumbnailData === 'string') {
    const trimmed = thumbnailData.trim()
    if (!trimmed) return null

    const relativePath = extractRelativePathFromUrl(trimmed)
    if (relativePath) {
      return buildThumbnailFromPublicId(relativePath, { url: trimmed })
    }

    if (/^https?:\/\//.test(trimmed)) {
      return await saveRemoteImage(trimmed, { reason: 'manual-import-string' })
    }
  }

  return null
} 