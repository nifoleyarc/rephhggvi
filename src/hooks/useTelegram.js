import { useState, useEffect } from 'react'

export function useTelegram() {
  const [tg, setTg] = useState(null)
  const [user, setUser] = useState(null)
  const [themeParams, setThemeParams] = useState({})

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const telegram = window.Telegram.WebApp
      setTg(telegram)
      setUser(telegram.initDataUnsafe?.user)
      setThemeParams(telegram.themeParams)

      // Применяем темную тему (принудительно)
      document.documentElement.style.setProperty('--tg-color-bg', '#1a1a1a')
      document.documentElement.style.setProperty('--tg-color-text', '#ffffff')
      document.documentElement.style.setProperty('--tg-color-hint', '#888888')
      document.documentElement.style.setProperty('--tg-color-link', '#5fa3d3')
      document.documentElement.style.setProperty('--tg-color-button', '#5fa3d3')
      document.documentElement.style.setProperty('--tg-color-button-text', '#ffffff')
      document.documentElement.style.setProperty('--tg-color-secondary-bg', '#2d2d2d')

      // Включаем подтверждение при закрытии
      telegram.enableClosingConfirmation()
    }
  }, [])

  const hapticFeedback = (type = 'impact', style = 'medium') => {
    if (tg?.HapticFeedback) {
      if (type === 'impact') {
        tg.HapticFeedback.impactOccurred(style)
      } else if (type === 'notification') {
        tg.HapticFeedback.notificationOccurred(style)
      } else if (type === 'selection') {
        tg.HapticFeedback.selectionChanged()
      }
    }
  }

  const openTelegramLink = (url) => {
    if (tg) {
      tg.openTelegramLink(url)
      setTimeout(() => {
        tg.close()
      }, 100)
    } else {
      window.open(url, '_blank')
    }
  }



  return {
    tg,
    user,
    themeParams,
    hapticFeedback,
    openTelegramLink,
    initData: tg?.initData // Добавляем initData для авторизации
  }
}