# MyQwizly

Карточки с интервальными повторениями (FSRS) для подготовки к собеседованию iOS и английского.
React + Vite + Framer Motion, данные — IndexedDB локально и Supabase (`dygafnxohhkslzhpvcem`) для синхронизации.

- `npm run dev` — локально на http://localhost:5180, `?demo` — демо-данные без входа (только в dev)
- `npm run build` — сборка в `dist/`; пуш в `main` деплоит на GitHub Pages (`.github/workflows/deploy.yml`)
- Схема базы — `supabase/schema.sql`

Импорт: `.apkg` (Anki, старый и новый формат, картинки) и `.json` почти любой формы — см. подсказку на экране импорта.
