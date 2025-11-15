import express from 'express'
import { getDatabase } from '../database/init.js'
import { updateThumbnail } from '../utils/thumbnailGenerator.js'

const router = express.Router()

// POST /api/refresh-thumbnail - обновить превью для конкретного стрима
router.post('/refresh-thumbnail', async (req, res) => {
  try {
    const { streamId } = req.body

    if (!streamId) {
      return res.status(400).json({ error: 'Stream ID is required' })
    }

    const db = await getDatabase()

    // Найти конкретный стрим
    const stream = await db.get('SELECT * FROM streams WHERE id = ?', [streamId])

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' })
    }

    if (!stream.telegram_url) {
      return res.status(400).json({ error: 'Stream has no Telegram URL' })
    }

    console.log(`Refreshing thumbnail for stream: ${stream.title} (${stream.telegram_url})`)
    
    // Нормализуем текущее превью для обратной совместимости
    const currentThumbnail = stream.thumbnail_url ? {
      url: stream.thumbnail_url,
      publicId: stream.thumbnail_public_id,
      source: stream.thumbnail_source
    } : null
    
    // Обновляем превью используя новую систему
    const newThumbnail = await updateThumbnail(stream.telegram_url, currentThumbnail)
    
    if (newThumbnail) {
      // Обновляем стрим с новым thumbnail
      await db.run(`
        UPDATE streams SET 
          thumbnail_url = ?, thumbnail_source = ?, thumbnail_public_id = ?,
          thumbnail_updated_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [
        newThumbnail.url,
        newThumbnail.source,
        newThumbnail.publicId || null,
        new Date().toISOString(),
        streamId
      ])

      console.log(`Updated thumbnail for stream: ${stream.title} (${newThumbnail.source})`)
      
      return res.json({
        success: true,
        message: 'Thumbnail updated successfully',
        thumbnail: {
          url: newThumbnail.url,
          source: newThumbnail.source,
          s3Key: newThumbnail.s3Key
        }
      })
    } else {
      console.log('No thumbnail found for:', stream.title)
      
      // Очищаем старый thumbnail если он был
      await db.run(`
        UPDATE streams SET 
          thumbnail_url = NULL, thumbnail_source = NULL, thumbnail_public_id = NULL,
          thumbnail_updated_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [new Date().toISOString(), streamId])
      
      return res.json({
        success: true,
        message: 'No thumbnail found, cleared existing thumbnail',
        thumbnail: null
      })
    }

  } catch (error) {
    console.error('Thumbnail refresh error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

// POST /api/refresh-thumbnails - обновить превью для всех стримов
router.post('/refresh-thumbnails', async (req, res) => {
  try {
    const db = await getDatabase()

    // Получаем все стримы
    const allStreams = await db.all('SELECT * FROM streams ORDER BY created_at DESC')

    if (allStreams.length === 0) {
      return res.json({
        success: true,
        message: 'No streams to process',
        stats: { total: 0, updated: 0, skipped: 0, errors: 0 }
      })
    }

    console.log(`Starting thumbnail refresh for ${allStreams.length} streams...`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors = []

    for (const stream of allStreams) {
      try {
        if (!stream.telegram_url) {
          console.log(`No Telegram URL for stream ${stream.id}, skipping`)
          skippedCount++
          continue
        }
        
        console.log(`Processing stream: ${stream.title} (${stream.telegram_url})`)
        
        // Нормализуем текущее превью для обратной совместимости
        const currentThumbnail = stream.thumbnail_url ? {
          url: stream.thumbnail_url,
          publicId: stream.thumbnail_public_id,
          source: stream.thumbnail_source
        } : null
        
        // Обновляем превью используя новую систему
        const newThumbnail = await updateThumbnail(stream.telegram_url, currentThumbnail)
        
        if (newThumbnail) {
          // Обновляем стрим с новым thumbnail
          await db.run(`
            UPDATE streams SET 
              thumbnail_url = ?, thumbnail_source = ?, thumbnail_public_id = ?,
              thumbnail_updated_at = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [
            newThumbnail.url,
            newThumbnail.source,
            newThumbnail.publicId || null,
            new Date().toISOString(),
            stream.id
          ])

          updatedCount++
          console.log(`Updated thumbnail for stream: ${stream.title} (${newThumbnail.source})`)
        } else {
          console.log('No thumbnail found for:', stream.title)
          // Очищаем старый thumbnail если он был
          await db.run(`
            UPDATE streams SET 
              thumbnail_url = NULL, thumbnail_source = NULL, thumbnail_public_id = NULL,
              thumbnail_updated_at = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [new Date().toISOString(), stream.id])
          skippedCount++
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        console.error('Error updating stream thumbnail:', stream.title, error)
        errorCount++
        errors.push({
          streamId: stream.id,
          title: stream.title,
          error: error.message
        })
      }
    }

    const message = `Thumbnail refresh completed. Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount} out of ${allStreams.length} streams.`
    
    console.log('='.repeat(80))
    console.log('🎉 ОБНОВЛЕНИЕ ПРЕВЬЮ ЗАВЕРШЕНО!')
    console.log(`📊 Статистика:`)
    console.log(`   📈 Обновлено: ${updatedCount}`)
    console.log(`   ⏭️ Пропущено: ${skippedCount}`)
    console.log(`   ❌ Ошибок: ${errorCount}`)
    console.log(`   📝 Всего обработано: ${allStreams.length}`)
    console.log('='.repeat(80))

    return res.json({
      success: true,
      message,
      stats: {
        total: allStreams.length,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Bulk thumbnail refresh error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

export default router 