import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Хелперы для работы с данными
export const streamHelpers = {
  // Получить все стримы с фильтрацией
  async getStreams(category = null) {
    let query = supabase
      .from('streams')
      .select(`
        id,
        title,
        telegram_url,
        stream_date,
        tags,
        categories,
        thumbnail_url,
        created_at
      `)
      .order('stream_date', { ascending: false })

    if (category && category !== 'all') {
      query = query.or(`categories.cs.{${category}},tags.cs.{${category}}`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  // Создать новый стрим
  async createStream(streamData) {
    const { data, error } = await supabase
      .from('streams')
      .insert({
        title: streamData.title,
        telegram_url: streamData.telegramUrl,
        stream_date: streamData.date,
        tags: streamData.tags || [],
        categories: streamData.categories || [],
        thumbnail_url: streamData.thumbnail,
        thumbnail_source: 'manual'
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Обновить стрим
  async updateStream(id, streamData) {
    const { data, error } = await supabase
      .from('streams')
      .update({
        title: streamData.title,
        telegram_url: streamData.telegramUrl,
        stream_date: streamData.date,
        tags: streamData.tags || [],
        categories: streamData.categories || [],
        thumbnail_url: streamData.thumbnail,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Удалить стрим
  async deleteStream(id) {
    const { error } = await supabase
      .from('streams')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

export const categoryHelpers = {
  // Получить все категории
  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  },

  // Создать категорию
  async createCategory(categoryData) {
    const { data, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Обновить категорию
  async updateCategory(id, categoryData) {
    const { data, error } = await supabase
      .from('categories')
      .update(categoryData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Удалить категорию
  async deleteCategory(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Авторизация через Telegram User ID
export const authHelpers = {
  // Проверка прав администратора
  async checkAdminAccess(userId) {
    try {
      // Вызываем Edge Function для проверки админских прав
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { 
          action: 'check_admin',
          user_id: userId 
        }
      })

      if (error) throw error
      return data?.isAdmin || false
    } catch (error) {
      console.error('Admin check failed:', error)
      return false
    }
  },

  // Вход по паролю (fallback)
  async loginWithPassword(password) {
    try {
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { 
          action: 'login_password',
          password: password 
        }
      })

      if (error) throw error
      return data?.success || false
    } catch (error) {
      console.error('Password login failed:', error)
      return false
    }
  }
} 