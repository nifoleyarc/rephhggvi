// Система управления цветами тегов
// Поддерживает обычные цвета и градиенты

// Цвета флагов стран с четкими границами (приглушенные тона)
const COUNTRY_FLAG_COLORS = {
  'париж': {
    type: 'gradient',
    colors: ['#1e3a8a 33%', '#f3f4f6 33%', '#f3f4f6 66%', '#b91c1c 66%'], // Французский флаг - приглушенные тона
    direction: 'to right',
    textColor: '#000000'
  },
  'польша': {
    type: 'gradient', 
    colors: ['#f3f4f6 50%', '#b91c1c 50%'], // Польский флаг - приглушенный красный
    direction: 'to bottom',
    textColor: '#000000'
  },
  'таиланд': {
    type: 'gradient',
    colors: ['#b91c1c 16.66%', '#f3f4f6 16.66%', '#f3f4f6 33.33%', '#1e3a8a 33.33%', '#1e3a8a 66.66%', '#f3f4f6 66.66%', '#f3f4f6 83.33%', '#b91c1c 83.33%'], // Тайский флаг - приглушенные тона
    direction: 'to bottom',
    textColor: '#000000'
  },
  'испания': {
    type: 'gradient',
    colors: ['#b91c1c 25%', '#fbbf24 25%', '#fbbf24 75%', '#b91c1c 75%'], // Испанский флаг - приглушенные красный и желтый
    direction: 'to bottom',
    textColor: '#000000'
  },
  'австрия': {
    type: 'gradient',
    colors: ['#b91c1c 33%', '#f3f4f6 33%', '#f3f4f6 66%', '#b91c1c 66%'], // Австрийский флаг - приглушенный красный
    direction: 'to bottom',
    textColor: '#000000'
  },
  'грузия': {
    type: 'gradient',
    colors: ['#f3f4f6 80%', '#b91c1c 80%'], // Грузинский флаг - приглушенный красный
    direction: 'to bottom',
    textColor: '#000000'
  },
  'дубай': {
    type: 'gradient',
    colors: ['#166534 25%', '#f3f4f6 25%', '#f3f4f6 50%', '#1f2937 50%', '#1f2937 75%', '#b91c1c 75%'], // ОАЭ флаг - приглушенные тона
    direction: 'to bottom',
    textColor: '#000000'
  },
  'португалия': {
    type: 'gradient',
    colors: ['#166534 40%', '#b91c1c 40%'], // Португальский флаг - приглушенные зеленый и красный
    direction: 'to right',
    textColor: '#000000'
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
    return {
      background: gradient,
      color: colorConfig.textColor || '#FFFFFF',
      backgroundClip: 'padding-box'
    }
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