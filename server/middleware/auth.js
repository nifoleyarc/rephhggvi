import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Функция для проверки подписи Telegram initData
function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return false

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    urlParams.delete('hash')

    // Проверяем наличие обязательных параметров
    if (!hash || !urlParams.get('user')) {
      return false
    }

    // Сортируем параметры и создаем строку для проверки
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Создаем секретный ключ
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    
    // Вычисляем ожидаемый хэш
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    // Проверяем срок действия (не старше 24 часов)
    const authDate = parseInt(urlParams.get('auth_date') || '0')
    const now = Math.floor(Date.now() / 1000)
    const maxAge = 24 * 60 * 60 // 24 часа

    if (now - authDate > maxAge) {
      console.warn('Telegram initData expired')
      return false
    }

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

// Функция для проверки Origin/Referer
function isOriginAllowed(req) {
  const origin = req.headers.origin || req.headers.referer
  const allowedOrigins = [
    'https://nifoleyarc.github.io',
    'https://nifoleyarc.github.io/rephhggvi',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean)

  if (!origin) return false

  // Проверяем точное совпадение или начало URL для GitHub Pages
  return allowedOrigins.some(allowed => 
    origin === allowed || 
    origin.startsWith(allowed + '/') ||
    origin.startsWith(allowed + '?')
  )
}

// Функция для проверки IP whitelist (опционально)
function isIPWhitelisted(req) {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
  const whitelist = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : []
  
  if (whitelist.length === 0) return true // Если whitelist не настроен, разрешаем все
  
  return whitelist.includes(clientIP)
}

// Middleware для проверки аутентификации
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const initData = req.headers['x-telegram-init-data']
  
  // Получаем конфигурацию
  const adminUserId = process.env.ADMIN_USER_ID
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const apiKey = process.env.API_SECRET_KEY

  // Проверяем обязательные настройки
  if (!adminUserId || !botToken || !apiKey) {
    console.error('Missing required environment variables for authentication')
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Аутентификация не настроена должным образом'
    })
  }

  // Проверяем IP whitelist если настроен
  if (!isIPWhitelisted(req)) {
    console.warn('Request from non-whitelisted IP:', req.ip)
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Доступ запрещен'
    })
  }

  // Способ 1: Проверка API ключа (для сервер-сервер взаимодействия)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Пустой токен'
      })
    }

    if (token === apiKey) {
      req.authMethod = 'api-key'
      req.user = { type: 'api', id: 'server' }
      return next()
    }
  }

  // Способ 2: Проверка Telegram аутентификации
  if (initData) {
    const isValidInitData = verifyTelegramInitData(initData, botToken)
    
    if (isValidInitData) {
      const user = getUserFromInitData(initData)
      
      if (user && user.id && user.id.toString() === adminUserId.toString()) {
        req.authMethod = 'telegram'
        req.user = { type: 'telegram', id: user.id, username: user.username }
        return next()
      } else {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'У вас нет прав администратора'
        })
      }
    } else {
      return res.status(401).json({ 
        error: 'Invalid telegram data',
        message: 'Неверные данные Telegram'
      })
    }
  }

  // Способ 3: Проверка пароля (для резервного доступа)
  if (req.body && req.body.password) {
    const passwordHash = process.env.EDITOR_PASSWORD_HASH
    if (passwordHash && bcrypt.compareSync(req.body.password, passwordHash)) {
      req.authMethod = 'password'
      req.user = { type: 'password', id: 'admin' }
      return next()
    }
  }

  // Если ни один способ не сработал
  return res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Требуется аутентификация для доступа к API',
    details: 'Используйте Telegram аутентификацию, API ключ или пароль'
  })
}

// Middleware для проверки доступа к данным (для GET запросов)
export function requireDataAccess(req, res, next) {
  const authHeader = req.headers.authorization
  const frontendKey = req.headers['x-frontend-key']
  
  // Получаем конфигурацию
  const apiKey = process.env.API_SECRET_KEY
  const frontendApiKey = process.env.FRONTEND_API_KEY || process.env.API_SECRET_KEY

  // Способ 1: Проверка API ключа
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token === apiKey) {
      req.authMethod = 'api-key'
      req.user = { type: 'api', id: 'server' }
      return next()
    }
  }

  // Способ 2: Проверка frontend ключа
  if (frontendKey && frontendKey === frontendApiKey) {
    // Дополнительная проверка Origin для frontend запросов
    if (isOriginAllowed(req)) {
      req.authMethod = 'frontend-key'
      req.user = { type: 'frontend', id: 'website' }
      return next()
    } else {
      console.warn('Frontend key used from unauthorized origin:', req.headers.origin || req.headers.referer)
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Доступ запрещен с данного домена'
      })
    }
  }

  // Способ 3: Проверка только Origin (fallback для совместимости)
  if (isOriginAllowed(req)) {
    console.warn('Allowing access based on origin only (deprecated):', req.headers.origin || req.headers.referer)
    req.authMethod = 'origin-only'
    req.user = { type: 'origin', id: 'website' }
    return next()
  }

  // Если ни один способ не сработал
  return res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Доступ к данным запрещен',
    details: 'Используйте авторизованный фронтенд для доступа к данным'
  })
}

// Middleware для проверки только чтения (более мягкая защита)
export function requireReadAuth(req, res, next) {
  // Для GET запросов к публичным endpoints используем проверку доступа к данным
  const publicReadEndpoints = ['/streams', '/categories', '/']
  const isPublicRead = req.method === 'GET' && publicReadEndpoints.includes(req.path)
  
  if (isPublicRead) {
    return requireDataAccess(req, res, next)
  }
  
  // Для остальных методов требуем полную аутентификацию
  return requireAuth(req, res, next)
}

// Middleware для логирования аутентификации
export function logAuth(req, res, next) {
  console.log(`Auth: ${req.authMethod || 'none'} | User: ${req.user?.type || 'none'} | ${req.method} ${req.path}`)
  next()
} 