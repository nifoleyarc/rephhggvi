import { Telegraf } from 'telegraf'
import dotenv from 'dotenv'

dotenv.config()

class TelegrafBot {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN
    this.miniAppUrl = process.env.MINI_APP_URL || 'https://your-mini-app.com'
    
    if (!this.botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN не установлен')
      return
    }
    
    // Создаем бота
    this.bot = new Telegraf(this.botToken)
    
    // Настраиваем команды
    this.setupCommands()
    
    console.log('🤖 Telegraf бот инициализирован (без polling)')
    console.log(`   Mini App URL: ${this.miniAppUrl}`)
  }
  
  setupCommands() {
    // Команда /start
    this.bot.start(async (ctx) => {
      const user = ctx.from
      console.log(`👤 Команда /start от: ${user.first_name} (ID: ${user.id})`)
      
      const welcomeMessage = `🎬 Добро пожаловать в архив стримов GENSYXA!

👇 Нажмите кнопку ниже, чтобы открыть приложение:`
      
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть приложение',
              web_app: {
                url: this.miniAppUrl
              }
            }
          ]
        ]
      }
      
      try {
        await ctx.reply(welcomeMessage, {
          reply_markup: keyboard
        })
        console.log('✅ Приветственное сообщение отправлено')
      } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error.message)
      }
    })
    
    // Игнорируем все остальные сообщения
    this.bot.on('message', (ctx) => {
      const text = ctx.message.text || ''
      if (!text.startsWith('/')) {
        console.log(`❌ Игнорируем сообщение: "${text.substring(0, 50)}..."`)
      }
    })
    
    // Обработка ошибок
    this.bot.catch((err, ctx) => {
      console.error('❌ Ошибка в боте:', err)
    })
  }
  
  // Обработка webhook'ов вместо polling
  async handleWebhook(update) {
    if (!this.bot) {
      console.error('❌ Бот не инициализирован')
      return false
    }
    
    try {
      // Обрабатываем update через Telegraf
      await this.bot.handleUpdate(update)
      return true
    } catch (error) {
      console.error('❌ Ошибка обработки webhook:', error.message)
      return false
    }
  }
  
  // НЕ запускаем polling - он конфликтует с webhook
  async start() {
    if (!this.bot) {
      console.error('❌ Бот не инициализирован')
      return false
    }
    
    try {
      console.log('🚀 Подготовка Telegraf бота (webhook режим)...')
      
      // Получаем информацию о боте
      const botInfo = await this.bot.telegram.getMe()
      console.log(`✅ Бот готов: @${botInfo.username} (${botInfo.first_name})`)
      console.log('ℹ️ Используется webhook режим (polling отключен)')
      
      return true
    } catch (error) {
      console.error('❌ Ошибка подготовки бота:', error.message)
      return false
    }
  }
  
  // Остановка бота
  stop() {
    if (this.bot) {
      console.log('🛑 Остановка Telegraf бота...')
      this.bot.stop()
    }
  }
  
  // Проверка состояния
  async getStatus() {
    if (!this.bot) {
      return { ok: false, error: 'Бот не инициализирован' }
    }
    
    try {
      const botInfo = await this.bot.telegram.getMe()
      return { 
        ok: true, 
        bot: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name
        }
      }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  }
}

// Создаем глобальный экземпляр
const telegrafBot = new TelegrafBot()

export default telegrafBot