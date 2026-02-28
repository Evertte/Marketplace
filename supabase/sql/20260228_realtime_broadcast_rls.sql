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

alter table realtime.messages enable row level security;

drop policy if exists "Authenticated users can receive conversation broadcasts" on realtime.messages;
create policy "Authenticated users can receive conversation broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() ~ '^conversation:[0-9a-fA-F-]{36}$'
  and exists (
    select 1
    from public."Conversation" c
    where
      c.id = replace(realtime.topic(), 'conversation:', '')::uuid
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
);

-- Broadcast sends are performed by the server with the service-role key.
-- No client-side insert policy is required for this V2.1 setup.
