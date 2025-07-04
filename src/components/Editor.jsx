import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Edit, Trash2, Save, Eye, EyeOff, ArrowLeft, RefreshCw, Calendar, Play, ImageIcon, ImageOff } from 'lucide-react'
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

// Компонент для редактирования стримов
const StreamsTab = ({ streams, editingStream, setEditingStream, onSave, onDelete, onRefreshThumbnails, onRefreshSingleThumbnail, refreshingThumbnails, showToast, hapticFeedback, onDataUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [refreshingSingle, setRefreshingSingle] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
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

  // Фильтрация стримов по поисковому запросу
  const filteredStreams = streams.filter(stream => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    const titleMatch = stream.title?.toLowerCase().includes(query)
    const tagsMatch = stream.tags?.some(tag => tag.toLowerCase().includes(query))
    const dateMatch = new Date(stream.date).toLocaleDateString('ru').includes(query)
    
    return titleMatch || tagsMatch || dateMatch
  })

  // Группировка стримов по датам  
  const groupedStreams = filteredStreams.reduce((groups, stream) => {
    const dateStr = new Date(stream.date).toDateString()
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    
    groups[dateStr].push(stream)
    return groups
  }, {})

  // Сортировка стримов внутри каждой группы по времени
  Object.keys(groupedStreams).forEach(dateStr => {
    groupedStreams[dateStr].sort((a, b) => new Date(a.date) - new Date(b.date))
  })

  // Сортировка дат (самые новые сверху)
  const sortedDates = Object.keys(groupedStreams).sort((a, b) => new Date(b) - new Date(a))

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full overflow-auto p-4 space-y-6"
    >
      {/* Кнопка добавления + форма */}
      <div className="space-y-4">
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

      {/* Поиск */}
      <div className="space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск по названию, тегам или дате..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-700 rounded-xl text-tg-text placeholder-tg-hint focus:outline-none focus:border-tg-button font-roobert-regular"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {searchQuery && (
          <div className="text-sm text-gray-400 font-roobert-light">
            Найдено: {filteredStreams.length} из {streams.length}
          </div>
        )}
      </div>

      {/* Кнопки быстрых действий */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="text-sm text-gray-400 font-roobert-light flex items-center">
          <span>Всего стримов: {streams.length}</span>
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

      {/* Список стримов по датам */}
      <div className="space-y-6">
        {sortedDates.map((dateStr) => {
          const dateStreams = groupedStreams[dateStr]
          const displayDate = new Date(dateStr).toLocaleDateString('ru', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })
          
          return (
            <div key={dateStr} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-roobert-medium text-gray-300">
                  {displayDate}
                </h3>
                <div className="flex-1 h-px bg-gray-700"></div>
                <span className="text-sm text-gray-500 font-roobert-light">
                  {dateStreams.length} {dateStreams.length === 1 ? 'стрим' : 'стримов'}
                </span>
              </div>
              
              <div className="space-y-3">
                {dateStreams.map((stream) => (
                  <StreamCard 
                    key={stream._id}
                    stream={stream}
                    isEditing={editingStream?._id === stream._id}
                    onEdit={() => setEditingStream(stream)}
                    onCancelEdit={() => setEditingStream(null)}
                    onSave={onSave}
                    onDelete={() => onDelete(stream._id)}
                    onRefreshThumbnail={() => handleRefreshSingle(stream._id)}
                    isRefreshing={refreshingSingle[stream._id]}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {streams.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">📺</div>
          <p className="text-lg font-roobert-medium mb-2">Стримов пока нет</p>
          <p className="text-sm font-roobert-light">Добавьте первый стрим с помощью кнопки выше</p>
        </div>
      )}

      {streams.length > 0 && filteredStreams.length === 0 && searchQuery && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg font-roobert-medium mb-2">Ничего не найдено</p>
          <p className="text-sm font-roobert-light">Попробуйте изменить поисковый запрос</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-roobert-medium text-sm transition-colors"
          >
            Очистить поиск
          </button>
        </div>
      )}
    </motion.div>
  )
}

// Компонент карточки стрима с inline редактированием
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
      case 'ирл': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'фильм': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'just_chatting': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'игры': return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'контент': return 'bg-green-600/20 text-green-300 border-green-600/30'
      case 'шоу': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'кукинг': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'марафон': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-colors"
    >
      <div className="p-6">
        <div className="flex gap-4">
          {/* Превью */}
          <div className="w-24 h-16 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
            <ThumbnailImage thumbnail={stream.thumbnail} />
          </div>

          {/* Основная информация */}
          <div className="flex-1 min-w-0">
            <h4 className="font-roobert-bold text-base mb-2 line-clamp-2 leading-tight">
              {stream.title}
            </h4>
            
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span className="font-roobert-regular">
                  {new Date(stream.date).toLocaleDateString('ru', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                  {' в '}
                  {new Date(stream.date).toLocaleTimeString('ru', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                {(() => {
                  // Проверяем наличие превью в зависимости от типа
                  const hasThumbnail = typeof stream.thumbnail === 'object' && stream.thumbnail?.url
                    ? stream.thumbnail.url
                    : typeof stream.thumbnail === 'string' && stream.thumbnail.startsWith('http')
                    ? stream.thumbnail
                    : false

                  return hasThumbnail ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <ImageIcon size={14} />
                      <span className="text-xs">Превью</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500">
                      <ImageOff size={14} />
                      <span className="text-xs">Без превью</span>
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Теги */}
            {stream.tags && stream.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {stream.tags.map((tag, index) => (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded-md text-xs font-roobert-medium border ${getTagColor(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={onRefreshThumbnail}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-3 py-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Обновить превью"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="text-xs font-roobert-medium">Превью</span>
            </button>
            
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <Edit size={14} />
              <span className="text-xs font-roobert-medium">Изменить</span>
            </button>
          </div>

          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            <span className="text-xs font-roobert-medium">Удалить</span>
          </button>
        </div>
      </div>
    </motion.div>
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