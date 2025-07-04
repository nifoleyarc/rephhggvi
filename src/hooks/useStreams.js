import { useState, useCallback } from 'react'
import axios from 'axios'
import { useTelegram } from './useTelegram'
import { API_CONFIG, DEMO_DATA, safeApiCall } from '../utils/api'

export function useStreams() {
  const [streams, setStreams] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [apiConnected, setApiConnected] = useState(false)
  const { tg } = useTelegram()

  const fetchStreams = useCallback(async (category = null) => {
    setLoading(true)
    setError(null)
    
    try {
      // Проверяем доступность API
      const isConnected = await API_CONFIG.checkConnection()
      setApiConnected(isConnected)
      
      if (!isConnected) {
        console.log('🎭 API недоступен, используем демо-данные')
        setStreams(DEMO_DATA.streams)
        setCategories(DEMO_DATA.categories)
        setLoading(false)
        return
      }

      console.log('🌐 Подключение к API:', API_CONFIG.baseURL)
      const params = category ? { category } : {}
      
      const response = await safeApiCall(
        () => axios.get(`${API_CONFIG.baseURL}/streams`, { 
          params,
          headers: API_CONFIG.getDataHeaders()
        }),
        { data: DEMO_DATA }
      )
      
      console.log('✅ API подключен успешно!')
      
      // Трансформируем данные для совместимости с компонентами
      const transformedStreams = (response.data.streams || []).map(stream => ({
        ...stream,
        date: stream.stream_date, // Преобразуем stream_date в date
        telegramUrl: stream.telegram_url // Преобразуем telegram_url в telegramUrl
      }))
      
      setStreams(transformedStreams)
      setCategories(response.data.categories || [])
      
    } catch (err) {
      setError(err.message)
      console.error('❌ Ошибка подключения к API:', err)
      
      // Показываем демо-данные в случае ошибки
      setStreams(DEMO_DATA.streams)
      setCategories(DEMO_DATA.categories)
      setApiConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_CONFIG.baseURL}/categories`, {
        headers: API_CONFIG.getDataHeaders()
      })
      setCategories(response.data)
    } catch (err) {
      console.error('Error fetching categories:', err)
      setCategories(DEMO_DATA.categories)
    }
  }, [])

  const addStream = useCallback(async (streamData) => {
    try {
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      const response = await axios.post(
        `${API_CONFIG.baseURL}/streams`, 
        streamData, 
        { headers }
      )
      
      const transformedStream = {
        ...response.data,
        date: response.data.stream_date,
        telegramUrl: response.data.telegram_url
      }
      
      setStreams(prev => [transformedStream, ...prev])
      return transformedStream
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const updateStream = useCallback(async (id, streamData) => {
    try {
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      const response = await axios.put(
        `${API_CONFIG.baseURL}/streams/${id}`, 
        streamData, 
        { headers }
      )
      
      const transformedStream = {
        ...response.data,
        date: response.data.stream_date,
        telegramUrl: response.data.telegram_url
      }
      
      setStreams(prev => prev.map(stream => 
        stream._id === id ? transformedStream : stream
      ))
      return transformedStream
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const deleteStream = useCallback(async (id) => {
    try {
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      await axios.delete(`${API_CONFIG.baseURL}/streams/${id}`, { headers })
      setStreams(prev => prev.filter(stream => stream._id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const addCategory = useCallback(async (categoryData) => {
    try {
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      const response = await axios.post(
        `${API_CONFIG.baseURL}/categories`, 
        categoryData, 
        { headers }
      )
      
      setCategories(prev => [...prev, response.data])
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const updateCategory = useCallback(async (id, categoryData) => {
    try {
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      const response = await axios.put(
        `${API_CONFIG.baseURL}/categories/${id}`, 
        categoryData, 
        { headers }
      )
      
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
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      await axios.delete(`${API_CONFIG.baseURL}/categories/${id}`, { headers })
      setCategories(prev => prev.filter(cat => cat._id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg])

  const refreshThumbnails = useCallback(async () => {
    try {
      const headers = API_CONFIG.getAuthHeaders(tg?.initData)
      
      const response = await axios.post(
        `${API_CONFIG.baseURL}/refresh-thumbnails`, 
        {}, 
        { headers }
      )
      
      // Обновляем стримы после обновления превью
      await fetchStreams()
      
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [tg, fetchStreams])

  return {
    streams,
    categories,
    loading,
    error,
    apiConnected,
    fetchStreams,
    fetchCategories,
    addStream,
    updateStream,
    deleteStream,
    addCategory,
    updateCategory,
    deleteCategory,
    refreshThumbnails
  }
} 