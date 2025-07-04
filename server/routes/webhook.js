import express from 'express'
import { getDatabase } from '../database/init.js'
import { generateThumbnailFromTelegramUrl } from '../utils/thumbnailGenerator.js'

const router = express.Router()

// ============================================================================
// 🏷️ КОНФИГУРАЦИЯ КАТЕГОРИЙ
// ============================================================================

// Маппинг тегов на категории (согласно требованиям)
const CATEGORY_MAPPING = {
  // Основные категории
  '#just_chatting': 'just_chatting',
  '#ирл': 'irl', 
  '#фильм': 'movies',
  '#игры': 'gaming',
  '#контент': 'content',
  '#марафон': 'marathon',
  '#кукинг': 'cooking',
  '#шоу': 'show',
  '#шептуньи': 'show',
  
  // Дополнительные варианты (для совместимости)
  '#фильмы': 'movies',
  '#мультик': 'movies', 
  '#мультики': 'movies',
  '#мультфильм': 'movies',
  '#кино': 'movies',
  
  '#игра': 'gaming',
  '#gaming': 'gaming',
  '#game': 'gaming',
  '#геймс': 'gaming',
  '#play': 'gaming',
  
  '#irl': 'irl',
  '#real': 'irl',
  '#жизнь': 'irl',
  
  '#cooking': 'cooking',
  '#готовка': 'cooking',
  '#кухня': 'cooking',
  '#еда': 'cooking',
  
  '#marathon': 'marathon',
  '#марик': 'marathon',
  '#долгий': 'marathon',
  
  '#show': 'show',
  '#шоу': 'show',
  '#program': 'show',
  '#программа': 'show',
  
  '#content': 'content',
  '#видео': 'content',
  '#video': 'content',
  
  // Fallback категория
  DEFAULT: 'just_chatting'
}

// Регулярные выражения
const TAG_REGEX = /#[a-zA-Z0-9а-яёА-ЯЁ_]+/gi // Поддержка всех русских букв + регистр
const DATE_REGEX = /\b\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})\b/

// ============================================================================
// 🖼️ ГЕНЕРАЦИЯ ПРЕВЬЮ
// ============================================================================

async function generateThumbnail(telegramUrl) {
  const result = await generateThumbnailFromTelegramUrl(telegramUrl)
  
  if (result) {
    return result
  }
  
  return null
}

// ============================================================================
// 📝 ПАРСИНГ ПОСТОВ
// ============================================================================

/**
 * Парсит пост канала и извлекает данные о стриме
 * @param {object} channelPost - Объект поста из Telegram
 * @returns {object|null} - Данные стрима или null если парсинг неудачен
 */
