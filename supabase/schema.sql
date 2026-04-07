create extension if not exists pgcrypto;

-- Migracion temprana: si ya existian tablas con columnas en ingles, se renombran primero
do $$
begin
  -- books
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'title')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'titulo') then
    execute 'alter table public.books rename column title to titulo';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'author')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'autor') then
    execute 'alter table public.books rename column author to autor';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'cover')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'portada') then
    execute 'alter table public.books rename column cover to portada';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'synopsis')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'sinopsis') then
    execute 'alter table public.books rename column synopsis to sinopsis';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'condition')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'estado') then
    execute 'alter table public.books rename column condition to estado';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'owner_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'propietario_id') then
    execute 'alter table public.books rename column owner_id to propietario_id';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'owner_name')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'nombre_propietario') then
    execute 'alter table public.books rename column owner_name to nombre_propietario';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'owner_avatar')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'avatar_propietario') then
    execute 'alter table public.books rename column owner_avatar to avatar_propietario';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'owner_rating')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'valoracion_propietario') then
    execute 'alter table public.books rename column owner_rating to valoracion_propietario';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'owner_total_ratings')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'total_valoraciones_propietario') then
    execute 'alter table public.books rename column owner_total_ratings to total_valoraciones_propietario';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'location_lat')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'ubicacion_lat') then
    execute 'alter table public.books rename column location_lat to ubicacion_lat';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'location_lng')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'ubicacion_lng') then
    execute 'alter table public.books rename column location_lng to ubicacion_lng';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'created_at')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'creado_en') then
    execute 'alter table public.books rename column created_at to creado_en';
  end if;

  -- chats
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'book_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'libro_id') then
    execute 'alter table public.chats rename column book_id to libro_id';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'book_title')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'titulo_libro') then
    execute 'alter table public.chats rename column book_title to titulo_libro';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'book_cover')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'portada_libro') then
    execute 'alter table public.chats rename column book_cover to portada_libro';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'owner_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'propietario_id') then
    execute 'alter table public.chats rename column owner_id to propietario_id';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'owner_name')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'nombre_propietario') then
    execute 'alter table public.chats rename column owner_name to nombre_propietario';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'owner_avatar')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'avatar_propietario') then
    execute 'alter table public.chats rename column owner_avatar to avatar_propietario';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'requester_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'solicitante_id') then
    execute 'alter table public.chats rename column requester_id to solicitante_id';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'requester_name')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'nombre_solicitante') then
    execute 'alter table public.chats rename column requester_name to nombre_solicitante';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'requester_avatar')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'avatar_solicitante') then
    execute 'alter table public.chats rename column requester_avatar to avatar_solicitante';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'created_at')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'creado_en') then
    execute 'alter table public.chats rename column created_at to creado_en';
  end if;

  -- messages
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'chat_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'id_chat') then
    execute 'alter table public.messages rename column chat_id to id_chat';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'sender_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'remitente_id') then
    execute 'alter table public.messages rename column sender_id to remitente_id';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'sender_name')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'nombre_remitente') then
    execute 'alter table public.messages rename column sender_name to nombre_remitente';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'text')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'texto') then
    execute 'alter table public.messages rename column text to texto';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'image_url')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'imagen_url') then
    execute 'alter table public.messages rename column image_url to imagen_url';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'created_at')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'creado_en') then
    execute 'alter table public.messages rename column created_at to creado_en';
  end if;
end
$$;

-- Tabla de libros publicados
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text not null,
  portada text not null,
  sinopsis text not null,
  estado text not null,
  disponibilidad text not null default 'disponible' check (disponibilidad in ('disponible', 'reservado', 'intercambiado')),
  isbn text,
  propietario_id text not null,
  nombre_propietario text not null,
  avatar_propietario text not null,
  valoracion_propietario numeric(2,1) not null default 0,
  total_valoraciones_propietario integer not null default 0,
  ubicacion_lat double precision not null,
  ubicacion_lng double precision not null,
  creado_en timestamptz not null default now()
);

alter table public.books add column if not exists disponibilidad text not null default 'disponible';

create index if not exists books_creado_en_idx on public.books (creado_en desc);
create index if not exists books_propietario_id_idx on public.books (propietario_id);

alter table public.books enable row level security;

