-- Script de correção para whatsapp_instances RLS
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
