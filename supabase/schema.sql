-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.
create table if not exists public.hackathon_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint hackathon_state_singleton check (id = 'main')
);

alter table public.hackathon_state enable row level security;
revoke all on table public.hackathon_state from anon, authenticated;
grant all on table public.hackathon_state to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'presentation-materials',
  'presentation-materials',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.hancom.hwp',
    'application/vnd.hancom.hwpx',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