drop policy if exists "books_select_all" on public.books;
drop policy if exists "libros_lectura_publica" on public.books;
create policy "libros_lectura_publica"
on public.books
for select
using (true);

drop policy if exists "books_insert_authenticated" on public.books;
drop policy if exists "libros_insertar_autenticado" on public.books;
create policy "libros_insertar_autenticado"
on public.books
for insert
to authenticated
with check (propietario_id = auth.uid()::text);

drop policy if exists "libros_borrar_propietario" on public.books;
create policy "libros_borrar_propietario"
on public.books
for delete
to authenticated
using (propietario_id = auth.uid()::text);

drop policy if exists "libros_actualizar_propietario" on public.books;
create policy "libros_actualizar_propietario"
on public.books
for update
to authenticated
using (propietario_id = auth.uid()::text)
with check (propietario_id = auth.uid()::text);

-- Tabla de chats de intercambio
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  libro_id text not null,
  titulo_libro text not null,
  portada_libro text not null,
  propietario_id text not null,
  nombre_propietario text not null,
  avatar_propietario text not null,
  solicitante_id text not null,
  nombre_solicitante text not null,
  avatar_solicitante text not null,
  creado_en timestamptz not null default now()
);

create index if not exists chats_propietario_id_idx on public.chats (propietario_id);
create index if not exists chats_solicitante_id_idx on public.chats (solicitante_id);
create index if not exists chats_libro_id_idx on public.chats (libro_id);

alter table public.chats enable row level security;

drop policy if exists "chats_select_participants" on public.chats;
drop policy if exists "chats_lectura_participantes" on public.chats;
create policy "chats_lectura_participantes"
on public.chats
for select
to authenticated
using (auth.uid()::text = propietario_id or auth.uid()::text = solicitante_id);

drop policy if exists "chats_insert_requester" on public.chats;
drop policy if exists "chats_insertar_solicitante" on public.chats;
create policy "chats_insertar_solicitante"
on public.chats
for insert
to authenticated
with check (auth.uid()::text = solicitante_id);

drop policy if exists "chats_actualizar_propietario" on public.chats;
create policy "chats_actualizar_propietario"
on public.chats
for update
to authenticated
using (propietario_id = auth.uid()::text)
with check (propietario_id = auth.uid()::text);

drop policy if exists "chats_actualizar_solicitante" on public.chats;
create policy "chats_actualizar_solicitante"
on public.chats
for update
to authenticated
using (solicitante_id = auth.uid()::text)
with check (solicitante_id = auth.uid()::text);

drop policy if exists "chats_borrar_participantes" on public.chats;
create policy "chats_borrar_participantes"
on public.chats
for delete
to authenticated
using (propietario_id = auth.uid()::text or solicitante_id = auth.uid()::text);

-- Tabla de mensajes dentro de cada chat
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  id_chat uuid not null references public.chats(id) on delete cascade,
  remitente_id text not null,
  nombre_remitente text not null,
  texto text not null default '',
  imagen_url text,
  creado_en timestamptz not null default now()
);

alter table public.messages add column if not exists imagen_url text;
alter table public.messages alter column texto set default '';

create index if not exists messages_id_chat_idx on public.messages (id_chat);
create index if not exists messages_creado_en_idx on public.messages (creado_en desc);

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists "mensajes_lectura_participantes" on public.messages;
create policy "mensajes_lectura_participantes"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chats c
    where c.id = messages.id_chat
      and (c.propietario_id = auth.uid()::text or c.solicitante_id = auth.uid()::text)
  )
);

drop policy if exists "messages_insert_sender_participant" on public.messages;
drop policy if exists "mensajes_insertar_remitente_participante" on public.messages;
create policy "mensajes_insertar_remitente_participante"
on public.messages
for insert
to authenticated
with check (
  (coalesce(nullif(trim(texto), ''), '') <> '' or imagen_url is not null)
  and
  remitente_id = auth.uid()::text
  and exists (
    select 1
    from public.chats c
    where c.id = messages.id_chat
      and (c.propietario_id = auth.uid()::text or c.solicitante_id = auth.uid()::text)
  )
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ratings'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'valoraciones'
  ) then
    execute 'alter table public.ratings rename to valoraciones';
  end if;
end
$$;

