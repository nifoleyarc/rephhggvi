import { useState, useCallback } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api'

export function useStreams() {
  const [streams, setStreams] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      const response = await axios.post(`${API_BASE}/streams`, streamData)
      setStreams(prev => [response.data, ...prev])
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const updateStream = useCallback(async (id, streamData) => {
    try {
      const response = await axios.put(`${API_BASE}/streams/${id}`, streamData)
      setStreams(prev => prev.map(stream => 
        stream._id === id ? response.data : stream
      ))
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const deleteStream = useCallback(async (id) => {
    try {
      await axios.delete(`${API_BASE}/streams/${id}`)
      setStreams(prev => prev.filter(stream => stream._id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const addCategory = useCallback(async (categoryData) => {
    try {
      const response = await axios.post(`${API_BASE}/categories`, categoryData)
      setCategories(prev => [...prev, response.data])
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const updateCategory = useCallback(async (id, categoryData) => {
    try {
      const response = await axios.put(`${API_BASE}/categories/${id}`, categoryData)
      setCategories(prev => prev.map(cat => 
        cat._id === id ? response.data : cat
      ))
      return response.data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const deleteCategory = useCallback(async (id) => {
    try {
      await axios.delete(`${API_BASE}/categories/${id}`)
      setCategories(prev => prev.filter(cat => cat._id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

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