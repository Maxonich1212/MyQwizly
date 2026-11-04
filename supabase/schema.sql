-- Схема MyQwizly (Supabase проект dygafnxohhkslzhpvcem). Уже применена через миграции,
-- файл — для справки и для пересоздания проекта с нуля.
--
-- Принцип синхронизации: клиент генерирует id и пишет updated_at (ms) для LWW,
-- сервер ставит server_at триггером — по нему клиент забирает изменения.

create or replace function public.touch_server_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- clock_timestamp, а не now(): у строк одного батча метки различаются,
  -- иначе постраничная выгрузка по server_at может пропустить строки
  new.server_at := clock_timestamp();
  return new;
end $$;

create table public.sections (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text,
  color text,
  sort double precision not null default 0,
  goal int,
  deleted boolean not null default false,
  updated_at bigint not null,
  server_at timestamptz not null default now()
);

create table public.decks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  section_id uuid not null,
  name text not null,
  kind text not null default 'qa' check (kind in ('qa','vocab')),
  sort double precision not null default 0,
  deleted boolean not null default false,
  updated_at bigint not null,
  server_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid not null,
  front text not null default '',
  back text not null default '',
  extra jsonb not null default '{}'::jsonb,
  format text not null default 'md' check (format in ('md','html')),
  tags text[] not null default '{}',
  srs jsonb not null default '{}'::jsonb,
  suspended boolean not null default false,
  deleted boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  server_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  note_id uuid not null,
  deck_id uuid not null,
  section_id uuid not null,
  dir text not null default 'fwd',
  rating smallint not null check (rating between 1 and 4),
  state smallint not null,
  ms int not null default 0,
  day date not null,
  reviewed_at bigint not null,
  updated_at bigint not null,
  server_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null,
  server_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['sections','decks','notes','reviews','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_server_at()', t || '_touch', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t || '_sel', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$p$, t || '_ins', t);
    execute format($p$create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t || '_upd', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))$p$, t || '_del', t);
  end loop;
end $$;

create index sections_pull on public.sections (user_id, server_at);
create index decks_pull on public.decks (user_id, server_at);
create index notes_pull on public.notes (user_id, server_at);
create index reviews_pull on public.reviews (user_id, server_at);

-- Картинки из .apkg: приватный бакет, папка = user_id
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_sel on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_upd on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_del on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ——— Добавлено позже (миграции habits, backup_keys, push_reminders) ———
-- habits / habit_logs — трекер привычек (id лога = "<habit_id>:<день>")
-- backup_keys — sha-256 ключа ночного бэкапа (edge-функция backup, репо Maxonich1212/myqwizly-backups)
-- push_subs / push_log / app_secrets — напоминания: edge-функция remind, pg_cron 'habit-remind' каждые 5 минут
-- Полный DDL см. в истории миграций проекта Supabase (list_migrations).