-- Tabla de valoraciones entre usuarios
create table if not exists public.valoraciones (
  id uuid primary key default gen_random_uuid(),
  valorado_id text not null,
  valorador_id text not null,
  puntuacion smallint not null check (puntuacion between 1 and 5),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (valorador_id, valorado_id),
  check (valorado_id <> valorador_id)
);

create index if not exists valoraciones_valorado_id_idx on public.valoraciones (valorado_id);
create index if not exists valoraciones_valorador_id_idx on public.valoraciones (valorador_id);

alter table public.valoraciones enable row level security;

drop policy if exists "ratings_lectura_publica" on public.valoraciones;
drop policy if exists "valoraciones_lectura_publica" on public.valoraciones;
create policy "valoraciones_lectura_publica"
on public.valoraciones
for select
using (true);

drop policy if exists "ratings_insertar_valorador" on public.valoraciones;
drop policy if exists "valoraciones_insertar_valorador" on public.valoraciones;
create policy "valoraciones_insertar_valorador"
on public.valoraciones
for insert
to authenticated
with check (valorador_id = auth.uid()::text and valorado_id <> auth.uid()::text);

drop policy if exists "ratings_actualizar_valorador" on public.valoraciones;
drop policy if exists "valoraciones_actualizar_valorador" on public.valoraciones;
create policy "valoraciones_actualizar_valorador"
on public.valoraciones
for update
to authenticated
using (valorador_id = auth.uid()::text)
with check (valorador_id = auth.uid()::text and valorado_id <> auth.uid()::text);

create or replace function public.actualizar_timestamp_valoraciones()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trigger_ratings_actualizado_en on public.valoraciones;
drop trigger if exists trigger_valoraciones_actualizado_en on public.valoraciones;
create trigger trigger_valoraciones_actualizado_en
before update on public.valoraciones
for each row
execute procedure public.actualizar_timestamp_valoraciones();

-- Tabla de perfiles publicos
create table if not exists public.perfiles_publicos (
  usuario_id text primary key,
  nombre text not null,
  avatar_url text,
  ciudad text,
  sobre_usuario text,
  busca_libros text,
  ubicacion_lat double precision,
  ubicacion_lng double precision,
  actualizado_en timestamptz not null default now()
);

alter table public.perfiles_publicos add column if not exists sobre_usuario text;
alter table public.perfiles_publicos add column if not exists busca_libros text;

create index if not exists perfiles_publicos_actualizado_en_idx on public.perfiles_publicos (actualizado_en desc);

alter table public.perfiles_publicos enable row level security;

drop policy if exists "perfiles_publicos_lectura_publica" on public.perfiles_publicos;
create policy "perfiles_publicos_lectura_publica"
on public.perfiles_publicos
for select
using (true);

drop policy if exists "perfiles_publicos_insertar_propietario" on public.perfiles_publicos;
create policy "perfiles_publicos_insertar_propietario"
on public.perfiles_publicos
for insert
to authenticated
with check (usuario_id = auth.uid()::text);

drop policy if exists "perfiles_publicos_actualizar_propietario" on public.perfiles_publicos;
create policy "perfiles_publicos_actualizar_propietario"
on public.perfiles_publicos
for update
to authenticated
using (usuario_id = auth.uid()::text)
with check (usuario_id = auth.uid()::text);

create or replace function public.actualizar_timestamp_perfiles_publicos()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trigger_perfiles_publicos_actualizado_en on public.perfiles_publicos;
create trigger trigger_perfiles_publicos_actualizado_en
before update on public.perfiles_publicos
for each row
execute procedure public.actualizar_timestamp_perfiles_publicos();

