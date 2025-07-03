import { v2 as cloudinary } from 'cloudinary'

// Конфигурация Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Загружает изображение в Cloudinary из URL
 * @param {string} imageUrl - URL изображения для загрузки
 * @param {object} options - Дополнительные опции для загрузки
 * @returns {Promise<string|null>} - URL загруженного изображения в Cloudinary или null при ошибке
 */
export async function uploadToCloudinary(imageUrl, options = {}) {
  try {
    console.log('📤 Uploading to Cloudinary:', imageUrl)
    
    // Настройки по умолчанию для превью стримов
    const defaultOptions = {
      folder: 'stream-thumbnails', // Папка в Cloudinary
      resource_type: 'image',
      format: 'jpg', // Конвертируем в jpg для экономии места
      quality: 'auto:good', // Автоматическая оптимизация качества
      width: 1280, // Максимальная ширина
      height: 720, // Максимальная высота  
      crop: 'limit', // Не обрезаем, только уменьшаем если больше
      fetch_format: 'auto', // Автоматический выбор формата (WebP, AVIF)
      flags: 'progressive', // Прогрессивная загрузка
      ...options
    }

    // Генерируем уникальное имя файла на основе URL
    const publicId = generatePublicId(imageUrl)
    
    const result = await cloudinary.uploader.upload(imageUrl, {
      ...defaultOptions,
      public_id: publicId,
      overwrite: false, // Не перезаписываем существующие файлы
      unique_filename: true, // Добавляем уникальный суффикс при конфликтах
    })

    console.log('✅ Successfully uploaded to Cloudinary:', result.secure_url)
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    }
    
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error.message)
    
    // Логируем специфичные ошибки
    if (error.http_code === 400) {
      console.error('   Invalid image URL or format')
    } else if (error.http_code === 401) {
      console.error('   Cloudinary authentication failed - check API credentials')
    } else if (error.http_code === 420) {
      console.error('   Cloudinary rate limit exceeded')
    }
    
    return null
  }
}

/**
 * Удаляет изображение из Cloudinary
 * @param {string} publicId - Public ID изображения в Cloudinary
 * @returns {Promise<boolean>} - true если удалено успешно
 */
export async function deleteFromCloudinary(publicId) {
  try {
    console.log('🗑️ Deleting from Cloudinary:', publicId)
    
    const result = await cloudinary.uploader.destroy(publicId)
    
    if (result.result === 'ok') {
      console.log('✅ Successfully deleted from Cloudinary:', publicId)
      return true
    } else {
      console.log('⚠️ Cloudinary delete result:', result.result, 'for', publicId)
      return false
    }
    
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error.message)
    return false
  }
}

/**
 * Генерирует уникальный public_id для Cloudinary на основе URL изображения
 * @param {string} imageUrl - URL изображения
 * @returns {string} - Уникальный public_id
 */
function generatePublicId(imageUrl) {
  try {
    // Извлекаем имя файла из URL
    const url = new URL(imageUrl)
    const pathname = url.pathname
    const filename = pathname.split('/').pop() || 'thumbnail'
    
    // Убираем расширение и специальные символы
    const baseName = filename
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 50) // Ограничиваем длину
    
    // Добавляем timestamp для уникальности
    const timestamp = Date.now()
    
    return `${baseName}_${timestamp}`
    
  } catch (error) {
    // Fallback если не удалось распарсить URL
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `thumbnail_${timestamp}_${random}`
  }
}

/**
 * Проверяет настройки Cloudinary
 * @returns {boolean} - true если все настройки корректны
 */
export function checkCloudinaryConfig() {
  const requiredEnvVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY', 
    'CLOUDINARY_API_SECRET'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ Missing Cloudinary environment variables:', missingVars)
    return false
  }
  
  console.log('✅ Cloudinary configuration is valid')
  return true
}

/**
 * Получает оптимизированный URL для изображения из Cloudinary
 * @param {string} publicId - Public ID изображения
 * @param {object} transformations - Трансформации изображения
 * @returns {string} - Оптимизированный URL
 */
export function getOptimizedUrl(publicId, transformations = {}) {
  const defaultTransformations = {
    quality: 'auto:good',
    fetch_format: 'auto',
    width: 640,
    height: 360,
    crop: 'fill',
    gravity: 'center',
    ...transformations
  }
  
  return cloudinary.url(publicId, defaultTransformations)
}

export default cloudinary 