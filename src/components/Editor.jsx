import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Edit, Trash2, Save, Eye, EyeOff, ArrowLeft, RefreshCw, Calendar, Play, ImageIcon, ImageOff, Search, Tag, User, Link, Hash, Clock, FileText, Settings, RotateCcw, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTelegram } from '../hooks/useTelegram'
import { useStreams } from '../hooks/useStreams'
import { API_CONFIG } from '../utils/api'
import axios from 'axios'

// Утилита для безопасной обработки дат
const formatDateSafely = (dateString, formatStr, options = {}) => {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return ''
    }
    return format(date, formatStr, options)
  } catch (error) {
    console.warn('Invalid date format:', dateString)
    return ''
  }
}

// Утилита для форматирования даты для datetime-local input
const formatDateTimeLocal = (dateString) => {
  try {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    
    // Форматируем в yyyy-MM-ddTHH:mm формат для datetime-local
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch (error) {
    console.warn('Invalid date format:', dateString)
    return ''
  }
}

// Функция для получения текущей даты в UTC+5
const getCurrentDateUTC5 = () => {
  const now = new Date()
  // Получаем время в UTC+5 (добавляем 5 часов к UTC)
  const utc5Time = new Date(now.getTime() + (5 * 60 * 60 * 1000))
  return utc5Time.toISOString()
}

// Функция для получения текущей даты в UTC+5 для datetime-local input
const getCurrentDateTimeLocalUTC5 = () => {
  const now = new Date()
  // Получаем время в UTC+5 (добавляем 5 часов к UTC)
  const utc5Time = new Date(now.getTime() + (5 * 60 * 60 * 1000))
  return utc5Time.toISOString().slice(0, 16)
}

// Утилита для безопасной проверки дат в поиске
const checkDateMatch = (dateString, query) => {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return false
    }
    
    const shortDate = format(date, 'dd.MM.yy')
    const longDate = format(date, 'dd MMM yyyy', { locale: ru }).toLowerCase()
    
    return shortDate.includes(query) || longDate.includes(query)
  } catch (error) {
    console.warn('Invalid date format:', dateString)
    return false
  }
}

const ThumbnailImage = ({ thumbnail }) => {
  const [error, setError] = useState(false)

  // Извлекаем URL из объекта или используем строку напрямую (обратная совместимость)
  const thumbnailUrl = typeof thumbnail === 'object' && thumbnail?.url 
    ? thumbnail.url 
    : typeof thumbnail === 'string' 
    ? thumbnail 
    : null

  // Если нет thumbnail URL, показываем placeholder
  if (!thumbnailUrl || !thumbnailUrl.startsWith('http')) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Play size={16} className="text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Play size={16} className="text-gray-400" />
      </div>
    )
  }

  return (
    <img
      src={thumbnailUrl}
      alt="Превью стрима"
      className="w-full h-full object-cover"
      onError={() => {
        console.error('Image load error for URL:', thumbnailUrl)
        setError(true)
      }}
    />
  )
}

// Функция для получения цвета тега
const getTagColor = (tag) => {
  const tagLower = tag.toLowerCase().replace('#', '')
  switch (tagLower) {
    case 'ирл':
      return 'bg-blue-500/40 text-blue-200'
    case 'фильм':
      return 'bg-purple-500/40 text-purple-200'
    case 'just_chatting':
      return 'bg-blue-500/40 text-blue-200'
    case 'игры':
      return 'bg-red-500/40 text-red-200'
    case 'контент':
      return 'bg-green-600/40 text-green-200'
    case 'шоу':
      return 'bg-purple-500/40 text-purple-200'
    case 'кукинг':
      return 'bg-emerald-500/40 text-emerald-200'
    case 'марафон':
      return 'bg-amber-500/40 text-amber-200'
    default:
      return 'bg-gray-500/40 text-gray-200'
  }
}

