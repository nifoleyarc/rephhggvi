import express from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDatabase } from '../database/init.js'

const router = express.Router()

// Константы для защиты от брут-форс
const MAX_ATTEMPTS = 5
const BAN_DURATION = 2 * 60 * 60 * 1000 // 2 часа в миллисекундах
const PROGRESSIVE_DELAYS = [1000, 2000, 5000, 10000, 15000] // Прогрессивные задержки

// Функция для получения IP адреса
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown'
}

// Функция для проверки и обновления попыток входа
async function checkAndUpdateAttempts(ip, success = false) {
  const db = await getDatabase()
  
  try {
    const now = new Date()
    
    // Находим запись для данного IP
    let record = await db.get('SELECT * FROM auth_attempts WHERE ip = ?', [ip])

    if (!record) {
      // Создаем новую запись
      record = {
        ip,
        attempts: 0,
        first_attempt: now.toISOString(),
        last_attempt: now.toISOString(),
        banned_until: null
      }
    }

    // Проверяем, забанен ли IP
    if (record.banned_until && new Date(record.banned_until) > now) {
      const remainingTime = new Date(record.banned_until) - now
      console.log(`IP ${ip} is banned for ${Math.ceil(remainingTime / (60 * 1000))} more minutes`)
      return {
        banned: true,
        remainingTime
      }
    }

    // Если бан истек, очищаем запись
    if (record.banned_until && new Date(record.banned_until) <= now) {
      await db.run('DELETE FROM auth_attempts WHERE ip = ?', [ip])
      console.log(`Ban expired for IP ${ip}, clearing record`)
      return { banned: false }
    }

    if (success) {
      // Успешная аутентификация - удаляем запись
      await db.run('DELETE FROM auth_attempts WHERE ip = ?', [ip])
      console.log(`Successful auth for IP ${ip}, clearing attempts`)
      return { banned: false }
    } else {
      // Неудачная попытка
      record.attempts += 1
      record.last_attempt = now.toISOString()
      
      console.log(`Failed auth attempt ${record.attempts}/${MAX_ATTEMPTS} for IP ${ip}`)

      if (record.attempts >= MAX_ATTEMPTS) {
        // Превышен лимит попыток - баним
        record.banned_until = new Date(now.getTime() + BAN_DURATION).toISOString()
        
        await db.run(`
          INSERT OR REPLACE INTO auth_attempts 
          (ip, attempts, first_attempt, last_attempt, banned_until)
          VALUES (?, ?, ?, ?, ?)
        `, [record.ip, record.attempts, record.first_attempt, record.last_attempt, record.banned_until])

        console.log(`IP ${ip} banned for ${BAN_DURATION / (60 * 1000)} minutes after ${MAX_ATTEMPTS} attempts`)
        return {
          banned: true,
          remainingTime: BAN_DURATION
        }
      } else {
        // Обновляем счетчик попыток
        await db.run(`
          INSERT OR REPLACE INTO auth_attempts 
          (ip, attempts, first_attempt, last_attempt, banned_until)
          VALUES (?, ?, ?, ?, ?)
        `, [record.ip, record.attempts, record.first_attempt, record.last_attempt, null])

        return { 
          banned: false,
          attempts: record.attempts,
          delay: PROGRESSIVE_DELAYS[record.attempts - 1] || PROGRESSIVE_DELAYS[PROGRESSIVE_DELAYS.length - 1]
        }
      }
    }

  } catch (error) {
    console.error('Auth attempts error:', error)
    return { banned: false }
  }
}

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

