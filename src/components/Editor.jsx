import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Edit, Trash2, Save, Eye, EyeOff, ArrowLeft, RefreshCw, Calendar, Play, ImageIcon, ImageOff, Search, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTelegram } from '../hooks/useTelegram'
import { useStreams } from '../hooks/useStreams'
import { API_CONFIG } from '../utils/api'
import axios from 'axios'

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

const Editor = ({ onClose, showToast, onDataUpdate }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('streams')
  const [editingStream, setEditingStream] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [refreshingThumbnails, setRefreshingThumbnails] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [banTimeRemaining, setBanTimeRemaining] = useState(0)
  
  const { tg, hapticFeedback } = useTelegram()
  const { 
    streams, 
    categories, 
    addStream, 
    updateStream, 
    deleteStream,
    addCategory,
    updateCategory,
    deleteCategory,
    fetchStreams 
  } = useStreams()

  useEffect(() => {
    fetchStreams()
  }, [])

  // Автоматическая аутентификация админа при загрузке
  useEffect(() => {
    let authAttempted = false // Флаг для предотвращения повторных попыток
    
    const tryTelegramAuth = async () => {
      // Проверяем, что у нас есть данные и мы еще не пытались
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
        
        // Сохраняем состояние аутентификации в API_CONFIG
        API_CONFIG.setAuthState(true, 'telegram', tg.initData)
        
        showToast(`Добро пожаловать, ${response.data.user.first_name}!`, 'success')
        hapticFeedback('notification', 'success')
      }
      } catch (error) {
        // Проверяем на бан при автоматической аутентификации
        if (error.response?.status === 429) {
          const retryAfter = error.response.data.retryAfter || 24
          setIsBanned(true)
          setBanTimeRemaining(retryAfter)
          console.warn('Auto-auth: IP banned for', retryAfter, 'hours')
        } else if (error.response?.status === 403) {
          // Пользователь не админ - просто показываем форму входа без ошибок
          console.log('User is not admin, showing login form')
        } else {
          // Другие ошибки автоматической аутентификации
          console.log('Auto-authentication failed:', error.message)
        }
      }
    }

    // Даем время для инициализации Telegram WebApp
    const timer = setTimeout(tryTelegramAuth, 500)
    return () => {
      clearTimeout(timer)
      authAttempted = false // Сброс при размонтировании
    }
  }, [tg?.initData, isAuthenticated]) // Более точные зависимости

  // Защита от автоматического открытия редактирования при первой загрузке
  const hasLoadedStreamsRef = useRef(false)
  useEffect(() => {
    if (streams.length > 0 && !hasLoadedStreamsRef.current) {
      hasLoadedStreamsRef.current = true
      // При первой загрузке стримов сбрасываем любое состояние редактирования
      if (editingStream) {
        setEditingStream(null)
      }
    }
  }, [streams.length, editingStream])

  const handleAuth = async () => {
    if (!password.trim()) {
      showToast('Введите пароль', 'warning')
      return
    }

    setLoading(true)
    try {
      // ИСПРАВЛЕНО: Делаем только ОДИН запрос с паролем
      // Убираем дублирование с Telegram аутентификацией
      console.log('Attempting password authentication...')
      
      const response = await axios.post(`${API_CONFIG.baseURL}/auth`, { 
        password,
        // Включаем Telegram данные если есть (сервер выберет приоритет)
        ...(tg?.initData && { initData: tg.initData })
      }, {
        headers: API_CONFIG.getAuthHeaders(tg?.initData)
      })
      
      if (response.data.success) {
        setIsAuthenticated(true)
        setIsBanned(false)
        setBanTimeRemaining(0)
        
        const method = response.data.method
        const userName = response.data.user?.first_name || 'Админ'
        
        // Сохраняем состояние аутентификации в API_CONFIG
        if (method === 'telegram' && tg?.initData) {
          API_CONFIG.setAuthState(true, 'telegram', tg.initData)
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
      
      // Проверяем на временный бан
      if (error.response?.status === 429) {
        const retryAfter = error.response.data.retryAfter || 24
        setIsBanned(true)
        setBanTimeRemaining(retryAfter)
        const minutes = error.response.data.remainingMinutes || (retryAfter * 60)
        const displayTime = minutes > 60 ? `${retryAfter} ч.` : `${minutes} мин.`
        showToast(`Доступ ограничен на ${displayTime}`, 'error')
        hapticFeedback('notification', 'error')
      } else if (error.response?.status === 401) {
        showToast('Неверный пароль', 'error')
        hapticFeedback('notification', 'error')
      } else {
        showToast('Ошибка аутентификации', 'error')
        hapticFeedback('notification', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshThumbnails = async () => {
    setRefreshingThumbnails(true)
    try {
      const response = await axios.post(`${API_CONFIG.baseURL}/refresh-thumbnails`, {}, {
        headers: API_CONFIG.getAuthHeaders(tg?.initData)
      })
      if (response.data.success) {
        showToast(response.data.message, 'success')
        hapticFeedback('notification', 'success')
        // Обновляем список стримов после успешного обновления превью
        await fetchStreams()
      } else {
        showToast('Ошибка при обновлении превью', 'error')
        hapticFeedback('notification', 'error')
      }
    } catch (error) {
      console.error('Error refreshing thumbnails:', error)
      showToast('Ошибка при обновлении превью', 'error')
      hapticFeedback('notification', 'error')
    } finally {
      setRefreshingThumbnails(false)
    }
  }

  const handleRefreshSingleThumbnail = async (streamId) => {
    try {
      const response = await axios.post(`${API_CONFIG.baseURL}/refresh-thumbnail`, { streamId }, {
        headers: API_CONFIG.getAuthHeaders(tg?.initData)
      })
      if (response.data.success) {
        showToast(response.data.message, 'success')
        hapticFeedback('notification', 'success')
        // Обновляем список стримов после успешного обновления превью
        await fetchStreams()
      } else {
        showToast(response.data.message || 'Превью не найдено', 'warning')
        hapticFeedback('notification', 'warning')
      }
    } catch (error) {
      console.error('Error refreshing single thumbnail:', error)
      showToast('Ошибка при обновлении превью', 'error')
      hapticFeedback('notification', 'error')
    }
  }

  const handleStreamSave = async (streamData, streamId = null) => {
    try {
      if (editingStream || streamId) {
        const id = streamId || editingStream._id
        await updateStream(id, streamData)
        showToast('Стрим обновлён', 'success')
        // Закрываем режим редактирования
        setEditingStream(null)
      } else {
        await addStream(streamData)
        showToast('Стрим добавлен', 'success')
      }
      hapticFeedback('notification', 'success')
    } catch (error) {
      showToast('Ошибка при сохранении стрима', 'error')
      hapticFeedback('notification', 'error')
    }
  }

  const handleStreamDelete = async (streamId) => {
    try {
      await deleteStream(streamId)
      showToast('Стрим удалён', 'success')
      hapticFeedback('notification', 'success')
    } catch (error) {
      showToast('Ошибка при удалении стрима', 'error')
      hapticFeedback('notification', 'error')
    }
  }

  const handleCategorySave = async (categoryData) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory._id, categoryData)
        showToast('Категория обновлена', 'success')
      } else {
        await addCategory(categoryData)
        showToast('Категория добавлена', 'success')
      }
      setEditingCategory(null)
      hapticFeedback('notification', 'success')
    } catch (error) {
      showToast('Ошибка при сохранении категории', 'error')
      hapticFeedback('notification', 'error')
    }
  }

  const handleCategoryDelete = async (categoryId) => {
    try {
      await deleteCategory(categoryId)
      showToast('Категория удалена', 'success')
      hapticFeedback('notification', 'success')
    } catch (error) {
      showToast('Ошибка при удалении категории', 'error')
      hapticFeedback('notification', 'error')
    }
  }


  if (isBanned) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg text-tg-text p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-tg-secondary-bg rounded-lg p-6 max-w-md w-full text-center"
        >
          <h2 className="text-xl font-roobert-bold mb-4 text-red-400">Доступ ограничен</h2>
          <p className="text-tg-hint font-roobert-regular mb-4">
            Слишком много неудачных попыток входа. Попробуйте позже.
          </p>
          <p className="text-sm text-tg-hint font-roobert-light">
            Осталось: {Math.floor(banTimeRemaining)} часов
          </p>
          <button
            onClick={() => {
              // Сбрасываем состояние редактирования при закрытии
              setEditingStream(null)
              // Сбрасываем состояние аутентификации
              API_CONFIG.setAuthState(false, null, null)
              onClose()
            }}
            className="mt-4 px-4 py-2 bg-tg-button text-tg-button-text rounded-lg font-roobert-medium"
          >
            Вернуться
          </button>
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg text-tg-text p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-tg-secondary-bg rounded-lg p-6 max-w-md w-full"
        >
          <h2 className="text-xl font-roobert-bold mb-6 text-center">Вход</h2>
          
          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                className="w-full px-4 py-3 bg-tg-bg border border-gray-600 rounded-lg text-tg-text placeholder-tg-hint focus:outline-none focus:border-tg-button font-roobert-light"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-tg-hint hover:text-tg-text"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-tg-button text-tg-button-text py-3 rounded-lg font-roobert-medium disabled:opacity-50"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-tg-bg text-tg-text flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-tg-secondary-bg border-b border-gray-700">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => {
              // Сбрасываем состояние редактирования при закрытии
              setEditingStream(null)
              // Сбрасываем состояние аутентификации
              API_CONFIG.setAuthState(false, null, null)
              onClose()
            }}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-roobert-bold">Редактор контента</h1>
          <div />
        </div>
        
        {/* Tabs */}
        <div className="flex">
          <button
            onClick={() => setActiveTab('streams')}
            className={`flex-1 py-3 px-4 text-sm font-roobert-medium transition-colors ${
              activeTab === 'streams'
                ? 'bg-tg-button text-tg-button-text'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            Стримы ({streams.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-3 px-4 text-sm font-roobert-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-tg-button text-tg-button-text'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            Категории ({categories.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'streams' ? (
            <StreamsTab
              key="streams"
              streams={streams}
              editingStream={editingStream}
              setEditingStream={setEditingStream}
              onSave={handleStreamSave}
              onDelete={handleStreamDelete}
              onRefreshThumbnails={handleRefreshThumbnails}
              onRefreshSingleThumbnail={handleRefreshSingleThumbnail}
              refreshingThumbnails={refreshingThumbnails}

              showToast={showToast}
              hapticFeedback={hapticFeedback}
              onDataUpdate={onDataUpdate}
            />
          ) : (
            <CategoriesTab
              key="categories"
              categories={categories}
              editingCategory={editingCategory}
              setEditingCategory={setEditingCategory}
              onSave={handleCategorySave}
              onDelete={handleCategoryDelete}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Компонент для редактирования стримов (на основе StreamList)
const StreamsTab = ({ streams, editingStream, setEditingStream, onSave, onDelete, onRefreshThumbnails, onRefreshSingleThumbnail, refreshingThumbnails, showToast, hapticFeedback, onDataUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [refreshingSingle, setRefreshingSingle] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [addFormData, setAddFormData] = useState({
    title: '',
    date: '',
    time: '12:00', // Время по умолчанию
    tags: '',
    telegramUrl: '',
    thumbnail: ''
  })

  const handleAddSubmit = (e) => {
    e.preventDefault()
    
    // Объединяем дату и время в один объект Date
    const dateTime = new Date(`${addFormData.date}T${addFormData.time}:00`)
    
    const streamData = {
      ...addFormData,
      date: dateTime.toISOString(), // Сохраняем как ISO строку с временем
      tags: addFormData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    }
    
    // Убираем отдельное поле времени из данных
    delete streamData.time
    
    onSave(streamData)
    // Очищаем форму и закрываем её
    setAddFormData({
      title: '',
      date: '',
      time: '12:00',
      tags: '',
      telegramUrl: '',
      thumbnail: ''
    })
    // Закрываем форму после добавления
    setShowAddForm(false)
  }

  const handleRefreshSingle = async (streamId) => {
    setRefreshingSingle(prev => ({ ...prev, [streamId]: true }))
    try {
      await onRefreshSingleThumbnail(streamId)
    } finally {
      setRefreshingSingle(prev => ({ ...prev, [streamId]: false }))
    }
  }

  // Функции для работы с категориями и сортировкой (из StreamList)
  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') return streams.length
    return streams.filter(stream => 
      stream.categories?.includes(categoryId) ||
      stream.tags?.some(tag => tag.toLowerCase().includes(categoryId.toLowerCase()))
    ).length
  }

  const allCategories = [
    { id: 'all', name: '📺 Все', count: getCategoryCount('all') },
    { id: 'фильм', name: '🍿 Фильмы / Мультики', count: getCategoryCount('фильм') },
    { id: 'ирл', name: '🗺️ ИРЛ стримы', count: getCategoryCount('ирл') },
    { id: 'контент', name: '👀 Контент', count: getCategoryCount('контент') },
    { id: 'игры', name: '🎮 Игровые стримы', count: getCategoryCount('игры') },
    { id: 'just_chatting', name: '💬 Общение / Видосы', count: getCategoryCount('just_chatting') },
    { id: 'шоу', name: '🎭 ШОУ', count: getCategoryCount('шоу') },
    { id: 'кукинг', name: '🍳 Кукинги', count: getCategoryCount('кукинг') },
    { id: 'марафон', name: '🏅 Марафоны', count: getCategoryCount('марафон') },
  ]

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

  const getCategoryColor = (categoryId) => {
    switch (categoryId) {
      case 'фильм':
        return 'bg-purple-600 text-white hover:bg-purple-500'
      case 'just_chatting':
        return 'text-white hover:opacity-90 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500'
      case 'ирл':
        return 'bg-blue-600 text-white hover:bg-blue-500'
      case 'игры':
        return 'bg-red-600 text-white hover:bg-red-500'
      case 'контент':
        return 'bg-green-600 text-white hover:bg-green-500'
      case 'шоу':
        return 'text-white hover:opacity-90 bg-gradient-to-r from-purple-500 via-violet-600 to-fuchsia-500'
      case 'кукинг':
        return 'text-white hover:opacity-90 bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400'
      case 'марафон':
        return 'text-white hover:opacity-90 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400'
      case 'all':
      default:
        return 'bg-blue-600 text-white hover:bg-blue-500'
    }
  }

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

  const checkDateMatch = (dateString, query) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return false
      }
      
      const shortDate = date.toLocaleDateString('ru')
      return shortDate.includes(query)
    } catch (error) {
      console.warn('Invalid date format:', dateString)
      return false
    }
  }

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
  }

  // Фильтрация и сортировка стримов (из StreamList)
  const filteredAndSortedStreams = streams.filter(stream => {
    // Фильтрация по категории
    if (selectedCategory !== 'all') {
      const categoryMatch = stream.categories?.includes(selectedCategory) ||
        stream.tags?.some(tag => tag.toLowerCase().includes(selectedCategory.toLowerCase()))
      if (!categoryMatch) return false
    }

    // Фильтрация по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const titleMatch = stream.title?.toLowerCase().includes(query)
      const tagsMatch = stream.tags?.some(tag => tag.toLowerCase().includes(query))
      const dateMatch = checkDateMatch(stream.date, query)
      
      return titleMatch || tagsMatch || dateMatch
    }

    return true
  }).sort((a, b) => {
    let comparison = 0
    
    if (sortBy === 'date') {
      comparison = new Date(a.date) - new Date(b.date)
    } else if (sortBy === 'name') {
      comparison = a.title.localeCompare(b.title)
    }
    
    return sortOrder === 'desc' ? -comparison : comparison
  })

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full overflow-auto"
    >
      {/* Кнопка добавления + форма */}
      <div className="px-4 py-3 bg-tg-secondary-bg border-b border-gray-700">
        {!showAddForm ? (
          <div className="text-center">
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-roobert-medium transition-colors"
            >
              <Plus size={20} />
              Добавить новый стрим
            </button>
          </div>
        ) : (
          <div className="bg-green-900/20 border border-green-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-roobert-bold text-lg text-green-400">Добавить новый стрим</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Название стрима"
                value={addFormData.title}
                onChange={(e) => setAddFormData({ ...addFormData, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-green-500 focus:outline-none"
                required
              />
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={addFormData.date}
                  onChange={(e) => setAddFormData({ ...addFormData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular border-2 border-transparent focus:border-green-500 focus:outline-none"
                  required
                />
                
                <input
                  type="time"
                  value={addFormData.time}
                  onChange={(e) => setAddFormData({ ...addFormData, time: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular border-2 border-transparent focus:border-green-500 focus:outline-none"
                />
              </div>
              
              <input
                type="text"
                placeholder="Теги (через запятую: #игры, #стрим, #развлечения)"
                value={addFormData.tags}
                onChange={(e) => setAddFormData({ ...addFormData, tags: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-green-500 focus:outline-none"
              />
              
              <input
                type="url"
                placeholder="Ссылка на пост в Telegram"
                value={addFormData.telegramUrl}
                onChange={(e) => setAddFormData({ ...addFormData, telegramUrl: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-green-500 focus:outline-none"
                required
              />
              
              <input
                type="url"
                placeholder="URL превью (опционально)"
                value={addFormData.thumbnail}
                onChange={(e) => setAddFormData({ ...addFormData, thumbnail: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-green-500 focus:outline-none"
              />
              
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-roobert-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Добавить стрим
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-roobert-medium transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Категории */}
      <div className="py-3">
        <motion.div 
          className="flex gap-3 overflow-x-auto px-4 pb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {allCategories.map((category, index) => (
            <motion.button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-roobert-medium transition-colors ${
                selectedCategory === category.id 
                  ? getCategoryColor(category.id)
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {category.name}
              {category.count > 0 && (
                <span className="ml-2 text-sm opacity-50">({category.count})</span>
              )}
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Поиск и сортировка */}
      <div className="px-4 space-y-4 pt-4">
        {/* Поиск */}
        <div className="relative bg-tg-secondary-bg/50 border-2 border-gray-600/50 rounded-lg p-1">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tg-hint" />
          <input
            type="text"
            placeholder="Поиск по названию, тегам, дате..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-transparent text-sm text-tg-text placeholder-tg-hint focus:outline-none font-roobert-light"
          />
          {searchQuery.trim() && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-600 transition-colors"
            >
              <X size={14} className="text-tg-hint" />
            </button>
          )}
        </div>
        
        {/* Счетчик результатов */}
        {searchQuery.trim() && (
          <div className="text-sm text-tg-hint font-roobert-light">
            Найдено: {filteredAndSortedStreams.length} из {streams.length}
          </div>
        )}

        {/* Сортировка */}
        <div className="flex gap-2 text-base">
          <span className="text-tg-hint font-roobert-light">Сортировка:</span>
          {[
            { key: 'date', label: 'По дате' },
            { key: 'name', label: 'По названию' }
          ].map((sort) => (
            <button
              key={sort.key}
              onClick={() => handleSortChange(sort.key)}
              className={`px-4 py-1 rounded text-sm font-roobert-light transition-colors ${
                sortBy === sort.key
                  ? 'bg-tg-button text-tg-button-text'
                  : 'text-tg-hint hover:text-tg-text'
              }`}
            >
              {sort.label}
              {sortBy === sort.key && (
                <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
              )}
            </button>
          ))}
        </div>

        {/* Кнопка обновления превью */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-tg-hint font-roobert-light">
            Всего стримов: {streams.length}
          </div>
          <button
            onClick={onRefreshThumbnails}
            disabled={refreshingThumbnails}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-gray-200 rounded-lg font-roobert-regular text-sm transition-colors"
          >
            <RefreshCw size={14} className={refreshingThumbnails ? 'animate-spin' : ''} />
            {refreshingThumbnails ? 'Обновляем...' : 'Обновить превью'}
          </button>
        </div>

        {/* Список стримов */}
        <div className="grid gap-3">
          {filteredAndSortedStreams.map((stream) => (
            <div key={stream._id} className="stream-card">
              <StreamCard 
                stream={stream}
                isEditing={editingStream?._id === stream._id}
                onEdit={() => setEditingStream(stream)}
                onCancelEdit={() => setEditingStream(null)}
                onSave={onSave}
                onDelete={() => onDelete(stream._id)}
                onRefreshThumbnail={() => handleRefreshSingle(stream._id)}
                isRefreshing={refreshingSingle[stream._id]}
              />
            </div>
          ))}
        </div>

        {filteredAndSortedStreams.length === 0 && (
          <div className="text-center py-8 text-tg-hint">
            <Play size={48} className="mx-auto mb-2 opacity-50" />
            <p>{searchQuery ? 'По вашему запросу ничего не найдено' : 'Стримов не найдено'}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Компонент карточки стрима с inline редактированием (на основе StreamList)
const StreamCard = ({ stream, isEditing, onEdit, onCancelEdit, onSave, onDelete, onRefreshThumbnail, isRefreshing }) => {
  const [editData, setEditData] = useState({
    title: '',
    date: '',
    time: '12:00',
    tags: '',
    telegramUrl: '',
    thumbnail: ''
  })

  useEffect(() => {
    if (isEditing) {
      // Извлекаем URL из объекта thumbnail или используем строку напрямую
      const thumbnailUrl = typeof stream.thumbnail === 'object' && stream.thumbnail?.url 
        ? stream.thumbnail.url 
        : typeof stream.thumbnail === 'string' 
        ? stream.thumbnail 
        : ''
      
      // Парсим дату и время из ISO строки
      const streamDate = new Date(stream.date)
      const dateStr = streamDate.toISOString().split('T')[0]
      const timeStr = streamDate.toTimeString().slice(0, 5) // HH:MM
      
      setEditData({
        title: stream.title || '',
        date: dateStr,
        time: timeStr,
        tags: stream.tags ? stream.tags.join(', ') : '',
        telegramUrl: stream.telegramUrl || '',
        thumbnail: thumbnailUrl
      })
    }
  }, [isEditing, stream])

  const handleSave = () => {
    // Объединяем дату и время в один объект Date
    const dateTime = new Date(`${editData.date}T${editData.time}:00`)
    
    const streamData = {
      ...editData,
      date: dateTime.toISOString(), // Сохраняем как ISO строку с временем
      tags: editData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    }
    
    // Убираем отдельное поле времени из данных
    delete streamData.time
    
    onSave(streamData, stream._id)
    onCancelEdit()
  }

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

  const formatDateSafely = (dateString) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return 'Неизвестная дата'
      }
      return format(date, 'dd MMM yyyy', { locale: ru })
    } catch (error) {
      console.warn('Invalid date format:', dateString)
      return 'Неизвестная дата'
    }
  }

  if (isEditing) {
    return (
      <motion.div
        initial={{ scale: 0.98 }}
        animate={{ scale: 1 }}
        className="bg-yellow-900/20 border-2 border-yellow-600/50 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-roobert-bold text-lg text-yellow-400">Редактирование стрима</h3>
          <button
            onClick={onCancelEdit}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Название стрима"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-yellow-500 focus:outline-none"
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={editData.date}
              onChange={(e) => setEditData({ ...editData, date: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular border-2 border-transparent focus:border-yellow-500 focus:outline-none"
              required
            />
            
            <input
              type="time"
              value={editData.time}
              onChange={(e) => setEditData({ ...editData, time: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular border-2 border-transparent focus:border-yellow-500 focus:outline-none"
            />
          </div>
          
          <input
            type="text"
            placeholder="Теги (через запятую)"
            value={editData.tags}
            onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-yellow-500 focus:outline-none"
          />
          
          <input
            type="url"
            placeholder="Ссылка на пост в Telegram"
            value={editData.telegramUrl}
            onChange={(e) => setEditData({ ...editData, telegramUrl: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-yellow-500 focus:outline-none"
            required
          />
          
          <input
            type="url"
            placeholder="URL превью (опционально)"
            value={editData.thumbnail}
            onChange={(e) => setEditData({ ...editData, thumbnail: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light border-2 border-transparent focus:border-yellow-500 focus:outline-none"
          />
          
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-roobert-medium transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Сохранить изменения
            </button>
            <button
              onClick={onCancelEdit}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-roobert-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // Обычный режим просмотра (как в StreamList)
  return (
    <div className="flex gap-4 py-3 pr-3">
      {/* Превью */}
      <div className="relative w-36 h-20 bg-gray-700/50 rounded-lg overflow-hidden flex-shrink-0">
        {stream.thumbnail ? (
          <ThumbnailImage thumbnail={stream.thumbnail} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play size={24} className="text-gray-400" />
          </div>
        )}
      </div>

      {/* Информация о стриме */}
      <div className="flex-1 min-w-0 -mt-[3.5px]">
        <h3 className="font-roobert-medium text-base leading-tight mb-1 line-clamp-2">
          {stream.title}
        </h3>
        
        <div className="flex items-center gap-2 text-sm text-neutral-300 mb-1">
          <Calendar size={16} />
          <span className="font-roobert-regular">
            {formatDateSafely(stream.date)}
          </span>
        </div>

        {stream.tags && stream.tags.length > 0 && (
          <div className="flex items-center gap-1 text-sm mb-2">
            <Tag size={14} />
            <div className="flex gap-1 overflow-hidden">
              {stream.tags.slice(0, 3).map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className={`px-2 py-1 rounded text-sm font-roobert-regular ${getTagColor(tag)}`}
                >
                  {tag.replace('#', '')}
                </span>
              ))}
              {stream.tags.length > 3 && (
                <span className="text-tg-hint font-roobert-regular text-sm">+{stream.tags.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Кнопки действий */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onRefreshThumbnail}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Обновить превью"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="font-roobert-medium">Превью</span>
          </button>
          
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors"
          >
            <Edit size={12} />
            <span className="font-roobert-medium">Изменить</span>
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors"
          >
            <Trash2 size={12} />
            <span className="font-roobert-medium">Удалить</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Компонент для редактирования категорий  
const CategoriesTab = ({ categories, editingCategory, setEditingCategory, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    color: '#2481cc'
  })

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || '',
        tag: editingCategory.tag || '',
        color: editingCategory.color || '#2481cc'
      })
    } else {
      setFormData({
        name: '',
        tag: '',
        color: '#2481cc'
      })
    }
  }, [editingCategory])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full overflow-auto p-4 space-y-4"
    >
      {/* Форма добавления/редактирования категорий */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="font-roobert-medium mb-4">
          {editingCategory ? 'Редактировать категорию' : 'Добавить категорию'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Название категории"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light"
            required
          />
          
          <input
            type="text"
            placeholder="Связанный тег (например: #игры)"
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm font-roobert-regular placeholder:font-roobert-light"
            required
          />
          
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-10 h-8 rounded border border-gray-300"
            />
            <span className="text-sm text-gray-500 font-roobert-light">Цвет категории</span>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2 bg-tg-button text-tg-button-text rounded-lg text-sm font-roobert-medium"
            >
              <Save size={16} className="inline mr-1" />
              Сохранить
            </button>
            {editingCategory && (
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 bg-gray-600 rounded-lg text-sm font-roobert-medium"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Список категорий */}
      <div className="space-y-2">
        {categories.map((category) => (
          <div
            key={category._id}
            className="bg-gray-800 rounded-lg p-3 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-roobert-medium text-sm">{category.name}</h4>
                <p className="text-xs text-gray-500 font-roobert-regular">{category.tag}</p>
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => setEditingCategory(category)}
                  className="p-1.5 text-blue-600 hover:bg-blue-900/20 rounded"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => onDelete(category._id)}
                  className="p-1.5 text-red-600 hover:bg-red-900/20 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default Editor 