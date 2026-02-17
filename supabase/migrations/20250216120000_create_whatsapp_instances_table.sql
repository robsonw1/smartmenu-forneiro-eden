-- Criar tabela whatsapp_instances para gerenciar instâncias de WhatsApp
create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  establishment_name text not null,
  evolution_instance_name text not null unique,
  is_connected boolean default false,
  qr_code_url text,
  last_connection_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Adicionar índices
create index if not exists idx_whatsapp_instances_tenant_id on public.whatsapp_instances(tenant_id);
create index if not exists idx_whatsapp_instances_evolution_instance_name on public.whatsapp_instances(evolution_instance_name);

-- RLS
alter table public.whatsapp_instances enable row level security;

drop policy if exists "Users can view their tenant's instances" on public.whatsapp_instances;
drop policy if exists "Users can insert instances for their tenant" on public.whatsapp_instances;
drop policy if exists "Users can update their tenant's instances" on public.whatsapp_instances;
drop policy if exists "Users can delete their tenant's instances" on public.whatsapp_instances;

create policy "Users can view their tenant's instances" on public.whatsapp_instances
  for select using (
    exists (select 1 from public.tenants where tenants.id = whatsapp_instances.tenant_id)
  );

create policy "Users can insert instances for their tenant" on public.whatsapp_instances
  for insert with check (
    exists (select 1 from public.tenants where tenants.id = whatsapp_instances.tenant_id)
  );

create policy "Users can update their tenant's instances" on public.whatsapp_instances
  for update using (
    exists (select 1 from public.tenants where tenants.id = whatsapp_instances.tenant_id)
  ) with check (
    exists (select 1 from public.tenants where tenants.id = whatsapp_instances.tenant_id)
  );

create policy "Users can delete their tenant's instances" on public.whatsapp_instances
  for delete using (
    exists (select 1 from public.tenants where tenants.id = whatsapp_instances.tenant_id)
  );

-- Atualizar coluna evolution_instance_name na tabela tenants se ainda não existe
alter table public.tenants 
add column if not exists evolution_instance_name text;

-- Garantir que o trigger de updated_at funciona
drop trigger if exists whatsapp_instances_updated_at on public.whatsapp_instances;

create or replace function update_whatsapp_instances_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger whatsapp_instances_updated_at before update on public.whatsapp_instances
for each row execute function update_whatsapp_instances_updated_at();
