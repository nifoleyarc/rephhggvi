// Категории стримов с их настройками
export const STREAM_CATEGORIES = [
  {
    id: 'all',
    name: 'Все',
    tag: null,
    color: '#6B7280',
    icon: '📺'
  },
  {
    id: 'игры',
    name: 'Игровые',
    tag: '#игры',
    color: '#EF4444',
    icon: '🎮'
  },
  {
    id: 'just_chatting', 
    name: 'Общение / Видосы',
    tag: '#just_chatting',
    color: '#10B981',
    icon: '💬'
  },
  {
    id: 'фильм',
    name: 'Фильмы',
    tag: '#фильм', 
    color: '#8B5CF6',
    icon: '🎬'
  },
  {
    id: 'контент',
    name: 'Контент',
    tag: '#контент',
    color: '#3B82F6',
    icon: '👀'
  },
  {
    id: 'ирл',
    name: 'ИРЛ',
    tag: '#ирл',
    color: '#3B82F6',
    icon: '🌍'
  },
  {
    id: 'шоу',
    name: 'ШОУ',
    tag: '#шоу',
    color: '#8B5CF6',
    icon: '🎭'
  },
  {
    id: 'кукинг',
    name: 'Кукинги',
    tag: '#кукинг',
    color: '#11998e',
    icon: '🍳'
  },
  {
    id: 'марафон',
    name: 'Марафоны', 
    tag: '#марафон',
    color: '#F59E0B',
    icon: '🏃'
  }
]

// Опции сортировки
export const SORT_OPTIONS = [
  {
    key: 'date',
    label: 'По дате',
    icon: '📅'
  },
  {
    key: 'name', 
    label: 'По названию',
    icon: '🔤'
  }
]

// Анимации
export const ANIMATIONS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 }
  }
}

// API endpoints
export const API_ENDPOINTS = {
  streams: '/api/streams',
  categories: '/api/categories', 
  auth: '/api/auth',
  webhook: '/api/webhook'
}

// Telegram Web App цвета по умолчанию
export const DEFAULT_THEME = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#999999',
  link_color: '#2481cc',
  button_color: '#2481cc',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f1f1f1'
} 