alter table public.admin_audit_events
drop constraint if exists admin_audit_events_target_type_check;

alter table public.admin_audit_events
add constraint admin_audit_events_target_type_check
check (target_type in ('verification_request', 'trainer', 'profile', 'ticket'));