function parsePost(channelPost) {
  const text = channelPost.text || channelPost.caption || ''
  
  if (!text.trim()) {
    console.log('   ❌ Пост не содержит текста')
    return null
  }
  
  console.log(`   📝 Парсинг текста: "${text.substring(0, 100)}..."`)
  
  // Ищем теги
  const tags = []
  const foundTags = text.match(TAG_REGEX)
  
  if (!foundTags || foundTags.length === 0) {
    console.log('   ❌ Теги не найдены - пост будет пропущен')
    return null
  }
  
  foundTags.forEach(tag => {
    const normalizedTag = tag.toLowerCase()
    tags.push(normalizedTag)
    console.log(`   🏷️ Найден тег: ${normalizedTag}`)
  })
  
  // Определяем категорию по первому найденному тегу (по приоритету)
  let category = CATEGORY_MAPPING.DEFAULT
  for (const tag of tags) {
    if (CATEGORY_MAPPING[tag]) {
      category = CATEGORY_MAPPING[tag]
      console.log(`   📂 Категория: ${category} (по тегу ${tag})`)
      break
    }
  }
  
  if (category === CATEGORY_MAPPING.DEFAULT) {
    console.log(`   📂 Категория: ${category} (по умолчанию, теги не распознаны: ${tags.join(', ')})`)
  }
  
  // Извлекаем название стрима (первая строка без тегов)
  const lines = text.split('\n').map(line => line.trim()).filter(line => line)
  let title = lines[0] || 'Стрим'
  
  // Убираем теги из названия
  title = title.replace(TAG_REGEX, '').trim()
  if (!title) {
    title = 'Стрим'
  }
  
  console.log(`   📖 Название: "${title}"`)
  
  // Ищем дату в тексте
  let streamDate = null
  const dateMatch = text.match(DATE_REGEX)
  
  if (dateMatch) {
    const dateStr = dateMatch[0]
    console.log(`   📅 Найдена дата в тексте: ${dateStr}`)
    
    // Парсим дату
    const parts = dateStr.split('.')
    if (parts.length === 3) {
      let [day, month, year] = parts
      
      // Дополняем год если двузначный
      if (year.length === 2) {
        year = '20' + year
      }
      
      streamDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }
  
  // Если дата не найдена, используем дату поста в UTC+5
  if (!streamDate) {
    const postDate = new Date(channelPost.date * 1000)
    // Добавляем 5 часов для UTC+5
    const utc5Date = new Date(postDate.getTime() + (5 * 60 * 60 * 1000))
    streamDate = utc5Date.toISOString()
    console.log(`   📅 Используем дату поста (UTC+5): ${streamDate}`)
  } else {
    // Парсим найденную дату и устанавливаем время как текущее в UTC+5
    const currentTime = new Date()
    const utc5Time = new Date(currentTime.getTime() + (5 * 60 * 60 * 1000))
    const timeString = utc5Time.toISOString().split('T')[1] // Берем только время
    streamDate = streamDate + 'T' + timeString
    console.log(`   📅 Дата стрима (UTC+5): ${streamDate}`)
  }
  
  return {
    title,
    date: streamDate,
    tags,
    categories: [category],
    messageId: channelPost.message_id,
    chatId: channelPost.chat.id
  }
}

// ============================================================================
// 🔗 WEBHOOK ENDPOINT
// ============================================================================

// POST /api/webhook - обработка webhook от Telegram
router.post('/', async (req, res) => {
  console.log('='.repeat(80))
  console.log('📨 Получен webhook от Telegram')
  console.log('   Время:', new Date().toLocaleString('ru-RU'))
  
  try {
    const update = req.body
    
    // Проверяем webhook secret если настроен
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret) {
      const receivedSecret = req.headers['x-telegram-bot-api-secret-token']
      if (receivedSecret !== webhookSecret) {
        console.log('❌ Неверный webhook secret')
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }
    
    console.log('✅ Webhook secret проверен')
    console.log('📋 Тип обновления:', Object.keys(update).join(', '))
    
    // Проверяем, что это пост канала
    if (!update.channel_post) {
      console.log('❌ Обновление не содержит channel_post')
      return res.status(200).json({ ok: true, message: 'Not a channel post' })
    }
    
    const channelPost = update.channel_post
    console.log(`📢 Обработка поста канала ${channelPost.message_id}`)
    console.log(`   Канал: ${channelPost.chat.title || 'Неизвестно'} (ID: ${channelPost.chat.id})`)
    
    // Парсим данные поста
    const streamData = parsePost(channelPost)
    
    if (!streamData) {
      console.log('❌ Парсинг неудачен или пост не содержит стримов')
      return res.status(200).json({ ok: true, message: 'No stream data parsed' })
    }
    
    // ========================================================================
    // 💾 СОХРАНЕНИЕ В БАЗУ ДАННЫХ
    // ========================================================================
    
    console.log('💾 Подключение к базе данных...')
    const db = await getDatabase()
    
    // Проверяем дубликаты
    const existingStream = await db.get(`
      SELECT id FROM streams WHERE message_id = ? AND chat_id = ?
    `, [streamData.messageId, streamData.chatId])
    
    if (existingStream) {
      console.log('⚠️ Стрим уже существует в базе')
      return res.status(200).json({ ok: true, message: 'Stream already exists' })
    }
    
    // Формируем ссылку на пост
    const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME || 'channel'
    const telegramUrl = `https://t.me/${channelUsername}/${streamData.messageId}`
    console.log(`🔗 Ссылка на пост: ${telegramUrl}`)
    
    // Генерируем превью
    const thumbnailData = await generateThumbnail(telegramUrl)
    
    // Создаем запись стрима
    const result = await db.run(`
      INSERT INTO streams (
        title, telegram_url, stream_date, tags, categories,
        thumbnail_url, thumbnail_source, thumbnail_public_id, 
        thumbnail_width, thumbnail_height, thumbnail_format, thumbnail_bytes,
        thumbnail_updated_at, message_id, chat_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      streamData.title,
      telegramUrl,
      streamData.date,
      JSON.stringify(streamData.tags),
      JSON.stringify(streamData.categories),
      thumbnailData?.url || null,
      thumbnailData?.source || null,
      thumbnailData?.publicId || null,
      thumbnailData?.width || null,
      thumbnailData?.height || null,
      thumbnailData?.format || null,
      thumbnailData?.bytes || null,
      thumbnailData ? new Date().toISOString() : null,
      streamData.messageId,
      streamData.chatId
    ])
    
    console.log('🎉 СТРИМ УСПЕШНО ДОБАВЛЕН!')
    console.log(`   📖 Название: ${streamData.title}`)
    console.log(`   📂 Категория: ${streamData.categories[0]}`)
    console.log(`   🏷️ Теги: ${streamData.tags.join(', ')}`)
    console.log(`   🖼️ Превью: ${thumbnailData ? `ДА (${thumbnailData.source})` : 'НЕТ'}`)
    console.log(`   🆔 ID в базе: ${result.lastID}`)
    
    return res.status(200).json({
      ok: true,
      message: 'Stream added successfully',
      stream: {
        id: result.lastID,
        title: streamData.title,
        category: streamData.categories[0],
        tags: streamData.tags,
        thumbnail: !!thumbnailData
      }
    })
    
  } catch (error) {
    console.error('💥 КРИТИЧЕСКАЯ ОШИБКА:', error)
    console.error('Stack trace:', error.stack)
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
    
  } finally {
    console.log('='.repeat(80))
  }
})

export default router 