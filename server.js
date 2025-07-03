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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// API роуты
app.use('/api/auth', authRoutes)
app.use('/api/streams', streamsRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/refresh-thumbnail', thumbnailRoutes)
app.use('/api/refresh-thumbnails', thumbnailRoutes)

// Статические файлы (фронтенд)
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - все неизвестные роуты перенаправляем на index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
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
})

export default app 