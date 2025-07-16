// Система управления цветами тегов
// Поддерживает обычные цвета и градиенты

// Цвета флагов стран с четкими границами (приглушенные прозрачные тона)
const COUNTRY_FLAG_COLORS = {
  'париж': {
    type: 'gradient',
    colors: ['rgba(30, 58, 138, 0.7) 33%', 'rgba(243, 244, 246, 0.7) 33%', 'rgba(243, 244, 246, 0.7) 66%', 'rgba(185, 28, 28, 0.7) 66%'], // Французский флаг - прозрачные тона
    direction: 'to right',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'польша': {
    type: 'gradient', 
    colors: ['rgba(243, 244, 246, 0.7) 50%', 'rgba(185, 28, 28, 0.7) 50%'], // Польский флаг - прозрачный
    direction: 'to bottom',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'таиланд': {
    type: 'gradient',
    colors: ['rgba(185, 28, 28, 0.7) 16.66%', 'rgba(243, 244, 246, 0.7) 16.66%', 'rgba(243, 244, 246, 0.7) 33.33%', 'rgba(30, 58, 138, 0.7) 33.33%', 'rgba(30, 58, 138, 0.7) 66.66%', 'rgba(243, 244, 246, 0.7) 66.66%', 'rgba(243, 244, 246, 0.7) 83.33%', 'rgba(185, 28, 28, 0.7) 83.33%'], // Тайский флаг - прозрачные тона
    direction: 'to bottom',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'испания': {
    type: 'gradient',
    colors: ['rgba(185, 28, 28, 0.7) 25%', 'rgba(251, 191, 36, 0.7) 25%', 'rgba(251, 191, 36, 0.7) 75%', 'rgba(185, 28, 28, 0.7) 75%'], // Испанский флаг - прозрачные тона
    direction: 'to bottom',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'австрия': {
    type: 'gradient',
    colors: ['rgba(185, 28, 28, 0.7) 33%', 'rgba(243, 244, 246, 0.7) 33%', 'rgba(243, 244, 246, 0.7) 66%', 'rgba(185, 28, 28, 0.7) 66%'], // Австрийский флаг - прозрачный
    direction: 'to bottom',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'грузия': {
    type: 'gradient',
    colors: ['rgba(243, 244, 246, 0.7) 80%', 'rgba(185, 28, 28, 0.7) 80%'], // Грузинский флаг - прозрачный
    direction: 'to bottom',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'дубай': {
    type: 'gradient',
    colors: ['rgba(22, 101, 52, 0.7) 25%', 'rgba(243, 244, 246, 0.7) 25%', 'rgba(243, 244, 246, 0.7) 50%', 'rgba(31, 41, 55, 0.7) 50%', 'rgba(31, 41, 55, 0.7) 75%', 'rgba(185, 28, 28, 0.7) 75%'], // ОАЭ флаг - прозрачные тона
    direction: 'to bottom',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'португалия': {
    type: 'gradient',
    colors: ['rgba(22, 101, 52, 0.7) 40%', 'rgba(185, 28, 28, 0.7) 40%'], // Португальский флаг - прозрачные тона
    direction: 'to right',
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  }
}

// Стандартные цвета для существующих тегов
const DEFAULT_TAG_COLORS = {
  'ирл': {
    type: 'solid',
    colors: ['#3B82F6'], // blue-500
    bgOpacity: '40',
    textColor: '#93C5FD' // blue-200
  },
  'фильм': {
    type: 'solid',
    colors: ['#8B5CF6'], // purple-500
    bgOpacity: '40',
    textColor: '#C4B5FD' // purple-200
  },
  'just_chatting': {
    type: 'solid',
    colors: ['#3B82F6'], // blue-500
    bgOpacity: '40',
    textColor: '#93C5FD' // blue-200
  },
  'игры': {
    type: 'solid',
    colors: ['#EF4444'], // red-500
    bgOpacity: '40',
    textColor: '#FCA5A5' // red-200
  },
  'контент': {
    type: 'solid',
    colors: ['#059669'], // green-600
    bgOpacity: '40',
    textColor: '#86EFAC' // green-200
  },
  'шоу': {
    type: 'solid',
    colors: ['#8B5CF6'], // purple-500
    bgOpacity: '40',
    textColor: '#C4B5FD' // purple-200
  },
  'кукинг': {
    type: 'solid',
    colors: ['#10B981'], // emerald-500
    bgOpacity: '40',
    textColor: '#6EE7B7' // emerald-200
  },
  'марафон': {
    type: 'solid',
    colors: ['#F59E0B'], // amber-500
    bgOpacity: '40',
    textColor: '#FCD34D' // amber-200
  }
}

// Ключ для localStorage
const STORAGE_KEY = 'tagColors'

// Получить цвета тегов из localStorage или вернуть дефолтные
export const getTagColors = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Объединяем с дефолтными цветами, приоритет у сохраненных
      return { ...DEFAULT_TAG_COLORS, ...COUNTRY_FLAG_COLORS, ...parsed }
    }
  } catch (error) {
    console.warn('Error loading tag colors from localStorage:', error)
  }
  
  // Возвращаем объединенные дефолтные цвета
  return { ...DEFAULT_TAG_COLORS, ...COUNTRY_FLAG_COLORS }
}

// Сохранить цвета тегов в localStorage
export const saveTagColors = (tagColors) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tagColors))
  } catch (error) {
    console.error('Error saving tag colors to localStorage:', error)
  }
}

