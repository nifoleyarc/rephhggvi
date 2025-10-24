import React from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import daLogo from '/da.svg'

const WelcomeScreen = ({ onCategorySelect }) => {
  const { hapticFeedback } = useTelegram()

  // Категории без "Все стримы"
  const categories = [
    {
      id: 'фильм',
      name: 'Фильмы / Мультики',
      icon: '🍿',
      gradient: 'from-purple-500/20 via-purple-600/15 to-purple-700/20',
      hoverGradient: 'from-purple-500/30 via-purple-600/25 to-purple-700/30',
      glowColor: 'group-hover:shadow-purple-500/10',
    },
    {
      id: 'ирл',
      name: 'ИРЛ стримы',
      icon: '🗺️',
      gradient: 'from-blue-500/20 via-blue-600/15 to-blue-700/20',
      hoverGradient: 'from-blue-500/30 via-blue-600/25 to-blue-700/30',
      glowColor: 'group-hover:shadow-blue-500/10',
    },
    {
      id: 'контент',
      name: 'Контент',
      icon: '👀',
      gradient: 'from-green-500/20 via-green-600/15 to-green-700/20',
      hoverGradient: 'from-green-500/30 via-green-600/25 to-green-700/30',
      glowColor: 'group-hover:shadow-green-500/10',
    },
    {
      id: 'игры',
      name: 'Игровые стримы',
      icon: '🎮',
      gradient: 'from-red-500/20 via-red-600/15 to-red-700/20',
      hoverGradient: 'from-red-500/30 via-red-600/25 to-red-700/30',
      glowColor: 'group-hover:shadow-red-500/10',
    },
    {
      id: 'just_chatting',
      name: 'Общение / Видосы',
      icon: '💬',
      gradient: 'from-blue-500/25 via-blue-600/20 to-cyan-500/25',
      hoverGradient: 'from-blue-500/35 via-blue-600/30 to-cyan-500/35',
      glowColor: 'group-hover:shadow-blue-500/20',
    },
    {
      id: 'шоу',
      name: 'ШОУ',
      icon: '🎭',
      gradient: 'from-purple-500/30 via-violet-600/25 to-fuchsia-500/30',
      hoverGradient: 'from-purple-500/40 via-violet-600/35 to-fuchsia-500/40',
      glowColor: 'group-hover:shadow-purple-500/20',
    },
    {
      id: 'кукинг',
      name: 'Кукинги',
      icon: '🍳',
      gradient: 'from-emerald-600/25 via-emerald-500/20 to-green-400/25',
      hoverGradient: 'from-emerald-600/35 via-emerald-500/30 to-green-400/35',
      glowColor: 'group-hover:shadow-emerald-400/15',
    },
    {
      id: 'марафон',
      name: 'Марафоны',
      icon: '🏅',
      gradient: 'from-amber-400/30 via-yellow-500/25 to-orange-400/30',
      hoverGradient: 'from-amber-400/40 via-yellow-500/35 to-orange-400/40',
      glowColor: 'group-hover:shadow-amber-400/20',
    },
  ]

  const handleCategoryClick = (categoryId) => {
    hapticFeedback('impact', 'medium')
    onCategorySelect(categoryId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tg-bg via-gray-900 to-tg-bg relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-600 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-purple-600 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/4 w-28 h-28 bg-green-600 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-1/3 w-20 h-20 bg-pink-600 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 px-6 py-8">
        {/* Заголовок */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.h1 
            className="text-4xl font-roobert-bold text-tg-text mb-3"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
          >
            VODS
          </motion.h1>
          <motion.p 
            className="text-base text-tg-hint font-roobert-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            Выберите категорию для просмотра стримов
          </motion.p>
        </motion.div>

        {/* Сетка категорий */}
        <motion.div 
          className="grid grid-cols-2 gap-4 max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                duration: 0.2, 
                delay: 0.2 + index * 0.03,
                ease: "easeOut"
              }}
              whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
              whileTap={{ 
                scale: 0.95,
                transition: { duration: 0.1 }
              }}
              onClick={() => handleCategoryClick(category.id)}
              className="group cursor-pointer"
            >
              <div className={`
                relative overflow-hidden rounded-2xl p-6 h-32
                bg-gradient-to-br ${category.gradient}
                group-hover:bg-gradient-to-br group-hover:${category.hoverGradient}
                border border-gray-700/50 group-hover:border-gray-600/70
                backdrop-blur-sm
                transition-all duration-300 ease-out
                shadow-lg group-hover:shadow-xl
${category.glowColor}
              `}>
                {/* Переливающийся эффект */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent 
                               transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] 
                               transition-transform duration-1000 ease-out"></div>
                
                {/* Фоновый паттерн */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] 
                               bg-[size:20px_20px] group-hover:opacity-20 transition-opacity duration-300"></div>
                
                {/* Контент */}
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <motion.div 
                    className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    {category.icon}
                  </motion.div>
                  <h3 className="text-sm font-roobert-medium text-tg-text text-center leading-tight 
                               group-hover:text-white transition-colors duration-300">
                    {category.name}
                  </h3>
                </div>

                {/* Эффект свечения при hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 
                               bg-gradient-to-br from-white/10 via-transparent to-white/5 
                               transition-opacity duration-300"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Кнопка поддержки */}
        <motion.div
          className="mt-8 max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <motion.a
            href="https://dalink.to/nikothan"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticFeedback('impact', 'light')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group block w-full"
          >
            <div className="relative overflow-hidden rounded-xl p-4 
                          bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20
                          border border-gray-700/50 group-hover:border-pink-500/50
                          backdrop-blur-sm
                          transition-all duration-300 ease-out
                          shadow-lg group-hover:shadow-xl group-hover:shadow-pink-500/20">
              
              {/* Переливающийся эффект */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                             transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] 
                             transition-transform duration-1000 ease-out"></div>
              
              {/* Контент */}
              <div className="relative z-10 flex items-center justify-center gap-3">
                <img 
                  src={daLogo}
                  alt="DA" 
                  className="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
                />
                <span className="text-base font-roobert-medium text-tg-text group-hover:text-white transition-colors duration-300">
                  Поддержать автора
                </span>
              </div>

              {/* Эффект свечения при hover */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 
                             bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 
                             transition-opacity duration-300"></div>
            </div>
          </motion.a>
        </motion.div>
      </div>
    </div>
  )
}

export default WelcomeScreen