```bash
npm install
npx prisma generate
npm run dev
curl -H "Authorization: Bearer <SUPABASE_JWT>" http://localhost:3000/api/v1/me
```

```bash
curl -X POST http://localhost:3000/api/v1/media/presign -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" -d '{"purpose":"listing","kind":"image","filename":"photo.jpg","mime":"image/jpeg","size_bytes":12345}'
curl -X PUT "<SIGNED_UPLOAD_URL_FROM_PRESIGN>" -H "Content-Type: image/jpeg" --data-binary @./photo.jpg
curl -X POST http://localhost:3000/api/v1/media/confirm -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" -d '{"media_id":"<MEDIA_ID>"}'
curl -X POST http://localhost:3000/api/v1/admin/listings/<LISTING_ID>/media -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" -d '{"media_id":"<MEDIA_ID>","sort_order":1}'
```

```bash
npm install
npx prisma generate
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> npm run dev
curl -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" http://localhost:3000/api/v1/admin/listings?limit=5
```

Run `classifieds-api/supabase/sql/20260228_realtime_broadcast_rls.sql` in the Supabase SQL Editor before testing realtime chat.
Run `classifieds-api/supabase/sql/20260228121000_conversation_read_state_rls.sql` in the Supabase SQL Editor after applying the Prisma migration for read receipts.

Read-receipt deploy commands:
```bash
DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
npx prisma migrate deploy
npx prisma generate
npm run build
```

Manual realtime test:
1. Sign in as a buyer in one browser and as the admin in a second browser.
2. Create or open a conversation so both users can load `/messages/<conversationId>`.
3. Send a message from one browser and verify the other browser updates immediately without waiting for a poll.
4. Use the thread refresh button if the realtime status badge shows disconnected.

Manual read-receipt test:
1. Sign in as a buyer in one browser and as the admin in a second browser.
2. Buyer sends a message and confirms the seller receives it instantly.
3. Seller opens the conversation page and keeps it visible.
4. Buyer sees `Seen` under the buyer's last outgoing message after the `read-updated` broadcast arrives.
5. Confirm a non-participant token gets `403` from `POST /api/v1/conversations/<id>/read`.
