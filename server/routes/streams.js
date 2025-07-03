import express from 'express'
import { getDatabase } from '../database/init.js'
import { generateThumbnailFromTelegramUrl, normalizeThumbnailData, updateThumbnail } from '../utils/thumbnailGenerator.js'
import { deleteFromCloudinary } from '../utils/cloudinary.js'

const router = express.Router()

// GET /api/streams - получить список стримов
router.get('/', async (req, res) => {
  try {
    const { category } = req.query
    const db = await getDatabase()
    
    let query = `
      SELECT s.*, c.name as category_name
      FROM streams s
      LEFT JOIN categories c ON json_extract(s.categories, '$[0]') = c.tag
    `
    let params = []
    
    if (category && category !== 'all') {
      query += ` WHERE json_extract(s.categories, '$[0]') = ? OR json_extract(s.tags, '$') LIKE ?`
      params = [category, `%"${category}"%`]
    }
    
    query += ` ORDER BY s.stream_date DESC, s.created_at DESC`
    
    const streams = await db.all(query, params)
    const categories = await db.all('SELECT * FROM categories ORDER BY name')

    // Парсим JSON поля
    const processedStreams = streams.map(stream => ({
      ...stream,
      tags: stream.tags ? JSON.parse(stream.tags) : [],
      categories: stream.categories ? JSON.parse(stream.categories) : [],
      thumbnail: stream.thumbnail_url ? {
        url: stream.thumbnail_url,
        publicId: stream.thumbnail_public_id,
        source: stream.thumbnail_source || 'unknown',
        width: stream.thumbnail_width,
        height: stream.thumbnail_height,
        format: stream.thumbnail_format,
        bytes: stream.thumbnail_bytes,
      } : null
    }))

    console.log('Returning streams count:', processedStreams.length)
    console.log('Sample stream data:', processedStreams[0] ? {
      title: processedStreams[0].title,
      thumbnail: processedStreams[0].thumbnail,
      thumbnailExists: !!processedStreams[0].thumbnail
    } : 'No streams')

    res.json({ streams: processedStreams, categories })

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// POST /api/streams - добавить новый стрим
router.post('/', async (req, res) => {
  try {
    const streamData = { ...req.body }

    // Валидация
    if (!streamData.title || !streamData.date || !streamData.telegramUrl) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля' })
    }

    const db = await getDatabase()

    // Автоматическая генерация превью, если не указано вручную
    let thumbnailData = {}

    // Если передан thumbnail URL вручную, нормализуем его
    if (streamData.thumbnail) {
      thumbnailData = normalizeThumbnailData(streamData.thumbnail)
    }
    // Если нет ручного превью, но есть telegramUrl - генерируем
    else if (streamData.telegramUrl) {
      console.log('Generating thumbnail for manually added stream:', streamData.title)
      try {
        const generatedThumbnail = await generateThumbnailFromTelegramUrl(streamData.telegramUrl)
        if (generatedThumbnail) {
          thumbnailData = generatedThumbnail
          console.log('✓ Thumbnail generated for manually added stream:', streamData.title)
        } else {
          console.log('⚠ No thumbnail found for manually added stream:', streamData.title)
        }
      } catch (error) {
        console.error('✗ Thumbnail generation failed for manually added stream:', streamData.title, error.message)
      }
    }

    const result = await db.run(`
      INSERT INTO streams (
        title, telegram_url, stream_date, tags, categories,
        thumbnail_url, thumbnail_source, thumbnail_public_id, 
        thumbnail_width, thumbnail_height, thumbnail_format, thumbnail_bytes,
        thumbnail_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      streamData.title,
      streamData.telegramUrl,
      streamData.date,
      JSON.stringify(streamData.tags || []),
      JSON.stringify(streamData.categories || []),
      thumbnailData?.url || null,
      thumbnailData?.source || null,
      thumbnailData?.publicId || null,
      thumbnailData?.width || null,
      thumbnailData?.height || null,
      thumbnailData?.format || null,
      thumbnailData?.bytes || null,
      thumbnailData?.url ? new Date().toISOString() : null
    ])

    const insertedStream = await db.get('SELECT * FROM streams WHERE id = ?', [result.lastID])
    
    // Парсим JSON поля для ответа
    const responseStream = {
      ...insertedStream,
      tags: insertedStream.tags ? JSON.parse(insertedStream.tags) : [],
      categories: insertedStream.categories ? JSON.parse(insertedStream.categories) : [],
      thumbnail: insertedStream.thumbnail_url ? {
        url: insertedStream.thumbnail_url,
        publicId: insertedStream.thumbnail_public_id,
        source: insertedStream.thumbnail_source,
        width: insertedStream.thumbnail_width,
        height: insertedStream.thumbnail_height,
        format: insertedStream.thumbnail_format,
        bytes: insertedStream.thumbnail_bytes,
      } : null
    }

    console.log('✓ Stream created manually:', responseStream.title, '| Thumbnail:', !!responseStream.thumbnail)
    res.status(201).json(responseStream)

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// PUT /api/streams/:id - обновить стрим
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const streamData = { ...req.body }

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID стрима' })
    }

    const db = await getDatabase()

    // Получаем текущий стрим
    const currentStream = await db.get('SELECT * FROM streams WHERE id = ?', [id])
    if (!currentStream) {
      return res.status(404).json({ error: 'Стрим не найден' })
    }

    // Парсим текущие данные
    const currentThumbnail = currentStream.thumbnail_url ? {
      url: currentStream.thumbnail_url,
      publicId: currentStream.thumbnail_public_id,
      source: currentStream.thumbnail_source,
      width: currentStream.thumbnail_width,
      height: currentStream.thumbnail_height,
      format: currentStream.thumbnail_format,
      bytes: currentStream.thumbnail_bytes,
    } : null

    let newThumbnailData = { ...currentThumbnail }

    // Если передан новый thumbnail URL вручную
    if (streamData.thumbnail !== undefined) {
      if (streamData.thumbnail) {
        newThumbnailData = normalizeThumbnailData(streamData.thumbnail)
      } else {
        // Если передан пустой thumbnail - очищаем
        newThumbnailData = {}
      }
    }
    // Если URL Telegram изменился И нет ручного превью - перегенерируем
    else {
      const telegramUrlChanged = streamData.telegramUrl && streamData.telegramUrl !== currentStream.telegram_url
      const shouldRegenerateThumbnail = telegramUrlChanged || (!currentThumbnail && streamData.telegramUrl)

      if (shouldRegenerateThumbnail) {
        console.log('Regenerating thumbnail for updated stream:', streamData.title || currentStream.title)
        try {
          const generatedThumbnail = await updateThumbnail(streamData.telegramUrl, currentThumbnail)
          if (generatedThumbnail) {
            newThumbnailData = generatedThumbnail
            console.log('✓ Thumbnail regenerated for updated stream:', streamData.title || currentStream.title)
          } else {
            console.log('⚠ No thumbnail found for updated stream:', streamData.title || currentStream.title)
            newThumbnailData = {}
          }
        } catch (error) {
          console.error('✗ Thumbnail regeneration failed for updated stream:', streamData.title || currentStream.title, error.message)
        }
      }
    }

    // Обновляем стрим
    await db.run(`
      UPDATE streams SET
        title = ?, telegram_url = ?, stream_date = ?, tags = ?, categories = ?,
        thumbnail_url = ?, thumbnail_source = ?, thumbnail_public_id = ?,
        thumbnail_width = ?, thumbnail_height = ?, thumbnail_format = ?, thumbnail_bytes = ?,
        thumbnail_updated_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      streamData.title || currentStream.title,
      streamData.telegramUrl || currentStream.telegram_url,
      streamData.date || currentStream.stream_date,
      JSON.stringify(streamData.tags || JSON.parse(currentStream.tags || '[]')),
      JSON.stringify(streamData.categories || JSON.parse(currentStream.categories || '[]')),
      newThumbnailData?.url || null,
      newThumbnailData?.source || null,
      newThumbnailData?.publicId || null,
      newThumbnailData?.width || null,
      newThumbnailData?.height || null,
      newThumbnailData?.format || null,
      newThumbnailData?.bytes || null,
      newThumbnailData?.url ? new Date().toISOString() : currentStream.thumbnail_updated_at,
      id
    ])

    const updatedStream = await db.get('SELECT * FROM streams WHERE id = ?', [id])
    
    // Парсим JSON поля для ответа
    const responseStream = {
      ...updatedStream,
      tags: updatedStream.tags ? JSON.parse(updatedStream.tags) : [],
      categories: updatedStream.categories ? JSON.parse(updatedStream.categories) : [],
      thumbnail: updatedStream.thumbnail_url ? {
        url: updatedStream.thumbnail_url,
        publicId: updatedStream.thumbnail_public_id,
        source: updatedStream.thumbnail_source,
        width: updatedStream.thumbnail_width,
        height: updatedStream.thumbnail_height,
        format: updatedStream.thumbnail_format,
        bytes: updatedStream.thumbnail_bytes,
      } : null
    }

    console.log('✓ Stream updated:', responseStream.title, '| Thumbnail:', !!responseStream.thumbnail)
    res.json(responseStream)

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// DELETE /api/streams/:id - удалить стрим
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID стрима' })
    }

    const db = await getDatabase()
    const stream = await db.get('SELECT * FROM streams WHERE id = ?', [id])

    if (!stream) {
      return res.status(404).json({ error: 'Стрим не найден' })
    }

    // Удаляем превью из Cloudinary, если оно там хранится
    if (stream.thumbnail_public_id && stream.thumbnail_source === 'cloudinary') {
      console.log('Deleting thumbnail from Cloudinary:', stream.thumbnail_public_id)
      try {
        await deleteFromCloudinary(stream.thumbnail_public_id)
        console.log('✓ Thumbnail deleted from Cloudinary')
      } catch (error) {
        console.error('✗ Failed to delete thumbnail from Cloudinary:', error)
        // Не прерываем удаление стрима из БД, просто логируем ошибку
      }
    }

    // Удаляем стрим
    const result = await db.run('DELETE FROM streams WHERE id = ?', [id])

    if (result.changes === 0) {
      // Это может произойти, если стрим удалили между SELECT и DELETE
      return res.status(404).json({ error: 'Стрим не найден' })
    }

    console.log('✓ Stream deleted:', stream.title)
    res.status(204).send()

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

export default router 