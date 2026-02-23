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
