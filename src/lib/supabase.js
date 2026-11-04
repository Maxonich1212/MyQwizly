import { createClient } from '@supabase/supabase-js'

// Публикуемый ключ — его можно держать в клиенте, доступ режет RLS
const URL = 'https://dygafnxohhkslzhpvcem.supabase.co'
const KEY = 'sb_publishable_AbsBdQh2aMztyCM0kSntOQ_P6UuNmY4'

export const sb = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mq-auth' },
})
