import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Play, Calendar, Tag, Search, X } from 'lucide-react'
import { useTelegram } from '../hooks/useTelegram'

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

// Функция для получения цвета активной категории
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

const StreamList = ({ streams, categories, loading, onStreamClick, renderOnlyCategories = false, renderOnlyContent = false, selectedCategory: externalSelectedCategory, onCategoryChange, onSearchFocus, apiConnected = false, expandedThumbnail: externalExpandedThumbnail, setExpandedThumbnail: externalSetExpandedThumbnail }) => {
  const [internalSelectedCategory, setInternalSelectedCategory] = useState('all')
  
  // Используем внешнее состояние, если передано, иначе внутреннее
  const selectedCategory = externalSelectedCategory !== undefined ? externalSelectedCategory : internalSelectedCategory
  const setSelectedCategory = onCategoryChange || setInternalSelectedCategory
  const [sortBy, setSortBy] = useState('date') // date, name
  const [sortOrder, setSortOrder] = useState('desc') // asc, desc - по умолчанию новые сверху
  const [searchQuery, setSearchQuery] = useState('')
  const { hapticFeedback } = useTelegram()

  // Используем внешнее состояние для увеличенного превью, если передано
  const [internalExpandedThumbnail, setInternalExpandedThumbnail] = useState(null)
  const expandedThumbnail = externalExpandedThumbnail !== undefined ? externalExpandedThumbnail : internalExpandedThumbnail
  const setExpandedThumbnail = externalSetExpandedThumbnail || setInternalExpandedThumbnail

  // Состояние для отслеживания зажатия
  const [holdState, setHoldState] = useState({
    isHolding: false,
    streamId: null,
    preventClick: false
  })

  // Создаем ref для контейнера контента
  const contentRef = useRef(null)
  // Рефы для категорий
  const categoriesRef = useRef(null)
  const categoriesRef2 = useRef(null)
  // Ref для поля поиска
  const searchInputRef = useRef(null)
  // Ref для таймера зажатия
  const holdTimerRef = useRef(null)

  // Автоматический скролл наверх при смене категории (только если не первый рендер)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }, [selectedCategory])

  // Обработчик клавиши Escape для закрытия модального окна и предотвращение скролла
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && expandedThumbnail) {
        setExpandedThumbnail(null)
      }
    }

    if (expandedThumbnail) {
      // Предотвращаем скролл страницы
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [expandedThumbnail, setExpandedThumbnail])

  // Простой автоматический скролл к выбранной категории
  useEffect(() => {
    const scrollToCategory = () => {
      // Используем только первый найденный контейнер
      const container = categoriesRef.current || categoriesRef2.current
      if (!container) return
      
      const scrollContainer = container.querySelector('.categories-scroll-container')
      if (!scrollContainer) return
      
      const buttons = scrollContainer.querySelectorAll('.category-button')
      if (buttons.length === 0) return
      
      // Находим кнопку выбранной категории
      const categories = ['all', 'фильм', 'ирл', 'контент', 'игры', 'just_chatting', 'шоу', 'кукинг', 'марафон']
      const targetIndex = categories.findIndex(cat => cat === selectedCategory)
      const targetButton = buttons[targetIndex]
      
      if (targetButton) {
        // Используем scrollIntoView для более надежного и плавного скролла
        targetButton.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        })
      }
    }
    
    // Небольшая задержка для рендеринга
    const timer = setTimeout(scrollToCategory, 400)
    return () => clearTimeout(timer)
  }, [selectedCategory])

  // Обработка фокуса поиска извне
  useEffect(() => {
    if (onSearchFocus && searchInputRef.current) {
      const input = searchInputRef.current
      
      // Прокручиваем к полю и фокусируемся
      setTimeout(() => {
        input.scrollIntoView({ block: 'center', behavior: 'instant' })
        input.focus()
        
        // Добавляем визуальную подсказку для мобильных (iOS не позволяет программно активировать клавиатуру)
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        if (isMobile) {
          // Добавляем пульсацию к полю для привлечения внимания
          input.classList.add('pulse')
          
          setTimeout(() => {
            input.classList.remove('pulse')
          }, 3000)
        }
        
        // Устанавливаем курсор в конец если есть текст
        if (input.setSelectionRange && input.value.length > 0) {
          const len = input.value.length
          input.setSelectionRange(len, len)
        }
      }, 100)
    }
  }, [onSearchFocus])

  // Автоматическое переключение на "Все" если нет результатов в текущей категории
  useEffect(() => {
    if (searchQuery.trim() && selectedCategory !== 'all') {
      // Проверяем результаты в текущей категории
      const currentCategoryResults = streams.filter(stream => {
        const categoryMatch = stream.categories?.includes(selectedCategory) ||
                             stream.tags?.some(tag => tag.toLowerCase().includes(selectedCategory.toLowerCase()))
        
        if (!categoryMatch) return false
        
        const query = searchQuery.toLowerCase().trim()
        const titleMatch = stream.title.toLowerCase().includes(query)
        const tagsMatch = stream.tags?.some(tag => tag.toLowerCase().includes(query))
        const dateMatch = checkDateMatch(stream.date, query)
        
        return titleMatch || tagsMatch || dateMatch
      })
      
      // Проверяем результаты во всех категориях
      const allCategoryResults = streams.filter(stream => {
        const query = searchQuery.toLowerCase().trim()
        const titleMatch = stream.title.toLowerCase().includes(query)
        const tagsMatch = stream.tags?.some(tag => tag.toLowerCase().includes(query))
        const dateMatch = checkDateMatch(stream.date, query)
        
        return titleMatch || tagsMatch || dateMatch
      })
      
      // Если в текущей категории нет результатов, но во всех есть - переключаемся
      if (currentCategoryResults.length === 0 && allCategoryResults.length > 0) {
        setSelectedCategory('all')
      }
    }
  }, [searchQuery, selectedCategory, streams, setSelectedCategory])

  // Добавляем обработчики скролла для категорий
  useEffect(() => {
    const handleCategoriesWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      const container = e.currentTarget.querySelector('.categories-scroll-container')
      if (container) {
        const scrollAmount = e.deltaY
        const maxScrollLeft = container.scrollWidth - container.clientWidth
        const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + scrollAmount))
        container.scrollLeft = newScrollLeft
      }
    }

    if (categoriesRef.current) {
      categoriesRef.current.addEventListener('wheel', handleCategoriesWheel, { passive: false, capture: true })
    }
    if (categoriesRef2.current) {
      categoriesRef2.current.addEventListener('wheel', handleCategoriesWheel, { passive: false, capture: true })
    }

    return () => {
      if (categoriesRef.current) {
        categoriesRef.current.removeEventListener('wheel', handleCategoriesWheel, { capture: true })
      }
      if (categoriesRef2.current) {
        categoriesRef2.current.removeEventListener('wheel', handleCategoriesWheel, { capture: true })
      }
    }
  }, [])

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
      }
    }
  }, [])

  const filteredAndSortedStreams = useMemo(() => {
    let filtered = streams

    // Фильтрация по категории
    if (selectedCategory !== 'all') {
      filtered = streams.filter(stream => 
        stream.categories?.includes(selectedCategory) ||
        stream.tags?.some(tag => tag.toLowerCase().includes(selectedCategory.toLowerCase()))
      )
    }

    // Фильтрация по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(stream => {
        const titleMatch = stream.title.toLowerCase().includes(query)
        const tagsMatch = stream.tags?.some(tag => 
          tag.toLowerCase().includes(query)
        )
        
        // Расширенный поиск по дате
        const dateMatch = checkDateMatch(stream.date, query)
        
        // Поиск по месяцам (сокращения и полные названия)
        const monthMap = {
          'янв': 'январь', 'февр': 'февраль', 'мар': 'март', 'апр': 'апрель',
          'май': 'май', 'июн': 'июнь', 'июл': 'июль', 'авг': 'август',
          'сент': 'сентябрь', 'окт': 'октябрь', 'нояб': 'ноябрь', 'дек': 'декабрь'
        }
        
        let monthMatch = false
        
        // Безопасная проверка месяцев
        try {
          const streamDate = new Date(stream.date)
          if (!isNaN(streamDate.getTime())) {
            const fullMonth = format(streamDate, 'LLLL', { locale: ru }).toLowerCase()
            const shortMonth = format(streamDate, 'LLL', { locale: ru }).toLowerCase()
            
            // Проверяем прямое совпадение с полным или коротким названием месяца
            if (fullMonth.includes(query) || shortMonth.includes(query)) {
              monthMatch = true
            }
            
            // Проверяем сокращения
            for (const [abbr, full] of Object.entries(monthMap)) {
              if (query === abbr || query === full) {
                if (fullMonth === full) {
                  monthMatch = true
                  break
                }
              }
            }
          }
        } catch (error) {
          console.warn('Invalid date format for month check:', stream.date)
        }
        
        return titleMatch || tagsMatch || dateMatch || monthMatch
      })
    }

    // Сортировка
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      
      if (sortBy === 'date') {
        // Сортируем по дате и времени (время уже включено в поле date)
        comparison = new Date(a.date) - new Date(b.date)
      } else if (sortBy === 'name') {
        comparison = a.title.localeCompare(b.title)
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return sorted
  }, [streams, selectedCategory, sortBy, sortOrder, searchQuery])

  // Функция для подсчета стримов в категории (используем ту же логику, что и в фильтрации)
  const getCategoryCount = useCallback((categoryId) => {
    if (categoryId === 'all') return streams.length
    
    return streams.filter(stream => 
      stream.categories?.includes(categoryId) ||
      stream.tags?.some(tag => tag.toLowerCase().includes(categoryId.toLowerCase()))
    ).length
  }, [streams])

  // Изменен порядок категорий согласно требованию
  const allCategories = useMemo(() => [
    { id: 'all', name: '📺 Все', count: getCategoryCount('all') },
    { id: 'фильм', name: '🍿 Фильмы / Мультики', count: getCategoryCount('фильм') },
    { id: 'ирл', name: '🗺️ ИРЛ стримы', count: getCategoryCount('ирл') },
    { id: 'контент', name: '👀 Контент', count: getCategoryCount('контент') },
    { id: 'игры', name: '🎮 Игровые стримы', count: getCategoryCount('игры') },
    { id: 'just_chatting', name: '💬 Общение / Видосы', count: getCategoryCount('just_chatting') },
    { id: 'шоу', name: '🎭 ШОУ', count: getCategoryCount('шоу') },
    { id: 'кукинг', name: '🍳 Кукинги', count: getCategoryCount('кукинг') },
    { id: 'марафон', name: '🏅 Марафоны', count: getCategoryCount('марафон') },
  ], [streams, getCategoryCount])

  const handleCategoryChange = (categoryId) => {
    hapticFeedback('selection')

    // Если кликнули на уже выбранную категорию, скроллим наверх
    if (selectedCategory === categoryId) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    } else {
      setSelectedCategory(categoryId)
      // Сброс поиска при смене категории
      setSearchQuery('')
      // Скролл наверх обрабатывается в useEffect
    }
  }

  // Состояние для отслеживания touch событий
  const [touchState, setTouchState] = useState({
    startX: 0,
    startY: 0,
    categoryId: null,
    moved: false
  })

  // Улучшенный обработчик клика для категорий
  const handleCategoryClick = (e, categoryId) => {
    e.preventDefault()
    e.stopPropagation()
    handleCategoryChange(categoryId)
  }

  // Обработчик начала касания
  const handleTouchStart = (e, categoryId) => {
    const touch = e.touches[0]
    setTouchState({
      startX: touch.clientX,
      startY: touch.clientY,
      categoryId: categoryId,
      moved: false
    })
  }

  // Обработчик движения касания
  const handleTouchMove = (e) => {
    if (!touchState.categoryId) return
    
    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchState.startX)
    const deltaY = Math.abs(touch.clientY - touchState.startY)
    
    // Если палец сдвинулся более чем на 10px, считаем это скроллом
    if (deltaX > 10 || deltaY > 10) {
      setTouchState(prev => ({ ...prev, moved: true }))
    }
  }

  // Обработчик окончания касания
  const handleTouchEnd = (e, categoryId) => {
    e.preventDefault()
    
    // Если это был тап (без движения), то выбираем категорию
    if (!touchState.moved && touchState.categoryId === categoryId) {
      handleCategoryChange(categoryId)
    }
    
    // Сбрасываем состояние
    setTouchState({
      startX: 0,
      startY: 0,
      categoryId: null,
      moved: false
    })
  }

  // Обработчик для mousedown (дополнительная защита)
  const handleCategoryMouseDown = (e, categoryId) => {
    e.preventDefault()
    // Устанавливаем небольшую задержку для избежания конфликтов
    setTimeout(() => {
      handleCategoryChange(categoryId)
    }, 50)
  }

  const handleSortChange = (newSortBy) => {
    hapticFeedback('selection')
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
  }

  // Функция для запуска таймера зажатия
  const startHoldTimer = (stream, isMouse = false) => {
    console.log('🕐 Starting hold timer for:', stream.title, 'isMouse:', isMouse)
    
    // Очищаем предыдущий таймер если есть
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
    }
    
    // Устанавливаем состояние зажатия
    setHoldState({
      isHolding: true,
      streamId: stream._id,
      preventClick: false
    })
    
    // Запускаем таймер (больше времени для touch чтобы не мешать скроллу)
    const holdDelay = isMouse ? 400 : 600 // 400ms для мыши, 600ms для тача
    holdTimerRef.current = setTimeout(() => {
      console.log('⏰ Hold timer fired, showing expanded thumbnail for:', stream.title)
      setExpandedThumbnail(stream)
      hapticFeedback('impact', 'medium')
      
      // Помечаем что нужно предотвратить клик
      setHoldState(prev => ({
        ...prev,
        preventClick: true
      }))
    }, holdDelay)
  }

  // Функция для остановки таймера зажатия
  const stopHoldTimer = (immediate = false) => {
    console.log('🛑 Stopping hold timer')
    
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    
    // Сбрасываем состояние зажатия
    const resetDelay = immediate ? 0 : 50
    setTimeout(() => {
      setHoldState({
        isHolding: false,
        streamId: null,
        preventClick: false
      })
    }, resetDelay)
  }

  // Обработчики для мыши
  const handleStreamMouseDown = (e, stream) => {
    console.log('🖱️ MouseDown triggered for stream:', stream.title)
    // НЕ preventDefault для mouse - это может мешать другим событиям
    startHoldTimer(stream, true)
  }

  const handleStreamMouseUp = (e, stream) => {
    console.log('🖱️ MouseUp triggered for stream:', stream.title)
    stopHoldTimer()
    
    // Закрываем превью если оно было показано
    if (expandedThumbnail && expandedThumbnail._id === stream._id) {
      setExpandedThumbnail(null)
    }
  }

  const handleStreamMouseLeave = (e, stream) => {
    console.log('🖱️ MouseLeave triggered for stream:', stream.title)
    stopHoldTimer()
    
    // Закрываем превью если оно было показано
    if (expandedThumbnail && expandedThumbnail._id === stream._id) {
      setExpandedThumbnail(null)
    }
  }

  // Обработчики для тача - более аккуратные
  const handleStreamTouchStart = (e, stream) => {
    console.log('📱 TouchStart triggered for stream:', stream.title)
    
    // НЕ preventDefault - позволяем браузеру обрабатывать скролл
    const touch = e.touches[0]
    
    // Сохраняем данные о касании
    const touchData = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      moved: false,
      cancelled: false
    }
    
    // Сохраняем в элементе
    e.currentTarget._touchData = touchData
    
    // Запускаем таймер зажатия
    startHoldTimer(stream, false)
  }

  const handleStreamTouchMove = (e, stream) => {
    const touchData = e.currentTarget._touchData
    if (!touchData || touchData.cancelled) return
    
    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchData.startX)
    const deltaY = Math.abs(touch.clientY - touchData.startY)
    
    // Более строгие условия для отмены зажатия
    // Особенно чувствительны к вертикальному движению (скролл)
    if (deltaY > 8 || deltaX > 15) {
      console.log('📱 Touch moved significantly, cancelling hold for:', stream.title, { deltaY, deltaX })
      touchData.moved = true
      touchData.cancelled = true
      stopHoldTimer(true)
    }
  }

  const handleStreamTouchEnd = (e, stream) => {
    console.log('📱 TouchEnd triggered for stream:', stream.title)
    
    const touchData = e.currentTarget._touchData
    
    // НЕ preventDefault - позволяем браузеру завершить touch события
    stopHoldTimer()
    
    // Закрываем превью если оно было показано
    if (expandedThumbnail && expandedThumbnail._id === stream._id) {
      setExpandedThumbnail(null)
    }
    
    // Очищаем данные о касании
    e.currentTarget._touchData = null
  }

  // Обработчик клика по стриму
  const handleStreamClick = (e, stream) => {
    console.log('🖱️ Click triggered for stream:', stream.title, 'preventClick:', holdState.preventClick)
    
    // Если превью показано, просто закрываем его
    if (expandedThumbnail && expandedThumbnail._id === stream._id) {
      console.log('❌ Click cancelled - expanded thumbnail was shown')
      setExpandedThumbnail(null)
      return
    }
    
    // Если нужно предотвратить клик после зажатия
    if (holdState.preventClick && holdState.streamId === stream._id) {
      console.log('❌ Click cancelled - was holding')
      // Сбрасываем флаг предотвращения клика
      setHoldState(prev => ({ ...prev, preventClick: false }))
      return
    }
    
    // Проверяем данные touch события - если было движение, не кликаем
    if (e.currentTarget._touchData && e.currentTarget._touchData.moved) {
      console.log('❌ Click cancelled - touch was moved')
      return
    }
    
    console.log('✅ Opening stream:', stream.title)
    hapticFeedback('impact', 'light')
    onStreamClick(stream)
  }

  // Компонент карточки стрима
  const StreamCard = ({ stream, index }) => (
    <div
      key={stream._id}
      onClick={(e) => handleStreamClick(e, stream)}
      onMouseDown={(e) => handleStreamMouseDown(e, stream)}
      onMouseUp={(e) => handleStreamMouseUp(e, stream)}
      onMouseLeave={(e) => handleStreamMouseLeave(e, stream)}
      onTouchStart={(e) => handleStreamTouchStart(e, stream)}
      onTouchMove={(e) => handleStreamTouchMove(e, stream)}
      onTouchEnd={(e) => handleStreamTouchEnd(e, stream)}
      className="stream-card cursor-pointer"
      style={{ 
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        touchAction: 'manipulation' // Добавляем для лучшей работы touch событий
      }}
    >
      <div className="flex gap-4 py-3 pr-3">
        {/* Превью */}
        <div className="relative w-40 h-24 bg-gray-700/50 rounded-lg overflow-hidden flex-shrink-0">
          {stream.thumbnail ? (
            <ThumbnailImage thumbnail={stream.thumbnail} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play size={24} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0 -mt-[3.5px]">
          <h3 className="font-roobert-medium text-base leading-tight mb-1 line-clamp-2">
            {stream.title}
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-neutral-300 mb-1">
            <Calendar size={16} />
            <span className="font-roobert-regular">
              {formatDateSafely(stream.date, 'dd MMM yyyy', { locale: ru }) || 'Неизвестная дата'}
            </span>
          </div>

          {stream.tags && stream.tags.length > 0 && (
            <div className="flex items-center gap-1 text-sm">
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
        </div>
      </div>
    </div>
  )

  if (loading && !renderOnlyCategories) {
    return <LoadingSkeleton />
  }

  // Рендерим только категории
  if (renderOnlyCategories) {
    return (
      <div 
        ref={categoriesRef}
        style={{ height: 'fit-content' }}
      >
        <motion.div 
          className="categories-scroll-container flex gap-3 overflow-x-auto px-4 pb-6"
          style={{ scrollbarHeight: '6px' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
        {allCategories.map((category, index) => (
          <motion.button
            key={category.id}
            onClick={(e) => handleCategoryClick(e, category.id)}
            onMouseDown={(e) => handleCategoryMouseDown(e, category.id)}
            onTouchStart={(e) => handleTouchStart(e, category.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEnd(e, category.id)}
            className={`category-button ${
              selectedCategory === category.id 
                ? getCategoryColor(category.id)
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
            }`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none'
            }}
          >
            {category.name}
            {category.count > 0 && (
              <span className="ml-2 text-sm opacity-50">({category.count})</span>
            )}
          </motion.button>
        ))}
        </motion.div>
      </div>
    )
  }

  // Рендерим только контент (поиск, сортировка, стримы)
  if (renderOnlyContent) {
    return (
      <>
        <div ref={contentRef} className="px-4 space-y-4 pt-4">
          {/* Поиск */}
          <div className="space-y-3">
            <div className="relative bg-tg-secondary-bg/50 border-2 border-gray-600/50 rounded-lg p-1">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tg-hint" />
              <input
                ref={searchInputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Поиск по названию, тегам, дате..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  // Скролл наверх при вводе
                  if (e.target.value.length > 0) {
                    window.scrollTo({
                      top: 0,
                      behavior: 'smooth'
                    })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur()
                  }
                }}
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
          </div>

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

          {/* Список стримов */}
          <div className="grid gap-3">
            {filteredAndSortedStreams.map((stream, index) => (
              <StreamCard key={stream._id} stream={stream} index={index} />
            ))}
          </div>

          {filteredAndSortedStreams.length === 0 && (
            <div className="text-center py-8 text-tg-hint">
              <Play size={48} className="mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? 'По вашему запросу ничего не найдено' : 'Стримов не найдено'}</p>
            </div>
          )}
        </div>

        {/* Модальное окно с увеличенным превью */}
        <AnimatePresence>
          {expandedThumbnail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setExpandedThumbnail(null)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative max-w-[90vw] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Увеличенное превью */}
                <div className="relative">
                  {expandedThumbnail.thumbnail ? (
                    <div className="w-full min-h-[300px] max-w-[600px] max-h-[400px]">
                      <ThumbnailImage thumbnail={expandedThumbnail.thumbnail} />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 min-h-[300px] min-w-[400px]">
                      <Play size={48} className="text-gray-400" />
                    </div>
                  )}
                  
                  {/* Информация о стриме */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
                    <h3 className="text-white font-roobert-medium text-lg mb-2 line-clamp-2">
                      {expandedThumbnail.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                      <Calendar size={16} />
                      <span className="font-roobert-regular">
                        {formatDateSafely(expandedThumbnail.date, 'dd MMM yyyy', { locale: ru }) || 'Неизвестная дата'}
                      </span>
                    </div>
                    {expandedThumbnail.tags && expandedThumbnail.tags.length > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Tag size={14} className="text-gray-300" />
                        <div className="flex gap-1 flex-wrap">
                          {expandedThumbnail.tags.slice(0, 5).map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className={`px-2 py-1 rounded text-sm font-roobert-regular ${getTagColor(tag)}`}
                            >
                              {tag.replace('#', '')}
                            </span>
                          ))}
                          {expandedThumbnail.tags.length > 5 && (
                            <span className="text-gray-300 font-roobert-regular text-sm">+{expandedThumbnail.tags.length - 5}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Кнопка закрытия */}
                <button
                  onClick={() => setExpandedThumbnail(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }
  
  // Полный рендер (обратная совместимость)
  return (
    <div>
      {/* Категории */}
      <div 
        ref={categoriesRef2}
        className="py-3"
      >
        <motion.div 
          className="categories-scroll-container flex gap-3 overflow-x-auto px-4 pb-6"
          style={{ scrollbarHeight: '6px' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {allCategories.map((category, index) => (
            <motion.button
              key={category.id}
              onClick={(e) => handleCategoryClick(e, category.id)}
              onMouseDown={(e) => handleCategoryMouseDown(e, category.id)}
              onTouchStart={(e) => handleTouchStart(e, category.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, category.id)}
              className={`category-button ${
                selectedCategory === category.id 
                  ? getCategoryColor(category.id)
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none'
              }}
            >
              {category.name}
              {category.count > 0 && (
                <span className="ml-2 text-sm opacity-50">({category.count})</span>
              )}
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Остальной контент с отступами */}
      <div ref={contentRef} className="px-4 space-y-4 pt-4">
        {/* Поиск */}
        <div className="space-y-3">
          <div className="relative bg-tg-secondary-bg/50 border-2 border-gray-600/50 rounded-lg p-1">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tg-hint" />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Поиск по названию, тегам, дате..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // Скролл наверх при вводе
                if (e.target.value.length > 0) {
                  window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                  })
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur()
                }
              }}
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
          
          {/* Индикатор статуса API */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-tg-hint">
              <div className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span>
                {apiConnected ? 'API подключен' : 'Демо-режим'}
              </span>
            </div>
            {!apiConnected && (
              <span className="text-xs text-tg-hint">
                Показаны демо-данные
              </span>
            )}
          </div>
        </div>

        {/* Сортировка */}
        <div className="flex gap-2 text-sm">
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

        {/* Список стримов */}
        <div className="grid gap-3">
          {filteredAndSortedStreams.map((stream, index) => (
            <StreamCard key={stream._id} stream={stream} index={index} />
          ))}
        </div>

        {filteredAndSortedStreams.length === 0 && (
          <div className="text-center py-8 text-tg-hint">
            <Play size={48} className="mx-auto mb-2 opacity-50" />
            <p>{searchQuery ? 'По вашему запросу ничего не найдено' : 'Стримов не найдено'}</p>
          </div>
        )}
      </div>

      {/* Модальное окно с увеличенным превью - показываем всегда в полном рендере */}
      <AnimatePresence>
        {expandedThumbnail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setExpandedThumbnail(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative max-w-[90vw] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Увеличенное превью */}
              <div className="relative">
                {expandedThumbnail.thumbnail ? (
                  <div className="w-full min-h-[300px] max-w-[600px] max-h-[400px]">
                    <ThumbnailImage thumbnail={expandedThumbnail.thumbnail} />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 min-h-[300px] min-w-[400px]">
                    <Play size={48} className="text-gray-400" />
                  </div>
                )}
                
                {/* Информация о стриме */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
                  <h3 className="text-white font-roobert-medium text-lg mb-2 line-clamp-2">
                    {expandedThumbnail.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <Calendar size={16} />
                    <span className="font-roobert-regular">
                      {formatDateSafely(expandedThumbnail.date, 'dd MMM yyyy', { locale: ru }) || 'Неизвестная дата'}
                    </span>
                  </div>
                  {expandedThumbnail.tags && expandedThumbnail.tags.length > 0 && (
                    <div className="flex items-center gap-1 text-sm">
                      <Tag size={14} className="text-gray-300" />
                      <div className="flex gap-1 flex-wrap">
                        {expandedThumbnail.tags.slice(0, 5).map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className={`px-2 py-1 rounded text-sm font-roobert-regular ${getTagColor(tag)}`}
                          >
                            {tag.replace('#', '')}
                          </span>
                        ))}
                        {expandedThumbnail.tags.length > 5 && (
                          <span className="text-gray-300 font-roobert-regular text-sm">+{expandedThumbnail.tags.length - 5}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Кнопка закрытия */}
              <button
                onClick={() => setExpandedThumbnail(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-2 overflow-x-auto">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="loading-skeleton h-8 w-20 rounded-full flex-shrink-0" />
      ))}
    </div>
    
    {/* Поиск skeleton */}
    <div className="loading-skeleton h-10 w-full rounded-lg" />
    
    <div className="grid gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="stream-card">
          <div className="flex gap-4 py-3 pr-3">
            <div className="loading-skeleton w-40 h-24 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="loading-skeleton h-4 w-3/4 rounded" />
              <div className="loading-skeleton h-3 w-1/2 rounded" />
              <div className="flex gap-1">
                <div className="loading-skeleton h-5 w-12 rounded" />
                <div className="loading-skeleton h-5 w-16 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default StreamList