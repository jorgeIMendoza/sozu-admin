create or replace function public.validar_mensajes_whatsapp(_mensajes jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  total_count integer;
  distinct_count integer;
begin
  if _mensajes is null then
    return true;
  end if;

  if jsonb_typeof(_mensajes) <> 'array' then
    return false;
  end if;

  total_count := jsonb_array_length(_mensajes);
  if total_count <> 3 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(_mensajes) as item(value)
    where btrim(value) = ''
  ) then
    return false;
  end if;

  select count(distinct lower(btrim(value)))
  into distinct_count
  from jsonb_array_elements_text(_mensajes) as item(value);

  return distinct_count = 3;
end;
$$;

alter table public.avisos
add column if not exists mensajes_whatsapp jsonb;

alter table public.avisos
alter column mensajes_whatsapp drop default;

alter table public.avisos
drop constraint if exists avisos_mensajes_whatsapp_validos_chk;

alter table public.avisos
add constraint avisos_mensajes_whatsapp_validos_chk
check (public.validar_mensajes_whatsapp(mensajes_whatsapp));

create table if not exists public.avisos_proyectos (
  id bigserial primary key,
  id_aviso integer not null references public.avisos(id) on delete cascade,
  id_proyecto integer not null references public.proyectos(id) on delete cascade,
  activo boolean not null default true,
  fecha_creacion timestamp with time zone not null default now(),
  fecha_actualizacion timestamp with time zone not null default now(),
  unique (id_aviso, id_proyecto)
);

create index if not exists idx_avisos_proyectos_aviso on public.avisos_proyectos(id_aviso);
create index if not exists idx_avisos_proyectos_proyecto on public.avisos_proyectos(id_proyecto);
create index if not exists idx_avisos_proyectos_activo on public.avisos_proyectos(activo);

alter table public.avisos_proyectos enable row level security;

drop policy if exists "Admins cobranza pueden ver avisos proyectos" on public.avisos_proyectos;
create policy "Admins cobranza pueden ver avisos proyectos"
on public.avisos_proyectos
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.usuarios u
    where lower(trim(u.email)) = lower(trim(auth.email()))
      and u.activo = true
      and u.rol_id = 2
  )
);

drop policy if exists "Admins cobranza pueden crear avisos proyectos" on public.avisos_proyectos;
create policy "Admins cobranza pueden crear avisos proyectos"
on public.avisos_proyectos
for insert
to authenticated
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.usuarios u
    where lower(trim(u.email)) = lower(trim(auth.email()))
      and u.activo = true
      and u.rol_id = 2
  )
);

drop policy if exists "Admins cobranza pueden editar avisos proyectos" on public.avisos_proyectos;
create policy "Admins cobranza pueden editar avisos proyectos"
on public.avisos_proyectos
for update
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.usuarios u
    where lower(trim(u.email)) = lower(trim(auth.email()))
      and u.activo = true
      and u.rol_id = 2
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.usuarios u
    where lower(trim(u.email)) = lower(trim(auth.email()))
      and u.activo = true
      and u.rol_id = 2
  )
);

drop policy if exists "Admins cobranza pueden eliminar avisos proyectos" on public.avisos_proyectos;
create policy "Admins cobranza pueden eliminar avisos proyectos"
on public.avisos_proyectos
for delete
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.usuarios u
    where lower(trim(u.email)) = lower(trim(auth.email()))
      and u.activo = true
      and u.rol_id = 2
  )
);

create or replace function public.set_avisos_proyectos_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists update_avisos_proyectos_updated_at on public.avisos_proyectos;
create trigger update_avisos_proyectos_updated_at
before update on public.avisos_proyectos
for each row
execute function public.set_avisos_proyectos_updated_at();