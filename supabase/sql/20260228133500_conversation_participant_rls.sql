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

alter table public."ConversationParticipant" enable row level security;

drop policy if exists "ConversationParticipant select own row" on public."ConversationParticipant";
create policy "ConversationParticipant select own row"
on public."ConversationParticipant"
for select
to authenticated
using (
  "userId" = public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "ConversationParticipant"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
);

drop policy if exists "ConversationParticipant update own row" on public."ConversationParticipant";
create policy "ConversationParticipant update own row"
on public."ConversationParticipant"
for update
to authenticated
using (
  "userId" = public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "ConversationParticipant"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
)
with check (
  "userId" = public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "ConversationParticipant"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
);

-- Conversation participants are created by server-side code using the service role.
