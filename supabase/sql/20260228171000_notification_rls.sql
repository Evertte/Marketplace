create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select id
  from public."User"
  where "authUserId" = auth.uid()
  limit 1
$$;

alter table public."Notification" enable row level security;

drop policy if exists "Notification select own rows" on public."Notification";
create policy "Notification select own rows"
on public."Notification"
for select
to authenticated
using (
  "userId" = public.current_user_id()
);

drop policy if exists "Notification update own rows" on public."Notification";
create policy "Notification update own rows"
on public."Notification"
for update
to authenticated
using (
  "userId" = public.current_user_id()
)
with check (
  "userId" = public.current_user_id()
);

-- Notification rows are inserted by server-side code using the service role.

drop policy if exists "Notifications realtime select own topic" on realtime.messages;
create policy "Notifications realtime select own topic"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'user-' || public.current_user_id()::text
);
