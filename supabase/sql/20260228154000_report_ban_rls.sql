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

alter table public."Report" enable row level security;
alter table public."Ban" enable row level security;

drop policy if exists "Report select own reports" on public."Report";
create policy "Report select own reports"
on public."Report"
for select
to authenticated
using (
  "reporterUserId" = public.current_user_id()
);

drop policy if exists "Report insert own reports" on public."Report";
create policy "Report insert own reports"
on public."Report"
for insert
to authenticated
with check (
  "reporterUserId" = public.current_user_id()
  and "reportedUserId" <> public.current_user_id()
  and exists (
    select 1
    from public."Conversation" c
    where c.id = "Report"."conversationId"
      and (
        c."buyerUserId" = public.current_user_id()
        or c."sellerUserId" = public.current_user_id()
      )
  )
  and (
    "messageId" is null or exists (
      select 1
      from public."Message" m
      where m.id = "Report"."messageId"
        and m."conversationId" = "Report"."conversationId"
    )
  )
);

-- Ban rows are managed by server-side admin actions / service role only.
-- No authenticated client policies are granted here.
