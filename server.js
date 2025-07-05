import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config()

// Импортируем роуты
import authRoutes from './server/routes/auth.js'
import streamsRoutes from './server/routes/streams.js'
import categoriesRoutes from './server/routes/categories.js'
import webhookRoutes from './server/routes/webhook.js'
import thumbnailRoutes from './server/routes/thumbnails.js'

// Импортируем middleware для защиты
import { requireAuth, requireReadAuth, requireDataAccess, logAuth } from './server/middleware/auth.js'
import { rateLimit } from './server/middleware/rateLimit.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: [
    'https://nifoleyarc.github.io', // GitHub Pages основной домен
    'https://nifoleyarc.github.io/rephhggvi', // GitHub Pages конкретное приложение
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Локальный сервер
    process.env.FRONTEND_URL // Дополнительный URL из env
  ].filter(Boolean),
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// API роуты с защитой
app.use('/api/auth', rateLimit, authRoutes)
app.use('/api/streams', rateLimit, requireReadAuth, logAuth, streamsRoutes) // Чтение доступно всем, запись - только авторизованным
app.use('/api/categories', rateLimit, requireReadAuth, logAuth, categoriesRoutes)
app.use('/api/webhook', webhookRoutes) // Webhook не защищаем, так как он от Telegram (для постов канала)
app.use('/api/refresh-thumbnail', rateLimit, requireAuth, logAuth, thumbnailRoutes) // Полная защита
app.use('/api/refresh-thumbnails', rateLimit, requireAuth, logAuth, thumbnailRoutes)

// Убираем раздачу статических файлов, так как frontend на GitHub Pages
// app.use(express.static(path.join(__dirname, 'dist')))

// API health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Backend status: ok'
  })
})

// Обработка неизвестных роутов
app.get('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' })
})

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend: http://localhost:${PORT}`)
  console.log(`🔗 API: http://localhost:${PORT}/api`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🤖 Bot commands: обрабатываются через webhook /api/webhook`)
})

export default app 