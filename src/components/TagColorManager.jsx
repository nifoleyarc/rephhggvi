import React, { useState, useEffect } from 'react'
import { 
  getAllTagColors, 
  setTagColor, 
  removeTagColor, 
  exportTagColors, 
  importTagColors,
  clearTagColorsCache
} from '../utils/tagColors.js'
import GradientColorPicker from './GradientColorPicker.jsx'

const TagColorManager = ({ isOpen, onClose, streams = [] }) => {
  const [tagColors, setTagColors] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null) // null, 'saving', 'success', 'error'
  const [editingTag, setEditingTag] = useState(null)
  const [tempColorConfig, setTempColorConfig] = useState(null)
  const [allTags, setAllTags] = useState([])

  // Загрузка данных при открытии
  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setIsLoading(true)
    setSaveStatus(null)
    try {
      const colors = await getAllTagColors()
      setTagColors(colors)
      
      // Извлекаем все уникальные теги из стримов
      const uniqueTags = extractAllTags(streams)
      setAllTags(uniqueTags)
      
      console.log('✓ Tag colors loaded:', Object.keys(colors).length, 'configured')
    } catch (error) {
      console.error('Failed to load tag colors:', error)
      setSaveStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  // Извлечение уникальных тегов из стримов
  const extractAllTags = (streams) => {
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

  // Сохранение цвета тега
  const handleSaveTag = async (tag, colorConfig) => {
    setSaveStatus('saving')
    try {
      const updatedColors = await setTagColor(tag, colorConfig)
      setTagColors(updatedColors)
      setSaveStatus('success')
      
      // Сбрасываем временные данные
      setEditingTag(null)
      setTempColorConfig(null)
      
      // Очищаем статус через 2 секунды
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('Failed to save tag color:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  // Удаление цвета тега
  const handleRemoveTag = async (tag) => {
    setSaveStatus('saving')
    try {
      const updatedColors = await removeTagColor(tag)
      setTagColors(updatedColors)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('Failed to remove tag color:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  // Экспорт конфигурации
  const handleExport = async () => {
    try {
      await exportTagColors()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Импорт конфигурации
  const handleImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setSaveStatus('saving')
    try {
      const importedColors = await importTagColors(file)
      setTagColors(importedColors)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('Import failed:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
    
    // Сброс инпута
    event.target.value = ''
  }

  // Открытие редактора цвета
  const handleEditTag = (tag) => {
    const config = tagColors[tag] || {
      colorType: 'solid',
      solidColor: '#3B82F6',
      backgroundTransparency: 100,
      textColor: '#ffffff'
    }
    
    setEditingTag(tag)
    setTempColorConfig(config)
  }

  // Сохранение изменений в редакторе
  const handleSaveEdit = () => {
    if (editingTag && tempColorConfig) {
      handleSaveTag(editingTag, tempColorConfig)
    }
  }

  // Отмена редактирования
  const handleCancelEdit = () => {
    setEditingTag(null)
    setTempColorConfig(null)
  }

  // Фильтрация тегов по поисковому запросу
  const filteredTags = allTags.filter(tag => 
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Предварительный просмотр стиля тега
  const getTagPreviewStyle = (tag) => {
    const config = tagColors[tag]
    if (!config) {
      return {
        backgroundColor: 'rgba(75, 85, 99, 0.4)',
        color: '#E5E7EB'
      }
    }

    let backgroundStyle = ''
    
    if (config.colorType === 'gradient' && config.gradientColors) {
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
      const direction = directions[config.gradientType] || 'to right'
      backgroundStyle = `linear-gradient(${direction}, ${config.gradientColors.join(', ')})`
    } else if (config.solidColor) {
      const transparency = (config.backgroundTransparency || 100) / 100
      const hex = config.solidColor
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16) 
      const b = parseInt(hex.slice(5, 7), 16)
      backgroundStyle = `rgba(${r}, ${g}, ${b}, ${transparency})`
    }

    return {
      background: backgroundStyle,
      color: config.textColor || '#ffffff',
      textShadow: config.textShadow || ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Заголовок */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Управление цветами тегов</h2>
          <div className="flex items-center gap-4">
            {/* Статус сохранения */}
            {saveStatus && (
              <div className={`text-sm px-3 py-1 rounded ${
                saveStatus === 'saving' ? 'bg-blue-500/20 text-blue-300' :
                saveStatus === 'success' ? 'bg-green-500/20 text-green-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {saveStatus === 'saving' ? 'Сохранение...' :
                 saveStatus === 'success' ? 'Сохранено!' :
                 'Ошибка сохранения'}
              </div>
            )}
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              Загрузка цветов тегов...
            </div>
          ) : (
            <>
              {/* Панель управления */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-48">
                  <input
                    type="text"
                    placeholder="Поиск тегов..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Экспорт
                </button>
                
                <label className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer">
                  Импорт
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
                
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Обновить
                </button>
              </div>

              {/* Список тегов */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-white mb-4">
                  Найдено тегов: {filteredTags.length}
                </h3>
                
                {filteredTags.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    {searchTerm ? 'Теги не найдены' : 'Нет доступных тегов'}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredTags.map(tag => (
                      <div key={tag} className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg">
                        {/* Предварительный просмотр тега */}
                        <div 
                          className="px-3 py-1 rounded-full text-sm font-medium min-w-0 flex-shrink-0"
                          style={getTagPreviewStyle(tag)}
                        >
                          #{tag}
                        </div>
                        
                        {/* Информация о настройках */}
                        <div className="flex-1 min-w-0">
                          {tagColors[tag] ? (
                            <div className="text-sm text-gray-300">
                              {tagColors[tag].colorType === 'gradient' ? 
                                `Градиент (${tagColors[tag].gradientColors?.length || 0} цветов)` : 
                                'Обычный цвет'
                              }
                              {tagColors[tag].backgroundTransparency && tagColors[tag].backgroundTransparency !== 100 && (
                                <span className="ml-2 text-gray-400">
                                  • {tagColors[tag].backgroundTransparency}% прозрачность
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">Цвет не настроен</div>
                          )}
                        </div>
                        
                        {/* Кнопки действий */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditTag(tag)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                          >
                            Изменить
                          </button>
                          
                          {tagColors[tag] && (
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Редактор цвета (модальное окно поверх основного) */}
      {editingTag && tempColorConfig && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Редактирование: #{editingTag}
              </h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <GradientColorPicker
                colorConfig={tempColorConfig}
                onChange={setTempColorConfig}
              />
              
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Сохранить
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TagColorManager 