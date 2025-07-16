// Конфигурация API для фронтенда
export const API_CONFIG = {
  // Базовый URL для API
  getBaseURL() {
    // В production проверяем переменную окружения
    if (import.meta.env.PROD) {
      const apiUrl = import.meta.env.VITE_API_URL
      if (apiUrl) {
        console.log('🌐 Using API URL from environment:', apiUrl)
        return apiUrl
      }
      
      // Fallback для продакшена если API URL не настроен
      console.log('⚠️ VITE_API_URL not set, using fallback')
      return 'https://gensyxavods.com/api'
    }
    
    // В development используем локальный сервер
    return 'http://localhost:3000/api'
  },

  // Полный URL для API
  get baseURL() {
    return this.getBaseURL()
  },

  // Проверка доступности API
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/`, {
        headers: this.getDataHeaders()
      })
      return response.ok
    } catch (error) {
      console.error('API connection check failed:', error)
      return false
    }
  },

  // Состояние аутентификации
  _authState: {
    isAuthenticated: false,
    authMethod: null,
    authData: null
  },

  // Установка состояния аутентификации
  setAuthState(isAuthenticated, method = null, data = null) {
    this._authState = {
      isAuthenticated,
      authMethod: method,
      authData: data
    }
  },

  // Получение состояния аутентификации
  getAuthState() {
    return this._authState
  },

  // Получение headers для аутентификации
  getAuthHeaders(telegramInitData = null) {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Приоритет 1: Telegram InitData (если передан)
    if (telegramInitData) {
      headers['x-telegram-init-data'] = telegramInitData
      return headers
    }

    // Приоритет 2: Сохранённые данные аутентификации
    if (this._authState.isAuthenticated) {
      if (this._authState.authMethod === 'telegram' && this._authState.authData) {
        headers['x-telegram-init-data'] = this._authState.authData
      }
      // Для авторизации через пароль добавляем специальный заголовок
      if (this._authState.authMethod === 'password') {
        headers['x-admin-auth'] = 'true'
      }
      return headers
    }

    // Приоритет 3: Frontend ключ как fallback для базового доступа
    const frontendKey = import.meta.env.VITE_FRONTEND_KEY
    if (frontendKey) {
      headers['x-frontend-key'] = frontendKey
    }

    return headers
  },

  // Получение headers для API запросов с API ключом
  getAPIHeaders(apiKey = null) {
    const headers = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    return headers
  },

  // Получение headers для доступа к данным (для GET запросов)
  getDataHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Добавляем frontend ключ для доступа к данным
    const frontendKey = import.meta.env.VITE_FRONTEND_KEY
    if (frontendKey) {
      headers['x-frontend-key'] = frontendKey
    }

    return headers
  }
}

// Демо-данные для случаев когда API недоступен
export const DEMO_DATA = {
  streams: [
    {
      _id: 'demo-1',
      title: 'Демо стрим #1 - Тест подключения',
      date: '2024-01-15T20:00:00.000Z',
      categories: ['just_chatting'],
      tags: ['#demo', '#test'],
      telegramUrl: 'https://t.me/demo/1',
      thumbnail: {
        url: 'https://via.placeholder.com/320x180/1a1a1a/ffffff?text=Demo+Stream+1',
        source: 'demo'
      }
    },
    {
      _id: 'demo-2',
      title: 'Демо стрим #2 - Проверка API',
      date: '2024-01-20T18:30:00.000Z',
      categories: ['gaming'],
      tags: ['#demo', '#gaming'],
      telegramUrl: 'https://t.me/demo/2',
      thumbnail: {
        url: 'https://via.placeholder.com/320x180/1a1a1a/ffffff?text=Demo+Stream+2',
        source: 'demo'
      }
    }
  ],
  categories: [
    { _id: 'demo-cat-1', name: 'Just Chatting', tag: 'just_chatting' },
    { _id: 'demo-cat-2', name: 'Gaming', tag: 'gaming' }
  ]
}

// Вспомогательная функция для безопасного выполнения API запросов
export async function safeApiCall(apiCall, fallbackData = null) {
  try {
    return await apiCall()
  } catch (error) {
    console.error('API call failed:', error)
    
    // Если есть fallback данные, возвращаем их
    if (fallbackData) {
      console.log('Using fallback data')
      return fallbackData
    }
    
    // Иначе пробрасываем ошибку
    throw error
  }
} 