import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '../../database.sqlite')

// Создаем подключение к базе данных
export async function createDatabase() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })

  // Включаем поддержку внешних ключей
  await db.exec('PRAGMA foreign_keys = ON')

  // Создаем таблицы
  await createTables(db)
  
  return db
}

// Получаем существующее подключение к базе данных
export async function getDatabase() {
  return await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })
}

async function createTables(db) {
  // Таблица категорий
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      tag TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Таблица стримов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      telegram_url TEXT,
      stream_date TEXT NOT NULL,
      tags TEXT, -- JSON массив
      categories TEXT, -- JSON массив
      thumbnail_url TEXT,
      thumbnail_source TEXT,
      thumbnail_public_id TEXT, -- Public ID в Cloudinary
      thumbnail_width INTEGER,
      thumbnail_height INTEGER,
      thumbnail_format TEXT,
      thumbnail_bytes INTEGER,
      thumbnail_updated_at DATETIME,
      message_id INTEGER,
      chat_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Таблица попыток аутентификации (для защиты от брут-форс)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS auth_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      first_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
      banned_until DATETIME,
      UNIQUE(ip)
    )
  `)

  // Таблица цветов тегов (глобальная настройка)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tag_colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE,
      color_type TEXT NOT NULL DEFAULT 'solid', -- 'solid' или 'gradient'
      solid_color TEXT, -- hex цвет для solid
      gradient_type TEXT, -- направление градиента для gradient (linear-to-r, linear-to-br и т.д.)
      gradient_colors TEXT, -- JSON массив цветов для градиента
      background_transparency INTEGER DEFAULT 100, -- прозрачность фона 10-100%
      text_color TEXT DEFAULT '#ffffff', -- цвет текста
      text_shadow TEXT, -- тень текста
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Создаем индексы для оптимизации
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_streams_date ON streams(stream_date DESC);
    CREATE INDEX IF NOT EXISTS idx_streams_telegram_url ON streams(telegram_url);
    CREATE INDEX IF NOT EXISTS idx_streams_message ON streams(message_id, chat_id);
    CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip);
    CREATE INDEX IF NOT EXISTS idx_tag_colors_tag ON tag_colors(tag);
  `)

  // Добавляем базовые категории и предустановленные цвета тегов если их нет
  await insertDefaultCategories(db)
  await insertDefaultTagColors(db)
  
  console.log('✅ Database tables created/verified')
}

async function insertDefaultCategories(db) {
  const defaultCategories = [
    { name: 'Общение / Видосы', tag: 'just_chatting', description: 'Обычные стримы и разговоры' },
    { name: 'ИРЛ стримы', tag: 'irl', description: 'Стримы из реальной жизни' },
    { name: 'Фильмы / Мультики', tag: 'movies', description: 'Просмотр фильмов и мультфильмов' },
    { name: 'Игровые стримы', tag: 'gaming', description: 'Игровой контент' },
    { name: 'Контент', tag: 'content', description: 'Различный контент' },
    { name: 'Марафоны', tag: 'marathon', description: 'Длительные стримы' },
    { name: 'Кукинги', tag: 'cooking', description: 'Готовка на стриме' },
    { name: 'ШОУ', tag: 'show', description: 'Шоу программы' }
  ]

  for (const category of defaultCategories) {
    try {
      await db.run(`
        INSERT OR IGNORE INTO categories (name, tag, description)
        VALUES (?, ?, ?)
      `, [category.name, category.tag, category.description])
    } catch (error) {
      // Игнорируем ошибки дубликатов
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error('Error inserting default category:', error)
      }
    }
  }

  console.log('✅ Default categories initialized')
}

async function insertDefaultTagColors(db) {
  const defaultTagColors = [
    {
      tag: 'франция',
      color_type: 'gradient',
      gradient_type: 'linear-to-r',
      gradient_colors: JSON.stringify(['rgba(70, 130, 180, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(220, 20, 60, 0.7) 66%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'париж',
      color_type: 'gradient',
      gradient_type: 'linear-to-r',
      gradient_colors: JSON.stringify(['rgba(70, 130, 180, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(220, 20, 60, 0.7) 66%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'польша',
      color_type: 'gradient',
      gradient_type: 'linear-to-b',
      gradient_colors: JSON.stringify(['rgba(255, 255, 255, 0.7) 50%', 'rgba(220, 20, 60, 0.7) 50%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'таиланд',
      color_type: 'gradient',
      gradient_type: 'linear-to-b',
      gradient_colors: JSON.stringify(['rgba(220, 20, 60, 0.7) 16.67%', 'rgba(255, 255, 255, 0.7) 16.67%', 'rgba(255, 255, 255, 0.7) 33.33%', 'rgba(30, 60, 180, 0.7) 33.33%', 'rgba(30, 60, 180, 0.7) 66.67%', 'rgba(255, 255, 255, 0.7) 66.67%', 'rgba(255, 255, 255, 0.7) 83.33%', 'rgba(220, 20, 60, 0.7) 83.33%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'испания',
      color_type: 'gradient',
      gradient_type: 'linear-to-b',
      gradient_colors: JSON.stringify(['rgba(200, 20, 20, 0.7) 25%', 'rgba(255, 215, 0, 0.7) 25%', 'rgba(255, 215, 0, 0.7) 75%', 'rgba(200, 20, 20, 0.7) 75%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'австрия',
      color_type: 'gradient',
      gradient_type: 'linear-to-b',
      gradient_colors: JSON.stringify(['rgba(200, 20, 20, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(200, 20, 20, 0.7) 66%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'грузия',
      color_type: 'gradient',
      gradient_type: 'linear-to-r',
      gradient_colors: JSON.stringify(['rgba(255, 255, 255, 0.7) 50%', 'rgba(220, 20, 60, 0.7) 50%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'оаэ',
      color_type: 'gradient',
      gradient_type: 'linear-to-r',
      gradient_colors: JSON.stringify(['rgba(34, 139, 34, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(0, 0, 0, 0.7) 66%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'дубай',
      color_type: 'gradient',
      gradient_type: 'linear-to-r',
      gradient_colors: JSON.stringify(['rgba(34, 139, 34, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(0, 0, 0, 0.7) 66%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    },
    {
      tag: 'португалия',
      color_type: 'gradient',
      gradient_type: 'linear-to-r',
      gradient_colors: JSON.stringify(['rgba(34, 139, 34, 0.7) 50%', 'rgba(220, 20, 60, 0.7) 50%']),
      background_transparency: 70,
      text_color: '#ffffff',
      text_shadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
    }
  ]

  for (const tagColor of defaultTagColors) {
    try {
      await db.run(`
        INSERT OR IGNORE INTO tag_colors (
          tag, color_type, gradient_type, gradient_colors, 
          background_transparency, text_color, text_shadow
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        tagColor.tag,
        tagColor.color_type,
        tagColor.gradient_type,
        tagColor.gradient_colors,
        tagColor.background_transparency,
        tagColor.text_color,
        tagColor.text_shadow
      ])
    } catch (error) {
      // Игнорируем ошибки дубликатов
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error('Error inserting default tag color:', error)
      }
    }
  }

  console.log('✅ Default tag colors initialized')
}

// Миграция данных из MongoDB (если есть существующие данные)
export async function migrateFromMongoDB() {
  // Этот метод будет вызван отдельно для миграции
  console.log('📦 MongoDB migration placeholder - will be implemented separately')
} 