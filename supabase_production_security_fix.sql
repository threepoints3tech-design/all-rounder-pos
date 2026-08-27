-- Apply once when supabase_production_migration.sql was run before commit
-- 1d209ae. This removes PostgreSQL's default PUBLIC EXECUTE grants from POS
-- security-definer functions without changing existing application data.

begin;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_tenant() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.tenant_subscription_is_active(uuid) from public;
revoke all on function public.current_user_tenant_id() from public;
revoke all on function public.is_active_tenant_member(uuid) from public;
revoke all on function public.is_active_tenant_owner(uuid) from public;
revoke all on function public.get_pos_settings() from public;
revoke all on function public.write_audit_log(uuid, text, text, text, jsonb) from public;
revoke all on function public.create_staff_invite(text) from public;
revoke all on function public.deactivate_staff(uuid) from public;
revoke all on function public.complete_sale(jsonb, text, numeric) from public;
revoke all on function public.refund_sale(text) from public;
revoke all on function public.adjust_product_stock(text, integer, text) from public;

revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_tenant() from anon;
revoke all on function public.is_super_admin() from anon;
revoke all on function public.tenant_subscription_is_active(uuid) from anon;
revoke all on function public.current_user_tenant_id() from anon;
revoke all on function public.is_active_tenant_member(uuid) from anon;
revoke all on function public.is_active_tenant_owner(uuid) from anon;
revoke all on function public.get_pos_settings() from anon;
revoke all on function public.write_audit_log(uuid, text, text, text, jsonb) from anon;
revoke all on function public.create_staff_invite(text) from anon;
revoke all on function public.deactivate_staff(uuid) from anon;
revoke all on function public.complete_sale(jsonb, text, numeric) from anon;
revoke all on function public.refund_sale(text) from anon;
revoke all on function public.adjust_product_stock(text, integer, text) from anon;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.tenant_subscription_is_active(uuid) to authenticated;
grant execute on function public.current_user_tenant_id() to authenticated;
grant execute on function public.is_active_tenant_member(uuid) to authenticated;
grant execute on function public.is_active_tenant_owner(uuid) to authenticated;
grant execute on function public.get_pos_settings() to authenticated;
grant execute on function public.create_staff_invite(text) to authenticated;
grant execute on function public.deactivate_staff(uuid) to authenticated;
grant execute on function public.complete_sale(jsonb, text, numeric) to authenticated;
grant execute on function public.refund_sale(text) to authenticated;
grant execute on function public.adjust_product_stock(text, integer, text) to authenticated;

commit;