// Форма добавления нового стрима
const AddStreamForm = ({ onAdd, categories, showToast, hapticFeedback }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    streamUrl: '',
    category: '',
    tags: '',
    date: getCurrentDateTimeLocalUTC5(), // Устанавливаем текущую дату и время в UTC+5
    thumbnail: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setFormData({
      title: '',
      streamUrl: '',
      category: '',
      tags: '',
      date: getCurrentDateTimeLocalUTC5(), // Устанавливаем текущую дату и время в UTC+5
      thumbnail: ''
    })
    setIsExpanded(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.streamUrl.trim()) {
      showToast('Название и ссылка обязательны', 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      const streamData = {
        title: formData.title,
        telegramUrl: formData.streamUrl, // Исправляем поле для сервера
        date: formData.date || getCurrentDateUTC5(), // Устанавливаем дату по умолчанию в UTC+5
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        categories: formData.category ? [formData.category] : [], // Преобразуем в массив
        thumbnail: formData.thumbnail || undefined
      }
      
      await onAdd(streamData)
      resetForm()
      showToast('Стрим добавлен', 'success')
      hapticFeedback('notification', 'success')
    } catch (error) {
      console.error('Error adding stream:', error)
      showToast('Ошибка добавления стрима', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700"
    >
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Plus size={20} className="text-green-400" />
        <span className="text-lg font-medium text-white">Добавить новый стрим</span>
        <motion.div
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Plus size={16} className="text-gray-400" />
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="mt-4 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Название стрима *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите название стрима"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Ссылка на стрим *
                </label>
                <input
                  type="url"
                  value={formData.streamUrl}
                  onChange={(e) => setFormData({...formData, streamUrl: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Категория
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите категорию</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.tag}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Дата стрима <span className="text-gray-400 text-xs">(UTC+5)</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Теги (через запятую)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="игры, контент, ирл"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Превью (URL)
                </label>
                <input
                  type="url"
                  value={formData.thumbnail}
                  onChange={(e) => setFormData({...formData, thumbnail: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Добавить стрим
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Отмена
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Карточка стрима для редактирования
const StreamCard = ({ stream, isEditing, onEdit, onCancelEdit, onSave, onDelete, onRefreshThumbnail, categories, showToast, hapticFeedback }) => {
  const [editData, setEditData] = useState({
    title: stream.title || '',
    streamUrl: stream.streamUrl || stream.telegram_url || '',
    category: (Array.isArray(stream.categories) && stream.categories.length > 0) ? stream.categories[0] : '',
    tags: Array.isArray(stream.tags) ? stream.tags.join(', ') : '',
    date: formatDateTimeLocal(stream.date || stream.stream_date),
    thumbnail: stream.thumbnail || ''
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isEditing) {
      setEditData({
        title: stream.title || '',
        streamUrl: stream.streamUrl || stream.telegram_url || '',
        category: (Array.isArray(stream.categories) && stream.categories.length > 0) ? stream.categories[0] : '',
        tags: Array.isArray(stream.tags) ? stream.tags.join(', ') : '',
        date: formatDateTimeLocal(stream.date || stream.stream_date),
        thumbnail: typeof stream.thumbnail === 'object' && stream.thumbnail?.url 
          ? stream.thumbnail.url 
          : stream.thumbnail || ''
      })
    }
  }, [isEditing, stream])

  const handleSave = async () => {
    if (!editData.title.trim()) {
      showToast('Название обязательно', 'warning')
      return
    }

    setIsLoading(true)
    try {
      const streamData = {
        title: editData.title,
        telegramUrl: editData.streamUrl, // Исправляем поле для сервера
        date: editData.date || getCurrentDateUTC5(), // Устанавливаем дату по умолчанию в UTC+5
        tags: editData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        categories: editData.category ? [editData.category] : [], // Преобразуем в массив
        thumbnail: editData.thumbnail || undefined
      }
      
      await onSave(streamData, stream.id || stream._id)
      onCancelEdit()
      showToast('Стрим обновлен', 'success')
      hapticFeedback('notification', 'success')
    } catch (error) {
      console.error('Error updating stream:', error)
      showToast('Ошибка обновления стрима', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Удалить этот стрим?')) {
      setIsLoading(true)
      try {
        await onDelete(stream.id || stream._id)
        showToast('Стрим удален', 'success')
        hapticFeedback('notification', 'success')
      } catch (error) {
        console.error('Error deleting stream:', error)
        showToast('Ошибка удаления стрима', 'error')
      } finally {
        setIsLoading(false)
      }
    }
  }

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg p-4 border border-blue-500"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Название стрима *
            </label>
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData({...editData, title: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите название стрима"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ссылка на стрим
              </label>
              <input
                type="url"
                value={editData.streamUrl}
                onChange={(e) => setEditData({...editData, streamUrl: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Категория
              </label>
              <select
                value={editData.category}
                onChange={(e) => setEditData({...editData, category: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите категорию</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.tag}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Дата стрима <span className="text-gray-400 text-xs">(UTC+5)</span>
              </label>
              <input
                type="datetime-local"
                value={editData.date}
                onChange={(e) => setEditData({...editData, date: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Теги (через запятую)
              </label>
              <input
                type="text"
                value={editData.tags}
                onChange={(e) => setEditData({...editData, tags: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="игры, контент, ирл"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Превью (URL)
            </label>
            <input
              type="url"
              value={editData.thumbnail}
              onChange={(e) => setEditData({...editData, thumbnail: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Сохранить
            </button>
            <button
              onClick={onCancelEdit}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors"
    >
      <div className="aspect-video bg-gray-900 relative">
        <ThumbnailImage thumbnail={stream.thumbnail} />
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => onRefreshThumbnail(stream.id || stream._id)}
            disabled={isLoading}
            className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors disabled:opacity-50"
            title="Обновить превью"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => onEdit(stream)}
            className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
            title="Редактировать"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="p-1.5 bg-black/60 text-red-400 rounded-full hover:bg-black/80 transition-colors disabled:opacity-50"
            title="Удалить"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
          {stream.title}
        </h3>

        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Calendar size={14} />
          <span>{formatDateSafely(stream.date || stream.stream_date, 'dd MMM yyyy, HH:mm', { locale: ru })}</span>
        </div>

        {stream.tags && stream.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stream.tags.map((tag, index) => (
              <span
                key={index}
                className={`px-2 py-1 rounded-full text-xs font-medium ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Основной компонент редактора
const Editor = ({ onClose, showToast, onDataUpdate }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingStream, setEditingStream] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isBanned, setIsBanned] = useState(false)
  const [banTimeRemaining, setBanTimeRemaining] = useState(0)
  
  const { tg, hapticFeedback, initData } = useTelegram()
  const { 
    streams, 
    categories, 
    addStream, 
    updateStream, 
    deleteStream,
    fetchStreams 
  } = useStreams()

  useEffect(() => {
    fetchStreams()
  }, [])

  // Автоматическая аутентификация админа при загрузке
  useEffect(() => {
    let authAttempted = false
    
    const tryTelegramAuth = async () => {
      if (authAttempted || !tg || !tg.initData || isAuthenticated) {
        return
      }
      
      authAttempted = true
      console.log('Attempting automatic admin authentication...')
      
      try {
        const response = await axios.post(`${API_CONFIG.baseURL}/auth`, { 
          initData: tg.initData 
        }, {
          headers: API_CONFIG.getAuthHeaders(tg.initData)
        })
        
        if (response.data.success && response.data.method === 'telegram') {
          console.log('Admin auto-authenticated:', response.data.user)
          setIsAuthenticated(true)
          setIsBanned(false)
          setBanTimeRemaining(0)
          
          API_CONFIG.setAuthState(true, 'telegram', tg.initData)
          
          showToast(`Добро пожаловать, ${response.data.user.first_name}!`, 'success')
          hapticFeedback('notification', 'success')
        }
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.data.retryAfter || 24
          setIsBanned(true)
          setBanTimeRemaining(retryAfter)
          console.warn('Auto-auth: IP banned for', retryAfter, 'hours')
        } else if (error.response?.status === 403) {
          console.log('User is not admin, showing login form')
        } else {
          console.log('Auto-authentication failed:', error.message)
        }
      }
    }

    const timer = setTimeout(tryTelegramAuth, 500)
    return () => {
      clearTimeout(timer)
      authAttempted = false
    }
  }, [initData, isAuthenticated])

  const handleAuth = async () => {
    if (!password.trim()) {
      showToast('Введите пароль', 'warning')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(`${API_CONFIG.baseURL}/auth`, { 
        password,
        ...(initData && { initData: initData })
      }, {
        headers: API_CONFIG.getAuthHeaders(initData)
      })
      
      if (response.data.success) {
        setIsAuthenticated(true)
        setIsBanned(false)
        setBanTimeRemaining(0)
        
        const method = response.data.method
        const userName = response.data.user?.first_name || 'Админ'
        
        if (method === 'telegram' && initData) {
          API_CONFIG.setAuthState(true, 'telegram', initData)
        } else if (method === 'password') {
          API_CONFIG.setAuthState(true, 'password', null)
        } else {
          API_CONFIG.setAuthState(true, method, null)
        }
        
        showToast(`Добро пожаловать, ${userName}! (${method})`, 'success')
        hapticFeedback('notification', 'success')
      } else {
        showToast('Неверный пароль', 'error')
        hapticFeedback('notification', 'error')
      }
    } catch (error) {
      console.error('Authentication error:', error)
      
      if (error.response?.status === 429) {
        const retryAfter = error.response.data.retryAfter || 24
        setIsBanned(true)
        setBanTimeRemaining(retryAfter)
        const minutes = error.response.data.remainingMinutes || (retryAfter * 60)
        const displayTime = minutes > 60 ? `${retryAfter} ч.` : `${minutes} мин.`
        showToast(`Доступ ограничен на ${displayTime}`, 'error')
      } else {
        showToast('Ошибка аутентификации', 'error')
      }
      hapticFeedback('notification', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStream = async (streamData) => {
    try {
      await addStream(streamData)
      fetchStreams()
      if (onDataUpdate) onDataUpdate()
    } catch (error) {
      console.error('Error adding stream:', error)
      throw error
    }
  }

  const handleUpdateStream = async (streamData, streamId) => {
    try {
      await updateStream(streamId, streamData)
      setEditingStream(null)
      fetchStreams()
      if (onDataUpdate) onDataUpdate()
    } catch (error) {
      console.error('Error updating stream:', error)
      throw error
    }
  }

  const handleDeleteStream = async (streamId) => {
    try {
      await deleteStream(streamId)
      fetchStreams()
      if (onDataUpdate) onDataUpdate()
    } catch (error) {
      console.error('Error deleting stream:', error)
      throw error
    }
  }

  const handleRefreshThumbnail = async (streamId) => {
    try {
      const response = await axios.post(
        `${API_CONFIG.baseURL}/streams/${streamId}/refresh-thumbnail`,
        {},
        { headers: API_CONFIG.getAuthHeaders(initData) }
      )
      
      if (response.data.success) {
        fetchStreams()
        if (onDataUpdate) onDataUpdate()
      }
    } catch (error) {
      console.error('Error refreshing thumbnail:', error)
      throw error
    }
  }

  // Фильтрация стримов по поиску
  const filteredStreams = streams.filter(stream => {
    const query = searchQuery.toLowerCase()
    return (
      stream.title?.toLowerCase().includes(query) ||
      stream.category?.toLowerCase().includes(query) ||
      stream.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      checkDateMatch(stream.date || stream.stream_date, query)
    )
  })

  // Группировка по датам
  const groupedStreams = filteredStreams.reduce((groups, stream) => {
    const date = formatDateSafely(stream.date || stream.stream_date, 'dd MMMM yyyy', { locale: ru })
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(stream)
    return groups
  }, {})

  // Форма входа
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Вход в редактор</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {isBanned ? (
            <div className="text-center py-4">
              <div className="text-red-400 mb-2">
                <Settings size={48} className="mx-auto mb-2" />
                <p className="text-lg font-medium">Доступ ограничен</p>
              </div>
              <p className="text-gray-400">
                Попробуйте позже ({banTimeRemaining} ч.)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleAuth()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <button
                onClick={handleAuth}
                disabled={loading || !password.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ArrowLeft size={20} />
                )}
                Войти
              </button>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 rounded-lg w-full max-w-6xl mx-4 h-[90vh] flex flex-col"
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Редактор стримов</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Форма добавления */}
          <AddStreamForm
            onAdd={handleAddStream}
            categories={categories}
            showToast={showToast}
            hapticFeedback={hapticFeedback}
          />

          {/* Поиск */}
          <div className="mb-6">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск стримов..."
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Список стримов */}
          <div className="space-y-6">
            {Object.entries(groupedStreams).map(([dateGroup, streamsInGroup]) => (
              <div key={dateGroup}>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar size={18} />
                  {dateGroup} ({streamsInGroup.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {streamsInGroup.map(stream => (
                    <StreamCard
                      key={stream.id || stream._id}
                      stream={stream}
                      isEditing={editingStream !== null && ((editingStream.id || editingStream._id) === (stream.id || stream._id))}
                      onEdit={setEditingStream}
                      onCancelEdit={() => setEditingStream(null)}
                      onSave={handleUpdateStream}
                      onDelete={handleDeleteStream}
                      onRefreshThumbnail={handleRefreshThumbnail}
                      categories={categories}
                      showToast={showToast}
                      hapticFeedback={hapticFeedback}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredStreams.length === 0 && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-400">Стримы не найдены</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default Editor 