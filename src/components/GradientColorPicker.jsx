import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, RotateCw, Palette, Eye } from 'lucide-react'

// Предустановленные цвета
const PRESET_COLORS = [
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080',
  '#000000', '#404040', '#808080', '#C0C0C0', '#FFFFFF'
]

// Направления градиента
const GRADIENT_DIRECTIONS = [
  { value: 'to right', label: '→', description: 'Слева направо' },
  { value: 'to left', label: '←', description: 'Справа налево' },
  { value: 'to bottom', label: '↓', description: 'Сверху вниз' },
  { value: 'to top', label: '↑', description: 'Снизу вверх' },
  { value: 'to bottom right', label: '↘', description: 'Диагональ ↘' },
  { value: 'to bottom left', label: '↙', description: 'Диагональ ↙' },
  { value: 'to top right', label: '↗', description: 'Диагональ ↗' },
  { value: 'to top left', label: '↖', description: 'Диагональ ↖' }
]

const GradientColorPicker = ({ 
  value, 
  onChange, 
  label = "Цвет тега",
  showPreview = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [colorType, setColorType] = useState(value?.type || 'solid')
  const [colors, setColors] = useState(value?.colors || ['#3B82F6'])
  const [direction, setDirection] = useState(value?.direction || 'to right')
  const [bgOpacity, setBgOpacity] = useState(value?.bgOpacity || '40')
  const [opacity, setOpacity] = useState(value?.opacity || '100')
  const [textColor, setTextColor] = useState(value?.textColor || '#FFFFFF')
  const [textShadow, setTextShadow] = useState(value?.textShadow || '')

  // Обновляем стейт при изменении пропса
  useEffect(() => {
    if (value) {
      setColorType(value.type || 'solid')
      setColors(value.colors || ['#3B82F6'])
      setDirection(value.direction || 'to right')
      setBgOpacity(value.bgOpacity || '40')
      setOpacity(value.opacity || '100')
      setTextColor(value.textColor || '#FFFFFF')
      setTextShadow(value.textShadow || '')
    }
  }, [value])

  // Уведомляем о изменениях (но не автоматически сохраняем)
  const notifyChange = () => {
    const newValue = {
      type: colorType,
      colors: colors,
      direction: direction,
      bgOpacity: bgOpacity,
      opacity: opacity,
      textColor: textColor
    }
    
    // Добавляем textShadow только если он есть
    if (textShadow) {
      newValue.textShadow = textShadow
    }
    
    onChange(newValue)
  }

  // Вызываем notifyChange при любом изменении
  useEffect(() => {
    notifyChange()
  }, [colorType, colors, direction, bgOpacity, opacity, textColor, textShadow])

  const addColor = () => {
    if (colors.length < 5) {
      setColors([...colors, '#FFFFFF'])
    }
  }

  const removeColor = (index) => {
    if (colors.length > 1) {
      setColors(colors.filter((_, i) => i !== index))
    }
  }

  const updateColor = (index, newColor) => {
    const newColors = [...colors]
    newColors[index] = newColor
    setColors(newColors)
  }

  const getPreviewStyle = () => {
    if (colorType === 'gradient') {
      const style = {
        background: `linear-gradient(${direction}, ${colors.join(', ')})`,
        color: textColor
      }
      
      // Добавляем общую прозрачность
      if (opacity && opacity !== '100') {
        style.opacity = opacity / 100
      }
      
      // Добавляем textShadow если есть
      if (textShadow) {
        style.textShadow = textShadow
      }
      
      return style
    } else {
      const color = colors[0]
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
          backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.${bgOpacity})`,
          color: textColor
        }
        
        // Добавляем общую прозрачность
        if (opacity && opacity !== '100') {
          style.opacity = opacity / 100
        }
        
        // Добавляем textShadow если есть
        if (textShadow) {
          style.textShadow = textShadow
        }
        
        return style
      }
      return {}
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      
      {/* Превью и кнопка открытия */}
      <div className="flex gap-2">
        {showPreview && (
          <div 
            className="px-3 py-1 rounded text-sm font-medium min-w-[80px] text-center"
            style={getPreviewStyle()}
          >
            Превью
          </div>
        )}
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          <Palette size={16} />
          Настроить
        </button>
      </div>

      {/* Панель настроек */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-600 space-y-4">
              
              {/* Тип цвета */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Тип цвета
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setColorType('solid')}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      colorType === 'solid' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Обычный
                  </button>
                  <button
                    onClick={() => setColorType('gradient')}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      colorType === 'gradient' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Градиент
                  </button>
                </div>
              </div>

              {/* Цвета */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    {colorType === 'gradient' ? 'Цвета градиента' : 'Цвет фона'}
                  </label>
                  {colorType === 'gradient' && (
                    <div className="flex gap-1">
                      <button
                        onClick={addColor}
                        disabled={colors.length >= 5}
                        className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Добавить цвет"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  {colors.map((color, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => updateColor(index, e.target.value)}
                        className="w-8 h-8 rounded border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={color.toUpperCase()}
                        onChange={(e) => updateColor(index, e.target.value)}
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                        placeholder="#FFFFFF"
                      />
                      {colorType === 'gradient' && colors.length > 1 && (
                        <button
                          onClick={() => removeColor(index)}
                          className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                          title="Удалить цвет"
                        >
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Предустановленные цвета */}
                <div className="mt-3">
                  <label className="text-xs text-gray-400 mb-2 block">
                    Быстрый выбор:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((presetColor, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (colorType === 'gradient') {
                            // Для градиента заменяем первый цвет
                            updateColor(0, presetColor)
                          } else {
                            setColors([presetColor])
                          }
                        }}
                        className="w-6 h-6 rounded border border-gray-600 hover:scale-110 transition-transform"
                        style={{ backgroundColor: presetColor }}
                        title={presetColor}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Направление градиента */}
              {colorType === 'gradient' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Направление градиента
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {GRADIENT_DIRECTIONS.map((dir) => (
                      <button
                        key={dir.value}
                        onClick={() => setDirection(dir.value)}
                        className={`p-2 rounded text-sm transition-colors flex flex-col items-center ${
                          direction === dir.value 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        title={dir.description}
                      >
                        <span className="text-lg">{dir.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Прозрачность фона (только для обычного цвета) */}
              {colorType === 'solid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Прозрачность фона: {bgOpacity}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}

              {/* Общая прозрачность тега */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Общая прозрачность тега: {opacity}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={opacity}
                  onChange={(e) => setOpacity(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Влияет на весь тег целиком (цвет + текст)
                </p>
              </div>

              {/* Цвет текста */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Цвет текста
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor.toUpperCase()}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              {/* Обводка текста */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Обводка текста (необязательно)
                </label>
                <input
                  type="text"
                  value={textShadow}
                  onChange={(e) => setTextShadow(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder="0 0 3px rgba(255, 255, 255, 0.8)"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Пример: "0 0 3px white" для белой обводки
                </p>
              </div>

              {/* Большое превью */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Eye size={16} className="inline mr-2" />
                  Превью
                </label>
                <div 
                  className="w-full p-4 rounded text-center font-medium text-lg"
                  style={getPreviewStyle()}
                >
                  Пример тега
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GradientColorPicker 