// Получить цвет конкретного тега
export const getTagColor = (tag) => {
  const tagColors = getTagColors()
  const normalizedTag = tag.toLowerCase().replace('#', '')
  const colorConfig = tagColors[normalizedTag]
  
  if (!colorConfig) {
    // Дефолтный цвет для неизвестных тегов
    return 'bg-gray-500/40 text-gray-200'
  }
  
  if (colorConfig.type === 'gradient') {
    // Создаем CSS-класс для градиента с четкими границами
    const gradient = `linear-gradient(${colorConfig.direction || 'to right'}, ${colorConfig.colors.join(', ')})`
    const style = {
      background: gradient,
      color: colorConfig.textColor || '#FFFFFF',
      backgroundClip: 'padding-box'
    }
    
    // Добавляем textShadow если есть
    if (colorConfig.textShadow) {
      style.textShadow = colorConfig.textShadow
    }
    
    return style
  } else {
    // Обычный цвет
    const bgColor = colorConfig.colors[0]
    const opacity = colorConfig.bgOpacity || '40'
    const textColor = colorConfig.textColor || '#E5E7EB'
    
    // Конвертируем hex в rgb для прозрачности
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }
    
    const rgb = hexToRgb(bgColor)
    if (rgb) {
      return {
        backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.${opacity})`,
        color: textColor
      }
    }
    
    return 'bg-gray-500/40 text-gray-200'
  }
}

// Установить цвет для тега
export const setTagColor = (tag, colorConfig) => {
  const tagColors = getTagColors()
  const normalizedTag = tag.toLowerCase().replace('#', '')
  
  tagColors[normalizedTag] = colorConfig
  saveTagColors(tagColors)
}

// Удалить настройку цвета для тега (вернется к дефолтному)
export const removeTagColor = (tag) => {
  const tagColors = getTagColors()
  const normalizedTag = tag.toLowerCase().replace('#', '')
  
  delete tagColors[normalizedTag]
  saveTagColors(tagColors)
}

// Получить все уникальные теги из стримов
export const extractAllTags = (streams) => {
  const allTags = new Set()
  
  streams.forEach(stream => {
    if (stream.tags && Array.isArray(stream.tags)) {
      stream.tags.forEach(tag => {
        const normalized = tag.toLowerCase().replace('#', '')
        allTags.add(normalized)
      })
    }
  })
  
  return Array.from(allTags).sort()
}

// Сбросить все цвета к дефолтным
export const resetTagColors = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error resetting tag colors:', error)
  }
}

// Экспортировать настройки цветов
export const exportTagColors = () => {
  const tagColors = getTagColors()
  const dataStr = JSON.stringify(tagColors, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  
  const link = document.createElement('a')
  link.href = URL.createObjectURL(dataBlob)
  link.download = 'tag-colors.json'
  link.click()
}

// Импортировать настройки цветов
export const importTagColors = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const tagColors = JSON.parse(e.target.result)
        saveTagColors(tagColors)
        resolve(tagColors)
      } catch (error) {
        reject(new Error('Неверный формат файла'))
      }
    }
    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsText(file)
  })
} 