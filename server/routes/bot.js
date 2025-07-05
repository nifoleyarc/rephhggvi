import express from 'express'
import axios from 'axios'

const router = express.Router()

// Функция для отправки сообщения через Telegram Bot API
async function sendMessage(chatId, text, replyMarkup = null) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN не установлен')
    return false
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup
  }

  try {
    const response = await axios.post(url, payload)
    return response.data.ok
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error.response?.data || error.message)
    return false
  }
}

// POST /api/bot - обработка команд бота
router.post('/', async (req, res) => {
  console.log('='.repeat(80))
  console.log('🤖 Получена команда от Telegram Bot')
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
    
    // Обрабатываем только личные сообщения с командами
    if (!update.message) {
      console.log('❌ Обновление не содержит message')
      return res.status(200).json({ ok: true, message: 'Not a message' })
    }
    
    const message = update.message
    const chatId = message.chat.id
    const text = message.text || ''
    const userId = message.from.id
    const userName = message.from.first_name || 'Пользователь'
    
    console.log(`👤 Пользователь: ${userName} (ID: ${userId})`)
    console.log(`💬 Сообщение: "${text}"`)
    
    // Проверяем, что это команда /start
    if (!text.startsWith('/start')) {
      console.log('❌ Игнорируем сообщение - не команда /start')
      return res.status(200).json({ ok: true, message: 'Not a start command' })
    }
    
    console.log('✅ Обработка команды /start')
    
    // Получаем URL Mini App из переменных окружения
    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-mini-app.com'
    
    // Формируем приветственное сообщение
    const welcomeMessage = `🎬 Добро пожаловать в архив стримов GENSYXA!

👇 Нажмите кнопку ниже, чтобы открыть приложение:`
    
    // Создаем inline кнопку для открытия Mini App
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть приложение',
            web_app: {
              url: miniAppUrl
            }
          }
        ]
      ]
    }
    
    // Отправляем приветственное сообщение
    const sent = await sendMessage(chatId, welcomeMessage, inlineKeyboard)
    
    if (sent) {
      console.log('✅ Приветственное сообщение отправлено')
    } else {
      console.log('❌ Не удалось отправить приветственное сообщение')
    }
    
    return res.status(200).json({ ok: true, message: 'Start command processed' })
    
  } catch (error) {
    console.error('❌ Ошибка обработки команды бота:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router 