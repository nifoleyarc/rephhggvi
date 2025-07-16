import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, X, Tag, Palette, RotateCcw, Download, Upload, 
  Edit, Check, Trash2, Plus, Eye, EyeOff 
} from 'lucide-react'
import GradientColorPicker from './GradientColorPicker'
import { 
  getTagColors, 
  setTagColor, 
  removeTagColor, 
  extractAllTags, 
  resetTagColors,
  exportTagColors,
  importTagColors
} from '../utils/tagColors'

const TagColorManager = ({ streams = [], onClose, showToast, hapticFeedback }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTag, setEditingTag] = useState(null)
  const [tagColors, setTagColorsState] = useState({})
  const [showPreview, setShowPreview] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  // Добавляем временное состояние для изменений
  const [tempColorConfig, setTempColorConfig] = useState(null)

  // Загружаем цвета тегов при монтировании
  useEffect(() => {
    setTagColorsState(getTagColors())
  }, [])

  // Получаем все уникальные теги из стримов
  const allTags = useMemo(() => {
    const streamTags = extractAllTags(streams)
    const configuredTags = Object.keys(tagColors)
    
    // Объединяем теги из стримов и настроенные теги
    const uniqueTags = new Set([...streamTags, ...configuredTags])
    return Array.from(uniqueTags).sort()
  }, [streams, tagColors])

  // Фильтрация тегов по поиску
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return allTags
    
    const query = searchQuery.toLowerCase()
    return allTags.filter(tag => 
      tag.toLowerCase().includes(query)
    )
  }, [allTags, searchQuery])

  // Получение стиля тега для превью
  const getTagStyle = (tag) => {
    // Используем временную конфигурацию если редактируется этот тег
    const config = editingTag === tag ? tempColorConfig : tagColors[tag]
    
    if (!config) {
      return {
        backgroundColor: 'rgba(107, 114, 128, 0.4)', // gray-500/40
        color: '#E5E7EB' // gray-200
      }
    }

    if (config.type === 'gradient') {
      const style = {
        background: `linear-gradient(${config.direction || 'to right'}, ${config.colors.join(', ')})`,
        color: config.textColor || '#FFFFFF'
      }
      
      // Добавляем прозрачность для градиента если указана
      if (config.opacity && config.opacity !== '100') {
        style.opacity = config.opacity / 100
      }
      
      // Добавляем textShadow если есть
      if (config.textShadow) {
        style.textShadow = config.textShadow
      }
      
      return style
    } else {
      const color = config.colors[0]
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null
      }
      
      const rgb = hexToRgb(color)
      if (rgb) {
        const style = {
          backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.${config.bgOpacity || '40'})`,
          color: config.textColor || '#E5E7EB'
        }
        
        // Добавляем прозрачность если указана
        if (config.opacity && config.opacity !== '100') {
          style.opacity = config.opacity / 100
        }
        
        // Добавляем textShadow если есть
        if (config.textShadow) {
          style.textShadow = config.textShadow
        }
        
        return style
      }
      return {
        backgroundColor: 'rgba(107, 114, 128, 0.4)',
        color: '#E5E7EB'
      }
    }
  }

  // Начало редактирования тега
  const handleStartEditing = (tag) => {
    setEditingTag(tag)
    // Инициализируем временную конфигурацию
    setTempColorConfig(tagColors[tag] || {
      type: 'solid',
      colors: ['#3B82F6'],
      bgOpacity: '40',
      textColor: '#FFFFFF',
      opacity: '100'
    })
  }

  // Обновление временной конфигурации
  const handleTempColorChange = (colorConfig) => {
    setTempColorConfig(colorConfig)
  }

  // Сохранение цвета тега
  const handleSaveTagColor = (tag) => {
    if (tempColorConfig) {
      setTagColor(tag, tempColorConfig)
      const newColors = getTagColors()
      setTagColorsState(newColors)
      setEditingTag(null)
      setTempColorConfig(null)
      showToast(`Цвет тега "${tag}" сохранен`, 'success')
      hapticFeedback?.('notification', 'success')
    }
  }

  // Отмена редактирования
  const handleCancelEditing = () => {
    setEditingTag(null)
    setTempColorConfig(null)
  }

  // Удаление настройки цвета тега
  const handleRemoveTagColor = (tag) => {
    removeTagColor(tag)
    const newColors = getTagColors()
    setTagColorsState(newColors)
    showToast(`Цвет тега "${tag}" сброшен`, 'info')
    hapticFeedback?.('impact', 'light')
  }

  // Сброс всех цветов
  const handleResetAll = () => {
    if (window.confirm('Сбросить все настройки цветов к значениям по умолчанию?')) {
      resetTagColors()
      const newColors = getTagColors()
      setTagColorsState(newColors)
      showToast('Все цвета сброшены к значениям по умолчанию', 'info')
      hapticFeedback?.('notification', 'warning')
    }
  }

  // Экспорт настроек
  const handleExport = () => {
    try {
      exportTagColors()
      showToast('Настройки цветов экспортированы', 'success')
      hapticFeedback?.('notification', 'success')
    } catch (error) {
      showToast('Ошибка экспорта настроек', 'error')
    }
  }

  // Импорт настроек
  const handleImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setIsLoading(true)
    try {
      await importTagColors(file)
      const newColors = getTagColors()
      setTagColorsState(newColors)
      showToast('Настройки цветов импортированы', 'success')
      hapticFeedback?.('notification', 'success')
    } catch (error) {
      showToast(`Ошибка импорта: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
      event.target.value = '' // Сброс input
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 rounded-lg w-full max-w-4xl mx-4 h-[90vh] flex flex-col"
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Tag size={24} className="text-blue-400" />
            <h2 className="text-xl font-bold text-white">Управление цветами тегов</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title={showPreview ? 'Скрыть превью' : 'Показать превью'}
            >
              {showPreview ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Панель инструментов */}
        <div className="p-4 border-b border-gray-800 space-y-3">
          {/* Поиск */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск тегов..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleResetAll}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              <RotateCcw size={16} />
              Сбросить все
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Download size={16} />
              Экспорт
            </button>
            
            <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer">
              <Upload size={16} />
              Импорт
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                disabled={isLoading}
              />
            </label>

            <div className="text-sm text-gray-400 flex items-center">
              Найдено тегов: {filteredTags.length}
            </div>
          </div>
        </div>

        {/* Список тегов */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredTags.map((tag) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between">
                  {/* Информация о теге */}
                  <div className="flex items-center gap-3">
                    <Tag size={16} className="text-gray-400" />
                    <span className="font-medium text-white">#{tag}</span>
                    
                    {showPreview && (
                      <span
                        className="px-3 py-1 rounded text-sm font-medium"
                        style={getTagStyle(tag)}
                      >
                        {tag}
                      </span>
                    )}
                  </div>

                  {/* Кнопки действий */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEditing(tag)}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Редактировать цвет"
                      disabled={editingTag && editingTag !== tag}
                    >
                      <Edit size={16} />
                    </button>
                    
                    {tagColors[tag] && (
                      <button
                        onClick={() => handleRemoveTagColor(tag)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        title="Сбросить к умолчанию"
                        disabled={editingTag === tag}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Редактор цвета */}
                <AnimatePresence>
                  {editingTag === tag && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-gray-700"
                    >
                      <GradientColorPicker
                        value={tempColorConfig}
                        onChange={handleTempColorChange}
                        label={`Настройка цвета для тега "${tag}"`}
                        showPreview={true}
                      />
                      
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleSaveTagColor(tag)}
                          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                          <Check size={16} />
                          Сохранить
                        </button>
                        
                        <button
                          onClick={handleCancelEditing}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                        >
                          <X size={16} />
                          Отмена
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {filteredTags.length === 0 && (
            <div className="text-center py-12">
              <Tag size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-400">
                {searchQuery ? 'Теги не найдены' : 'Нет доступных тегов'}
              </p>
            </div>
          )}
        </div>


      </motion.div>
    </div>
  )
}

export default TagColorManager 