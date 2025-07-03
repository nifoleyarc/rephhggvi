// Простой rate limiter для защиты от DDoS
const requestCounts = new Map()

export function rateLimit(req, res, next) {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   'unknown'

  const now = Date.now()
  const windowMs = 60 * 1000 // 1 минута
  const maxRequests = 100 // максимум 100 запросов в минуту

  // Очищаем старые записи
  if (requestCounts.has(clientIP)) {
    const { count, resetTime } = requestCounts.get(clientIP)
    if (now > resetTime) {
      requestCounts.delete(clientIP)
    }
  }

  // Получаем или создаем счетчик для IP
  const current = requestCounts.get(clientIP) || { count: 0, resetTime: now + windowMs }
  
  if (current.count >= maxRequests) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Слишком много запросов. Попробуйте позже.',
      retryAfter: Math.ceil((current.resetTime - now) / 1000)
    })
  }

  // Увеличиваем счетчик
  current.count++
  requestCounts.set(clientIP, current)

  // Добавляем заголовки с информацией о лимитах
  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': maxRequests - current.count,
    'X-RateLimit-Reset': current.resetTime
  })

  next()
} 