// POST /api/auth - аутентификация
router.post('/', async (req, res) => {
  const clientIP = getClientIP(req)
  console.log('Auth attempt from IP:', clientIP)

  try {
    const { password, initData } = req.body
    
    // Получаем конфигурацию
    const adminUserId = process.env.ADMIN_USER_ID
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const passwordHash = process.env.EDITOR_PASSWORD_HASH

    // Способ 1: Аутентификация админа по Telegram User ID
    if (initData && adminUserId && botToken) {
      console.log('Attempting Telegram admin authentication')
      
      // Проверяем подпись initData для безопасности
      const isValidInitData = verifyTelegramInitData(initData, botToken)
      
      if (!isValidInitData) {
        console.log('Invalid Telegram initData signature')
        return res.status(401).json({ success: false, error: 'Invalid Telegram data' })
      }

      // Извлекаем данные пользователя
      const user = getUserFromInitData(initData)
      
      if (!user || !user.id) {
        console.log('No user data in initData')
        return res.status(401).json({ success: false, error: 'No user data' })
      }

      // Проверяем, что это админ
      if (user.id.toString() === adminUserId.toString()) {
        console.log(`Admin authenticated: ${user.first_name} (${user.id})`)
        
        // Сбрасываем счетчик попыток при успешной аутентификации админа
        await checkAndUpdateAttempts(clientIP, true)
        
        return res.status(200).json({ 
          success: true, 
          method: 'telegram',
          user: {
            id: user.id,
            first_name: user.first_name,
            username: user.username
          }
        })
      } else {
        console.log(`Access denied for user: ${user.first_name} (${user.id}) - not admin`)
        
        // НЕ записываем как неудачную попытку - пользователь просто не админ
        return res.status(403).json({ success: false, error: 'Access denied' })
      }
    }

    // Способ 2: Аутентификация по паролю (резервный способ)
    if (password) {
      console.log('Attempting password authentication')
      
      // Проверяем, не забанен ли IP перед попыткой пароля
      const banCheck = await checkAndUpdateAttempts(clientIP)
      
      if (banCheck.banned) {
        const minutesRemaining = Math.ceil(banCheck.remainingTime / (60 * 1000))
        const hoursRemaining = Math.ceil(banCheck.remainingTime / (60 * 60 * 1000))
        console.log(`IP ${clientIP} is banned for ${minutesRemaining} minutes (${hoursRemaining} hours)`)
        return res.status(429).json({ 
          success: false, 
          error: 'Access temporarily restricted',
          retryAfter: hoursRemaining,
          remainingMinutes: minutesRemaining
        })
      }
      
      if (!passwordHash) {
        console.error('EDITOR_PASSWORD_HASH not set')
        return res.status(500).json({ error: 'Server configuration error' })
      }

      // Проверяем пароль
      const isValid = await bcrypt.compare(password, passwordHash)
      
      if (isValid) {
        console.log('Password authentication successful')
        
        // Сбрасываем счетчик попыток при успешной аутентификации
        await checkAndUpdateAttempts(clientIP, true)
        
        return res.status(200).json({ success: true, method: 'password' })
      } else {
        console.log('Invalid password from IP:', clientIP)
        
        // Записываем неудачную попытку
        const attemptResult = await checkAndUpdateAttempts(clientIP, false)
        
        if (attemptResult.banned) {
          const minutesRemaining = Math.ceil(attemptResult.remainingTime / (60 * 1000))
          const hoursRemaining = Math.ceil(attemptResult.remainingTime / (60 * 60 * 1000))
          console.log(`IP ${clientIP} banned for ${minutesRemaining} minutes after ${MAX_ATTEMPTS} failed attempts`)
          return res.status(429).json({ 
            success: false, 
            error: 'Access temporarily restricted',
            retryAfter: hoursRemaining,
            remainingMinutes: minutesRemaining
          })
        }

        // Добавляем прогрессивную задержку для защиты от брут-форс атак
        const delay = attemptResult.delay || 1000
        console.log(`Adding ${delay}ms delay for failed attempt ${attemptResult.attempts}/${MAX_ATTEMPTS}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return res.status(401).json({ success: false, error: 'Invalid password' })
      }
    }

    // Если нет ни initData, ни пароля
    return res.status(400).json({ error: 'Authentication data required' })

  } catch (error) {
    console.error('Auth error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router 