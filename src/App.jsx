import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import StreamList from './components/StreamList'
import Editor from './components/Editor'
import WelcomeScreen from './components/WelcomeScreen'
import { useTelegram } from './hooks/useTelegram'
import { useStreams } from './hooks/useStreams'
import { useToast } from './components/Toast'
import { Edit, Search } from 'lucide-react'

function App() {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showWelcome, setShowWelcome] = useState(true)
  const [showHeaderSearch, setShowHeaderSearch] = useState(false)
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0)
  const { tg, user, openTelegramLink } = useTelegram()
  const { streams, categories, loading, fetchStreams, apiConnected } = useStreams()
  const { showToast, ToastContainer } = useToast()
  const contentRef = useRef(null)

  useEffect(() => {
    fetchStreams()
  }, [])

  // Отслеживание скролла для показа иконки поиска
  useEffect(() => {
    if (showWelcome || isEditorOpen) return

    const handleScroll = () => {
      // Проверяем, прокручена ли страница достаточно, чтобы поле поиска стало невидимым
      const scrolled = window.scrollY > 200 // Примерно высота шапки + категории + часть контента
      setShowHeaderSearch(scrolled)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showWelcome, isEditorOpen])

  const openEditor = () => {
    setIsEditorOpen(true)
    if (tg) {
      tg.BackButton.show()
      tg.BackButton.onClick(() => {
        setIsEditorOpen(false)
        tg.BackButton.hide()
        // Обновляем данные при закрытии редактора
        fetchStreams()
      })
    }
  }

  const closeEditor = () => {
    setIsEditorOpen(false)
    if (tg) {
      tg.BackButton.hide()
    }
    // Обновляем данные при закрытии редактора
    fetchStreams()
  }

  const handleWelcomeCategorySelect = (categoryId) => {
    // Устанавливаем выбранную категорию
    setSelectedCategory(categoryId)
    
    // Скрываем приветственную страницу
    setShowWelcome(false)
  }

  const handleSearchClick = () => {
    // Добавляем haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged()
    }
    
    // Быстрый скролл наверх
    window.scrollTo({
      top: 0,
      behavior: 'auto'
    })
    
    // Увеличиваем счетчик для триггера фокуса (минимальная задержка)
    setTimeout(() => {
      setSearchFocusTrigger(prev => prev + 1)
    }, 100)
  }

  return (
    <div className="dark min-h-screen bg-tg-bg text-tg-text">
      <AnimatePresence mode="wait">
        {showWelcome ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.15 }}
          >
            <WelcomeScreen onCategorySelect={handleWelcomeCategorySelect} />
          </motion.div>
        ) : !isEditorOpen ? (
          <motion.div
            key="streams"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
            ref={contentRef}
          >
            {/* Header + Categories (Sticky) */}
            <div className="sticky top-0 z-10 bg-tg-bg border-b border-gray-700/50">
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <h1 className="text-xl font-roobert-bold">
                  VODS{" "}
                  <span className="text-sm font-roobert-light text-gray-400">
                    by{" "}
                    <span 
                      className="cursor-pointer hover:text-emerald-400 transition-colors"
                      onClick={() => {
                        openTelegramLink('https://t.me/nikothan')
                      }}
                    >
                      @nikothan
                    </span>
                  </span>
                </h1>
                <div className="flex items-center gap-2">
                  {/* Кнопка поиска - показывается при скролле */}
                  <AnimatePresence>
                    {showHeaderSearch && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleSearchClick}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800/40 border border-gray-400 hover:border-gray-300 text-white rounded-lg font-roobert-medium text-sm transition-colors"
                                              >
                          <Search size={16} className="text-white" />
                          <span>Искать</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={openEditor}
                    className="p-2 rounded-full bg-tg-secondary-bg hover:bg-gray-600 transition-colors"
                  >
                    <Edit size={20} />
                  </button>
                </div>
              </div>
              
              {/* Categories */}
              <div className="pb-3">
                <StreamList 
                  streams={streams} 
                  categories={categories}
                  loading={loading}
                                    selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  onStreamClick={(stream) => {
                    openTelegramLink(stream.telegramUrl)
                  }}
                  renderOnlyCategories={true}
                  apiConnected={apiConnected}
                />
              </div>
            </div>

            {/* Content */}
            <div>
              <StreamList 
                streams={streams} 
                categories={categories}
                loading={loading}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onStreamClick={(stream) => {
                  openTelegramLink(stream.telegramUrl)
                }}
                renderOnlyContent={true}
                onSearchFocus={searchFocusTrigger}
                apiConnected={apiConnected}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-tg-bg/95 backdrop-blur-md"
          >
            <Editor 
              onClose={closeEditor} 
              showToast={showToast} 
              onDataUpdate={fetchStreams}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <ToastContainer />
    </div>
  )
}

export default App 