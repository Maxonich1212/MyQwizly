import { createClient } from '@supabase/supabase-js'

// Публикуемый ключ — его можно держать в клиенте, доступ режет RLS
const URL = 'https://dygafnxohhkslzhpvcem.supabase.co'
const KEY = 'sb_publishable_AbsBdQh2aMztyCM0kSntOQ_P6UuNmY4'

// Ссылка из письма «сбросить пароль» приходит с #...type=recovery — запоминаем до того,
// как клиент Supabase разберёт и очистит адрес
export const RECOVERY = typeof location !== 'undefined' && /type=recovery/.test(location.hash)

export const sb = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mq-auth' },
})
