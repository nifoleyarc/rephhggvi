import express from 'express'
import { getDatabase } from '../database/init.js'

const router = express.Router()

// GET /api/categories - получить все категории
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase()
    const categories = await db.all('SELECT * FROM categories ORDER BY name')
    res.json(categories)

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// POST /api/categories - создать новую категорию
router.post('/', async (req, res) => {
  try {
    const { name, tag, description } = req.body

    // Валидация
    if (!name || !tag) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля (name, tag)' })
    }

    const db = await getDatabase()

    // Проверяем уникальность
    const existing = await db.get(
      'SELECT id FROM categories WHERE name = ? OR tag = ?',
      [name, tag]
    )

    if (existing) {
      return res.status(400).json({ error: 'Категория с таким именем или тегом уже существует' })
    }

    const result = await db.run(`
      INSERT INTO categories (name, tag, description, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `, [name, tag, description || null])

    const insertedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID])
    
    console.log('✓ Category created:', insertedCategory.name)
    res.status(201).json(insertedCategory)

  } catch (error) {
    console.error('Database error:', error)
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Категория с таким именем или тегом уже существует' })
    } else {
      res.status(500).json({ error: 'Ошибка сервера', details: error.message })
    }
  }
})

// GET /api/categories/:id - получить категорию по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID категории' })
    }

    const db = await getDatabase()
    const category = await db.get('SELECT * FROM categories WHERE id = ?', [id])

    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    res.json(category)

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

// PUT /api/categories/:id - обновить категорию
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, tag, description } = req.body

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID категории' })
    }

    if (!name || !tag) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля (name, tag)' })
    }

    const db = await getDatabase()

    // Проверяем существование категории
    const currentCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id])
    if (!currentCategory) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    // Проверяем уникальность (исключая текущую категорию)
    const existing = await db.get(
      'SELECT id FROM categories WHERE (name = ? OR tag = ?) AND id != ?',
      [name, tag, id]
    )

    if (existing) {
      return res.status(400).json({ error: 'Категория с таким именем или тегом уже существует' })
    }

    await db.run(`
      UPDATE categories SET 
        name = ?, tag = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name, tag, description || null, id])

    const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id])
    
    console.log('✓ Category updated:', updatedCategory.name)
    res.json(updatedCategory)

  } catch (error) {
    console.error('Database error:', error)
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Категория с таким именем или тегом уже существует' })
    } else {
      res.status(500).json({ error: 'Ошибка сервера', details: error.message })
    }
  }
})

// DELETE /api/categories/:id - удалить категорию
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID категории' })
    }

    const db = await getDatabase()

    // Проверяем существование категории
    const category = await db.get('SELECT * FROM categories WHERE id = ?', [id])
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    // Проверяем, используется ли категория в стримах
    const usageCount = await db.get(`
      SELECT COUNT(*) as count FROM streams 
      WHERE json_extract(categories, '$') LIKE ?
    `, [`%"${category.tag}"%`])

    if (usageCount.count > 0) {
      return res.status(400).json({ 
        error: `Категория используется в ${usageCount.count} стримах. Удаление невозможно.`,
        usage: usageCount.count
      })
    }

    const result = await db.run('DELETE FROM categories WHERE id = ?', [id])

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    console.log('✓ Category deleted:', category.name)
    res.json({ success: true, message: 'Категория удалена' })

  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Ошибка сервера', details: error.message })
  }
})

export default router 