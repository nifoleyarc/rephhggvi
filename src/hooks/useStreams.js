import { useState, useCallback } from 'react'
import axios from 'axios'
import { useTelegram } from './useTelegram'

const API_BASE = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || 'https://api.your-domain.com/api') 
  : 'http://localhost:3000/api'

// Логируем для отладки
if (import.meta.env.PROD) {
  console.log('🌐 Production API URL:', import.meta.env.VITE_API_URL || 'NOT SET')
}

export function useStreams() {
  const [streams, setStreams] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { tg } = useTelegram()

  const fetchStreams = useCallback(async (category = null) => {
    setLoading(true)
    setError(null)
    
    try {
      const params = category ? { category } : {}
      const response = await axios.get(`${API_BASE}/streams`, { params })
      setStreams(response.data.streams || [])
      setCategories(response.data.categories || [])
    } catch (err) {
      setError(err.message)
      console.error('Error fetching streams:', err)
      
      // Если API недоступен, показываем пустые данные
      if (err.code === 'ERR_NETWORK' || err.response?.status === 404) {
        console.log('⚠️ API недоступен, показываем пустые данные')
        setStreams([])
        setCategories([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/categories`)
      setCategories(response.data)
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [])

  const addStream = useCallback(async (streamData) => {
    try {
      const headers = {}
      
      // Добавляем Telegram initData для аутентификации
      if (tg?.initData) {
        headers['x-telegram-init-data'] = tg.initData
      }
      
      const response = await axios.post(`${API_BASE}/streams`, streamData, { headers })
      setStreams(prev => [response.data, ...prev])
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const updateStream = useCallback(async (id, streamData) => {
    try {
      const headers = {}
      
      // Добавляем Telegram initData для аутентификации
      if (tg?.initData) {
        headers['x-telegram-init-data'] = tg.initData
      }
      
      const response = await axios.put(`${API_BASE}/streams/${id}`, streamData, { headers })
      setStreams(prev => prev.map(stream => 
        stream._id === id ? response.data : stream
      ))
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const deleteStream = useCallback(async (id) => {
    try {
      const headers = {}
      
      // Добавляем Telegram initData для аутентификации
      if (tg?.initData) {
        headers['x-telegram-init-data'] = tg.initData
      }
      
      await axios.delete(`${API_BASE}/streams/${id}`, { headers })
      setStreams(prev => prev.filter(stream => stream._id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const addCategory = useCallback(async (categoryData) => {
    try {
      const headers = {}
      
      // Добавляем Telegram initData для аутентификации
      if (tg?.initData) {
        headers['x-telegram-init-data'] = tg.initData
      }
      
      const response = await axios.post(`${API_BASE}/categories`, categoryData, { headers })
      setCategories(prev => [...prev, response.data])
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const updateCategory = useCallback(async (id, categoryData) => {
    try {
      const headers = {}
      
      // Добавляем Telegram initData для аутентификации
      if (tg?.initData) {
        headers['x-telegram-init-data'] = tg.initData
      }
      
      const response = await axios.put(`${API_BASE}/categories/${id}`, categoryData, { headers })
      setCategories(prev => prev.map(cat => 
        cat._id === id ? response.data : cat
      ))
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const deleteCategory = useCallback(async (id) => {
    try {
      const headers = {}
      
      // Добавляем Telegram initData для аутентификации
      if (tg?.initData) {
        headers['x-telegram-init-data'] = tg.initData
      }
      
      await axios.delete(`${API_BASE}/categories/${id}`, { headers })
      setCategories(prev => prev.filter(cat => cat._id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  return {
    streams,
    categories,
    loading,
    error,
    fetchStreams,
    fetchCategories,
    addStream,
    updateStream,
    deleteStream,
    addCategory,
    updateCategory,
    deleteCategory
  }
} 