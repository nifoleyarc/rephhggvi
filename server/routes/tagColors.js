import express from 'express'
import { getDatabase } from '../database/init.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/tag-colors - получить все цвета тегов (доступно всем)
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase()
    const tagColors = await db.all('SELECT * FROM tag_colors ORDER BY tag')
    
    // Преобразуем в формат, который ожидает фронтенд
    const formattedTagColors = {}
    
    for (const row of tagColors) {
      formattedTagColors[row.tag] = {
        colorType: row.color_type,
        solidColor: row.solid_color,
        gradientType: row.gradient_type,
        gradientColors: row.gradient_colors ? JSON.parse(row.gradient_colors) : null,
        backgroundTransparency: row.background_transparency,
        textColor: row.text_color,
        textShadow: row.text_shadow
      }
    }

    console.log('✓ Tag colors retrieved:', Object.keys(formattedTagColors).length, 'tags')
    res.json(formattedTagColors)

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// PUT /api/tag-colors - обновить цвета тегов (только для админов)
router.put('/', requireAuth, async (req, res) => {
  try {
    const tagColorsData = req.body
    
    if (!tagColorsData || typeof tagColorsData !== 'object') {
      return res.status(400).json({ error: 'Неверный формат данных' })
    }

    const db = await getDatabase()
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Удаляем все существующие записи
      await db.run('DELETE FROM tag_colors')
      
      // Добавляем новые записи
      for (const [tag, config] of Object.entries(tagColorsData)) {
        await db.run(`
          INSERT INTO tag_colors (
            tag, color_type, solid_color, gradient_type, gradient_colors,
            background_transparency, text_color, text_shadow, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          tag,
          config.colorType || 'solid',
          config.solidColor || null,
          config.gradientType || null,
          config.gradientColors ? JSON.stringify(config.gradientColors) : null,
          config.backgroundTransparency || 100,
          config.textColor || '#ffffff',
          config.textShadow || null
        ])
      }
      
      // Подтверждаем транзакцию
      await db.run('COMMIT')
      
      console.log('✓ Tag colors updated by', req.user?.type || 'unknown', '- user:', req.user?.id || 'unknown')
      console.log('  Updated tags count:', Object.keys(tagColorsData).length)
      
      res.json({ 
        success: true, 
        message: 'Цвета тегов успешно обновлены',
        count: Object.keys(tagColorsData).length
      })
      
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await db.run('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// POST /api/tag-colors/migrate - миграция данных из localStorage (только для админов)
router.post('/migrate', requireAuth, async (req, res) => {
  try {
    const localStorageData = req.body
    
    if (!localStorageData || typeof localStorageData !== 'object') {
      return res.status(400).json({ error: 'Неверный формат данных для миграции' })
    }

    const db = await getDatabase()
    
    // Проверяем, есть ли уже данные в базе
    const existingCount = await db.get('SELECT COUNT(*) as count FROM tag_colors')
    
    if (existingCount.count > 0) {
      return res.status(409).json({ 
        error: 'Данные уже существуют в базе', 
        message: 'Миграция возможна только при отсутствии данных в базе'
      })
    }
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION')
    
    try {
      let migratedCount = 0
      
      // Добавляем данные из localStorage
      for (const [tag, config] of Object.entries(localStorageData)) {
        await db.run(`
          INSERT INTO tag_colors (
            tag, color_type, solid_color, gradient_type, gradient_colors,
            background_transparency, text_color, text_shadow, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
          tag,
          config.colorType || 'solid',
          config.solidColor || null,
          config.gradientType || null,
          config.gradientColors ? JSON.stringify(config.gradientColors) : null,
          config.backgroundTransparency || 100,
          config.textColor || '#ffffff',
          config.textShadow || null
        ])
        migratedCount++
      }
      
      // Подтверждаем транзакцию
      await db.run('COMMIT')
      
      console.log('✓ Tag colors migrated by', req.user?.type || 'unknown', '- user:', req.user?.id || 'unknown')
      console.log('  Migrated tags count:', migratedCount)
      
      res.json({ 
        success: true, 
        message: 'Данные успешно мигрированы из localStorage',
        count: migratedCount
      })
      
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await db.run('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ error: 'Ошибка миграции', details: error.message })
  }
})

export default router 