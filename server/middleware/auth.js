import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Функция для проверки подписи Telegram initData
function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return false

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    urlParams.delete('hash')

    // Сортируем параметры и создаем строку для проверки
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Создаем секретный ключ
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    
    // Вычисляем ожидаемый хэш
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    return hash === expectedHash
  } catch (error) {
    console.error('Error verifying Telegram initData:', error)
    return false
  }
}

// Функция для извлечения пользователя из initData
function getUserFromInitData(initData) {
  try {
    const urlParams = new URLSearchParams(initData)
    const userParam = urlParams.get('user')
    
    if (!userParam) return null
    
    return JSON.parse(decodeURIComponent(userParam))
  } catch (error) {
    console.error('Error parsing user from initData:', error)
    return null
  }
}

// Middleware для проверки аутентификации
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const initData = req.headers['x-telegram-init-data']
  
  // Получаем конфигурацию
  const adminUserId = process.env.ADMIN_USER_ID
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const apiKey = process.env.API_SECRET_KEY

  // Способ 1: Проверка API ключа (для сервер-сервер взаимодействия)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token === apiKey) {
      return next()
    }
  }

  // Способ 2: Проверка Telegram аутентификации
  if (initData && adminUserId && botToken) {
    const isValidInitData = verifyTelegramInitData(initData, botToken)
    
    if (isValidInitData) {
      const user = getUserFromInitData(initData)
      
      if (user && user.id && user.id.toString() === adminUserId.toString()) {
        return next()
      }
    }
  }

  // Способ 3: Проверка пароля (для резервного доступа)
  if (req.body.password) {
    const passwordHash = process.env.EDITOR_PASSWORD_HASH
    if (passwordHash && bcrypt.compareSync(req.body.password, passwordHash)) {
      return next()
    }
  }

  // Если ни один способ не сработал
  return res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Требуется аутентификация для доступа к API'
  })
}

// Middleware для проверки только чтения (более мягкая защита)
export function requireReadAuth(req, res, next) {
  // Для GET запросов разрешаем доступ всем (но можно добавить rate limiting)
  if (req.method === 'GET') {
    return next()
  }
  
  // Для остальных методов требуем полную аутентификацию
  return requireAuth(req, res, next)
} 