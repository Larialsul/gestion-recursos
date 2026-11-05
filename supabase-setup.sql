-- SCP Base Manager: configuración inicial de Supabase
-- 1) Cambia el código de acceso en la línea INSERT antes de ejecutar.
-- 2) Ejecuta TODO este script en Supabase > SQL Editor > New query.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.scp_base_state (
  id integer primary key check (id = 1),
  state jsonb not null,
  access_code_hash text not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

revoke all on table public.scp_base_state from anon, authenticated;

-- Estado inicial migrado desde data/base.js. Cambia MI-CODIGO-SEGURO por el código que compartirás.
insert into public.scp_base_state (id, state, access_code_hash, revision)
values (1, '{"semana":1,"dia":8,"habitantes":19,"resources":{"comida":110,"agua":19,"lujos":5,"defensa":2,"salubridad":2,"energia":0,"moral":0},"production":{"comida":10},"consumption":{"comida":3,"agua":8,"lujos":1},"salas":[{"id":1786126300607,"nombre":"Test","descripcion":"","activa":true,"recurso":"comida","cantidad":10,"gasto":"agua","cantidadConsumo":5}],"personajes":[{"id":1786126324902,"nombre":"Sara","ocupacion":"Tecnica","descripcion":"","estado":"expedicion","recurso":"comida","cantidad":10,"gasto":"lujos"},{"id":1786126864054,"nombre":"Pepe","ocupacion":"","descripcion":"","estado":"expedicion","gasto":"","recurso":"","cantidad":0},{"id":1786147470369,"nombre":"Jhon","ocupacion":"","descripcion":"","estado":"expedicion","gasto":"","recurso":"","cantidadProduccion":0,"cantidadConsumo":0}],"facciones":[{"id":1786128520308,"nombre":"Test","lider":"Pro","relacion":2,"descripcion":"","notasJugadores":""},{"id":1786129370636,"nombre":"Nueva facción","lider":"","relacion":4,"descripcion":"","notasJugadores":""}],"expediciones":[{"id":1786135073373,"nombre":"Nueva expedición","duracion":7,"diasRestantes":6,"personajes":[1786126324902,1786126864054],"completada":false,"bloqueada":true},{"id":1786148154088,"nombre":"Nueva expedición","duracion":10,"diasRestantes":9,"personajes":[1786147470369],"bloqueada":true,"completada":false}],"inventario":"Test"}'::jsonb, extensions.crypt('MI-CODIGO-SEGURO', extensions.gen_salt('bf')), 1)
on conflict (id) do nothing;

create or replace function public.scp_get_state(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare result jsonb;
begin
  select jsonb_build_object('state', state, 'revision', revision)
    into result
  from public.scp_base_state
  where id = 1 and access_code_hash = extensions.crypt(coalesce(p_code, ''), access_code_hash);
  if result is null then
    raise exception 'Código de acceso incorrecto';
  end if;
  return result;
end;
$$;

create or replace function public.scp_save_state(p_code text, p_state jsonb, p_expected_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare updated_row public.scp_base_state%rowtype;
begin
  update public.scp_base_state
     set state = p_state,
         revision = revision + 1,
         updated_at = now()
   where id = 1
     and access_code_hash = extensions.crypt(coalesce(p_code, ''), access_code_hash)
     and revision = p_expected_revision
   returning * into updated_row;

  if not found then
    if exists (select 1 from public.scp_base_state where id = 1
      and access_code_hash = extensions.crypt(coalesce(p_code, ''), access_code_hash)) then
      raise exception 'CONFLICT: La base ha cambiado desde que la cargaste. Recarga antes de guardar.';
    end if;
    raise exception 'Código de acceso incorrecto';
  end if;

  return jsonb_build_object('state', updated_row.state, 'revision', updated_row.revision);
end;
$$;

revoke all on function public.scp_get_state(text) from public;
revoke all on function public.scp_save_state(text, jsonb, bigint) from public;
grant execute on function public.scp_get_state(text) to anon, authenticated;
grant execute on function public.scp_save_state(text, jsonb, bigint) to anon, authenticated;
