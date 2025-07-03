import {
  uploadToCloudinary,
  deleteFromCloudinary,
  checkCloudinaryConfig
} from './cloudinary.js'

/**
 * Генерирует превью для стрима из Telegram URL
 * @param {string} telegramUrl - URL поста в Telegram
 * @param {number} retries - Количество попыток
 * @returns {Promise<object|null>} - Объект с данными о превью или null
 */
export async function generateThumbnailFromTelegramUrl(telegramUrl, retries = 3) {
  console.log(`🖼️ Генерация превью для: ${telegramUrl}`)
  
  // Проверяем настройки Cloudinary
  if (!checkCloudinaryConfig()) {
    console.error('❌ Cloudinary не настроен, используем fallback метод')
    return await generateThumbnailFallback(telegramUrl, retries)
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   🔄 Попытка ${attempt}/${retries}`)
      
      // Добавляем небольшую задержку перед попыткой (кроме первой)
      if (attempt > 1) {
        const delay = 1000 * attempt
        console.log(`   ⏳ Задержка ${delay}мс`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      // Получаем HTML страницы Telegram
      const imageUrl = await extractImageFromTelegramUrl(telegramUrl)
      
      if (!imageUrl) {
        console.log(`   ⚠️ Изображение не найдено в попытке ${attempt}`)
        if (attempt === retries) return null
        continue
      }
      
      console.log(`   ✅ Найдено изображение: ${imageUrl}`)
      
      // Загружаем изображение в Cloudinary
      const cloudinaryResult = await uploadToCloudinary(imageUrl, {
        context: {
          source: 'telegram',
          'original-telegram-url': telegramUrl,
          'generated-at': new Date().toISOString()
        }
      })
      
      if (cloudinaryResult) {
        console.log(`   🎉 Превью успешно создано и загружено в Cloudinary`)
        return {
          url: cloudinaryResult.url,
          publicId: cloudinaryResult.publicId,
          source: 'cloudinary',
          originalUrl: imageUrl,
          telegramUrl: telegramUrl,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          format: cloudinaryResult.format,
          bytes: cloudinaryResult.bytes,
          createdAt: new Date()
        }
      } else {
        console.log(`   ❌ Не удалось загрузить в Cloudinary, попытка ${attempt}`)
        if (attempt === retries) {
          console.log(`   🔄 Используем fallback метод`)
          return await generateThumbnailFallback(telegramUrl, 1) // Одна попытка fallback
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Ошибка в попытке ${attempt}: ${error.message}`)
      if (attempt === retries) {
        console.log(`   🔄 Используем fallback метод после всех неудач`)
        return await generateThumbnailFallback(telegramUrl, 1) // Одна попытка fallback
      }
    }
  }
  
  return null
}

/**
 * Fallback метод - возвращает прямую ссылку на изображение (как было раньше)
 * @param {string} telegramUrl - URL поста в Telegram
 * @param {number} retries - Количество попыток
 * @returns {Promise<object|null>} - Объект с данными о превью или null
 */
async function generateThumbnailFallback(telegramUrl, retries = 3) {
  console.log(`🔄 Fallback генерация превью для: ${telegramUrl}`)
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   🔄 Fallback попытка ${attempt}/${retries}`)
      
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
      
      const imageUrl = await extractImageFromTelegramUrl(telegramUrl)
      
      if (imageUrl) {
        console.log(`   ✅ Fallback превью найдено: ${imageUrl}`)
        return {
          url: imageUrl,
          source: 'telegram_direct',
          originalUrl: imageUrl,
          telegramUrl: telegramUrl,
          createdAt: new Date()
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Fallback ошибка в попытке ${attempt}: ${error.message}`)
    }
  }
  
  console.log(`   💥 Все попытки неудачны`)
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
  
  // Если есть старое превью в Cloudinary, удаляем его
  if (currentThumbnail?.publicId && currentThumbnail?.source === 'cloudinary') {
    console.log(`   🗑️ Удаляем старое превью из Cloudinary: ${currentThumbnail.publicId}`)
    await deleteFromCloudinary(currentThumbnail.publicId)
  }
  
  // Генерируем новое превью
  return await generateThumbnailFromTelegramUrl(telegramUrl)
}

/**
 * Извлекает данные превью из строки (для обратной совместимости)
 * @param {string|object} thumbnailData - Данные превью
 * @returns {object} - Нормализованные данные превью
 */
export function normalizeThumbnailData(thumbnailData) {
  // Если это уже объект - возвращаем как есть
  if (typeof thumbnailData === 'object' && thumbnailData !== null) {
    return thumbnailData
  }
  
  // Если это строка URL - конвертируем в объект
  if (typeof thumbnailData === 'string') {
    return {
      url: thumbnailData,
      source: 'telegram_direct', // Старый формат
      originalUrl: thumbnailData
    }
  }
  
  return null
} 