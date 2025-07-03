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

  // Создаем индексы для оптимизации
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_streams_date ON streams(stream_date DESC);
    CREATE INDEX IF NOT EXISTS idx_streams_telegram_url ON streams(telegram_url);
    CREATE INDEX IF NOT EXISTS idx_streams_message ON streams(message_id, chat_id);
    CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip);
  `)

  // Добавляем базовые категории если их нет
  await insertDefaultCategories(db)
  
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

// Миграция данных из MongoDB (если есть существующие данные)
export async function migrateFromMongoDB() {
  // Этот метод будет вызван отдельно для миграции
  console.log('📦 MongoDB migration placeholder - will be implemented separately')
} 