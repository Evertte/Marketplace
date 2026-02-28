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

alter table public."ConversationReadState" enable row level security;

drop policy if exists "ConversationReadState select own participant row" on public."ConversationReadState";
create policy "ConversationReadState select own participant row"
on public."ConversationReadState"
for select
to authenticated
using (
  "userId" = public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "ConversationReadState"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
);

drop policy if exists "ConversationReadState insert own participant row" on public."ConversationReadState";
create policy "ConversationReadState insert own participant row"
on public."ConversationReadState"
for insert
to authenticated
with check (
  "userId" = public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "ConversationReadState"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
);

drop policy if exists "ConversationReadState update own participant row" on public."ConversationReadState";
create policy "ConversationReadState update own participant row"
on public."ConversationReadState"
for update
to authenticated
using (
  "userId" = public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "ConversationReadState"."conversationId"
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
    where c.id = "ConversationReadState"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
);