-- Buckets para imagenes
insert into storage.buckets (id, name, public)
values ('book-images', 'book-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('imagenes-perfil', 'imagenes-perfil', true)
on conflict (id) do nothing;

drop policy if exists "book_images_public_read" on storage.objects;
create policy "book_images_public_read"
on storage.objects
for select
using (bucket_id = 'book-images');

drop policy if exists "book_images_auth_upload" on storage.objects;
create policy "book_images_auth_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "book_images_owner_delete" on storage.objects;
create policy "book_images_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read"
on storage.objects
for select
using (bucket_id = 'chat-images');

drop policy if exists "chat_images_auth_upload" on storage.objects;
create policy "chat_images_auth_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "chat_images_owner_delete" on storage.objects;
create policy "chat_images_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "profile_images_public_read" on storage.objects;
drop policy if exists "imagenes_perfil_lectura_publica" on storage.objects;
create policy "imagenes_perfil_lectura_publica"
on storage.objects
for select
using (bucket_id = 'imagenes-perfil');

drop policy if exists "profile_images_auth_upload" on storage.objects;
drop policy if exists "imagenes_perfil_subida_autenticado" on storage.objects;
create policy "imagenes_perfil_subida_autenticado"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'imagenes-perfil'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "profile_images_owner_delete" on storage.objects;
drop policy if exists "imagenes_perfil_borrado_propietario" on storage.objects;
create policy "imagenes_perfil_borrado_propietario"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'imagenes-perfil'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Elimina completamente la cuenta actual (datos y usuario de auth)
create or replace function public.eliminar_cuenta_actual()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  usuario_id uuid;
begin
  usuario_id := auth.uid();

  if usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  delete from public.messages
  where id_chat in (
    select id
    from public.chats
    where propietario_id = usuario_id::text
       or solicitante_id = usuario_id::text
  );

  delete from public.chats
  where propietario_id = usuario_id::text
     or solicitante_id = usuario_id::text;

  delete from public.books
  where propietario_id = usuario_id::text;

  delete from auth.users
  where id = usuario_id;
end;
$$;

revoke all on function public.eliminar_cuenta_actual() from public;
grant execute on function public.eliminar_cuenta_actual() to authenticated;

-- Migra datos legacy con id "current-user" al usuario autenticado actual
create or replace function public.adoptar_datos_legacy_usuario_actual()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  usuario_id uuid;
  nombre_perfil text;
  nombre_email text;
begin
  usuario_id := auth.uid();

  if usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  nombre_perfil := lower(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', '')));
  nombre_email := lower(trim(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)));

  update public.books
  set propietario_id = usuario_id::text
  where propietario_id = 'current-user'
    and (
      lower(trim(nombre_propietario)) = nombre_perfil
      or lower(trim(nombre_propietario)) = nombre_email
    );

  update public.chats
  set propietario_id = usuario_id::text
  where propietario_id = 'current-user'
    and (
      lower(trim(nombre_propietario)) = nombre_perfil
      or lower(trim(nombre_propietario)) = nombre_email
    );

  update public.chats
  set solicitante_id = usuario_id::text
  where solicitante_id = 'current-user'
    and (
      lower(trim(nombre_solicitante)) = nombre_perfil
      or lower(trim(nombre_solicitante)) = nombre_email
    );

  update public.messages
  set remitente_id = usuario_id::text
  where remitente_id = 'current-user'
    and (
      lower(trim(nombre_remitente)) = nombre_perfil
      or lower(trim(nombre_remitente)) = nombre_email
    );

  insert into public.perfiles_publicos (usuario_id, nombre, avatar_url, ciudad, sobre_usuario, busca_libros, ubicacion_lat, ubicacion_lng)
  select
    usuario_id::text,
    p.nombre,
    p.avatar_url,
    p.ciudad,
    p.sobre_usuario,
    p.busca_libros,
    p.ubicacion_lat,
    p.ubicacion_lng
  from public.perfiles_publicos p
  where p.usuario_id = 'current-user'
    and (
      lower(trim(p.nombre)) = nombre_perfil
      or lower(trim(p.nombre)) = nombre_email
    )
  on conflict (usuario_id) do update
    set nombre = excluded.nombre,
        avatar_url = excluded.avatar_url,
        ciudad = excluded.ciudad,
        sobre_usuario = excluded.sobre_usuario,
        busca_libros = excluded.busca_libros,
        ubicacion_lat = excluded.ubicacion_lat,
        ubicacion_lng = excluded.ubicacion_lng,
        actualizado_en = now();

  delete from public.perfiles_publicos p
  where p.usuario_id = 'current-user'
    and (
      lower(trim(p.nombre)) = nombre_perfil
      or lower(trim(p.nombre)) = nombre_email
    );
end;
$$;

revoke all on function public.adoptar_datos_legacy_usuario_actual() from public;
grant execute on function public.adoptar_datos_legacy_usuario_actual() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
