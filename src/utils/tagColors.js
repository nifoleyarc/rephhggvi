import { api } from './api.js'

// Cache для цветов тегов
let tagColorsCache = null
let isLoading = false
let loadPromise = null

// Предустановленные цвета флагов стран (как fallback)
const DEFAULT_TAG_COLORS = {
  'франция': {
    colorType: 'gradient',
    gradientType: 'linear-to-r',
    gradientColors: ['rgba(70, 130, 180, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(220, 20, 60, 0.7) 66%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'париж': {
    colorType: 'gradient',
    gradientType: 'linear-to-r',
    gradientColors: ['rgba(70, 130, 180, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(220, 20, 60, 0.7) 66%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'польша': {
    colorType: 'gradient',
    gradientType: 'linear-to-b',
    gradientColors: ['rgba(255, 255, 255, 0.7) 50%', 'rgba(220, 20, 60, 0.7) 50%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'таиланд': {
    colorType: 'gradient',
    gradientType: 'linear-to-b',
    gradientColors: ['rgba(220, 20, 60, 0.7) 16.67%', 'rgba(255, 255, 255, 0.7) 16.67%', 'rgba(255, 255, 255, 0.7) 33.33%', 'rgba(30, 60, 180, 0.7) 33.33%', 'rgba(30, 60, 180, 0.7) 66.67%', 'rgba(255, 255, 255, 0.7) 66.67%', 'rgba(255, 255, 255, 0.7) 83.33%', 'rgba(220, 20, 60, 0.7) 83.33%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'испания': {
    colorType: 'gradient',
    gradientType: 'linear-to-b',
    gradientColors: ['rgba(200, 20, 20, 0.7) 25%', 'rgba(255, 215, 0, 0.7) 25%', 'rgba(255, 215, 0, 0.7) 75%', 'rgba(200, 20, 20, 0.7) 75%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'австрия': {
    colorType: 'gradient',
    gradientType: 'linear-to-b',
    gradientColors: ['rgba(200, 20, 20, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(200, 20, 20, 0.7) 66%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'грузия': {
    colorType: 'gradient',
    gradientType: 'linear-to-r',
    gradientColors: ['rgba(255, 255, 255, 0.7) 50%', 'rgba(220, 20, 60, 0.7) 50%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'оаэ': {
    colorType: 'gradient',
    gradientType: 'linear-to-r',
    gradientColors: ['rgba(34, 139, 34, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(0, 0, 0, 0.7) 66%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'дубай': {
    colorType: 'gradient',
    gradientType: 'linear-to-r',
    gradientColors: ['rgba(34, 139, 34, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 33%', 'rgba(255, 255, 255, 0.7) 66%', 'rgba(0, 0, 0, 0.7) 66%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  },
  'португалия': {
    colorType: 'gradient',
    gradientType: 'linear-to-r',
    gradientColors: ['rgba(34, 139, 34, 0.7) 50%', 'rgba(220, 20, 60, 0.7) 50%'],
    backgroundTransparency: 70,
    textColor: '#ffffff',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)'
  }
}

// Загрузка цветов тегов с сервера
export async function loadTagColors() {
  if (tagColorsCache) {
    return tagColorsCache
  }

  if (isLoading) {
    return loadPromise
  }

  isLoading = true
  loadPromise = (async () => {
    try {
      const response = await api.get('/tag-colors')
      tagColorsCache = response.data || {}
      
      // Если база данных пуста, пробуем мигрировать из localStorage
      if (Object.keys(tagColorsCache).length === 0) {
        await migrateFromLocalStorage()
      }
      
      console.log('✓ Tag colors loaded from server:', Object.keys(tagColorsCache).length, 'tags')
      return tagColorsCache
    } catch (error) {
      console.error('Failed to load tag colors from server:', error)
      
      // Fallback: пробуем загрузить из localStorage
      const localData = getTagColorsFromLocalStorage()
      if (Object.keys(localData).length > 0) {
        console.log('Using localStorage as fallback')
        tagColorsCache = localData
        
        // Пробуем мигрировать в базу данных в фоне
        migrateFromLocalStorage().catch(err => {
          console.error('Background migration failed:', err)
        })
      } else {
        // Используем предустановленные цвета
        tagColorsCache = { ...DEFAULT_TAG_COLORS }
        console.log('Using default tag colors as fallback')
      }
      
      return tagColorsCache
    } finally {
      isLoading = false
    }
  })()

  return loadPromise
}

// Сохранение цветов тегов на сервер
export async function saveTagColors(tagColors) {
  try {
    const response = await api.put('/tag-colors', tagColors)
    
    // Обновляем кэш
    tagColorsCache = { ...tagColors }
    
    console.log('✓ Tag colors saved to server:', Object.keys(tagColors).length, 'tags')
    return response.data
  } catch (error) {
    console.error('Failed to save tag colors to server:', error)
    
    // Fallback: сохраняем в localStorage
    saveTagColorsToLocalStorage(tagColors)
    tagColorsCache = { ...tagColors }
    
    throw new Error('Не удалось сохранить на сервере, данные сохранены локально')
  }
}

// Миграция данных из localStorage в базу данных
async function migrateFromLocalStorage() {
  try {
    const localData = getTagColorsFromLocalStorage()
    
    if (Object.keys(localData).length === 0) {
      console.log('No localStorage data to migrate')
      return
    }

    const response = await api.post('/tag-colors/migrate', localData)
    console.log('✓ Successfully migrated', Object.keys(localData).length, 'tags from localStorage to database')
    
    // Обновляем кэш с мигрированными данными
    tagColorsCache = { ...localData }
    
    // Очищаем localStorage после успешной миграции
    localStorage.removeItem('tagColors')
    console.log('✓ localStorage cleared after successful migration')
    
    return response.data
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('Migration skipped: data already exists in database')
    } else {
      console.error('Migration failed:', error)
    }
  }
}

// Получение цветов тегов из localStorage (fallback)
function getTagColorsFromLocalStorage() {
  try {
    const stored = localStorage.getItem('tagColors')
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('Error reading tag colors from localStorage:', error)
    return {}
  }
}

// Сохранение цветов тегов в localStorage (fallback)
function saveTagColorsToLocalStorage(tagColors) {
  try {
    localStorage.setItem('tagColors', JSON.stringify(tagColors))
    console.log('✓ Tag colors saved to localStorage as fallback')
  } catch (error) {
    console.error('Error saving tag colors to localStorage:', error)
  }
}

// Получение цвета для конкретного тега
export async function getTagColor(tag) {
  const tagColors = await loadTagColors()
  const normalizedTag = tag.toLowerCase()
  
  const config = tagColors[normalizedTag]
  if (!config) {
    return null
  }

  return generateTagStyle(config)
}

// Получение всех цветов тегов
export async function getAllTagColors() {
  return await loadTagColors()
}

// Установка цвета для тега
export async function setTagColor(tag, colorConfig) {
  const tagColors = await loadTagColors()
  const normalizedTag = tag.toLowerCase()
  
  tagColors[normalizedTag] = { ...colorConfig }
  await saveTagColors(tagColors)
  
  return tagColors
}

// Удаление цвета тега
export async function removeTagColor(tag) {
  const tagColors = await loadTagColors()
  const normalizedTag = tag.toLowerCase()
  
  if (tagColors[normalizedTag]) {
    delete tagColors[normalizedTag]
    await saveTagColors(tagColors)
  }
  
  return tagColors
}

// Генерация CSS стилей на основе конфигурации
function generateTagStyle(config) {
  let backgroundStyle = ''
  let textColor = config.textColor || '#ffffff'
  let textShadow = config.textShadow || ''
  
  if (config.colorType === 'gradient' && config.gradientColors && config.gradientColors.length > 0) {
    const gradientDirection = getGradientDirection(config.gradientType)
    backgroundStyle = `linear-gradient(${gradientDirection}, ${config.gradientColors.join(', ')})`
  } else if (config.solidColor) {
    // Применяем прозрачность к solid цвету
    const transparency = (config.backgroundTransparency || 100) / 100
    const color = hexToRgba(config.solidColor, transparency)
    backgroundStyle = color
  }

  return {
    background: backgroundStyle,
    color: textColor,
    textShadow: textShadow,
    backgroundTransparency: config.backgroundTransparency || 100
  }
}

// Конвертация направления градиента
function getGradientDirection(gradientType) {
  const directions = {
    'linear-to-r': 'to right',
    'linear-to-l': 'to left',
    'linear-to-t': 'to top',
    'linear-to-b': 'to bottom',
    'linear-to-tr': 'to top right',
    'linear-to-tl': 'to top left',
    'linear-to-br': 'to bottom right',
    'linear-to-bl': 'to bottom left'
  }
  return directions[gradientType] || 'to right'
}

// Конвертация hex в rgba
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Экспорт конфигурации тегов
export async function exportTagColors() {
  const tagColors = await loadTagColors()
  const dataStr = JSON.stringify(tagColors, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = 'tag-colors-config.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Импорт конфигурации тегов
export async function importTagColors(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const importedColors = JSON.parse(e.target.result)
        await saveTagColors(importedColors)
        resolve(importedColors)
      } catch (error) {
        reject(new Error('Неверный формат файла'))
      }
    }
    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsText(file)
  })
}

// Сброс кэша (полезно при обновлении данных)
export function clearTagColorsCache() {
  tagColorsCache = null
} 