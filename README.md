# ระบบจองห้องประชุม 205

Next.js app สำหรับจองห้องประชุม 205 ห้องเดียว, login ด้วย LINE Login, กันเวลาจองซ้ำที่ระดับฐานข้อมูล, และแจ้งเตือนผ่าน LINE Messaging API

## Stack

- Next.js (App Router) + Tailwind CSS
- PostgreSQL + Prisma (Postgres `EXCLUDE` constraint กันจองซ้ำ)
- next-auth v5 + LINE Login provider
- `@line/bot-sdk` สำหรับ push message แจ้งเตือน
- `resend` สำหรับส่งอีเมลแจ้งเตือนเจ้าหน้าที่
- `react-big-calendar` สำหรับ UI ปฏิทิน

## Setup

1. ติดตั้ง dependencies

   ```bash
   npm install
   ```

2. เตรียม PostgreSQL แล้วตั้งค่า `.env` (คัดลอกจาก `.env.example`)

   ```bash
   cp .env.example .env
   ```

3. สร้าง LINE Login channel ที่ [LINE Developers Console](https://developers.line.biz/console/)
   - เปิดใช้งาน "Web app" ภายใต้ LINE Login
   - ตั้ง Callback URL เป็น `<NEXTAUTH_URL>/api/auth/callback/line`
   - นำ Channel ID / Channel secret มาใส่ใน `LINE_LOGIN_CLIENT_ID` / `LINE_LOGIN_CLIENT_SECRET`

4. สร้าง LINE Messaging API channel แยกต่างหาก (คนละ channel กับ LINE Login) เพื่อใช้ push แจ้งเตือน แล้วนำ Channel access token มาใส่ใน `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`

5. สร้าง `NEXTAUTH_SECRET` (`openssl rand -base64 32`) และ `CRON_SECRET` (ค่าสุ่มอะไรก็ได้)

   (ไม่บังคับ) ถ้าต้องการส่งอีเมลแจ้งเจ้าหน้าที่ ให้สมัคร [Resend](https://resend.com/) นำ API key มาใส่ `RESEND_API_KEY`, ตั้ง `MAIL_FROM` เป็นที่อยู่บนโดเมนที่ verify แล้ว และใส่รายชื่ออีเมลเจ้าหน้าที่ (คั่นด้วย comma) ใน `STAFF_EMAILS` — ถ้าเว้นว่างไว้ ระบบจะข้ามการส่งเมลเงียบ ๆ

6. รัน migration

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

7. เริ่ม dev server

   ```bash
   npm run dev
   ```

   เปิด [http://localhost:3000](http://localhost:3000)

## การกันจองซ้ำ (double-booking)

การตรวจสอบเวลาซ้อนทับทำสองชั้น:

1. **App-level** (`src/lib/booking-rules.ts`, ใช้ใน `src/app/api/bookings/`): เช็คก่อน insert เพื่อ return error ที่อ่านง่าย
2. **DB-level** (ดู `prisma/migrations/*_init/migration.sql`): Postgres `EXCLUDE USING gist` constraint บนช่วงเวลาเป็น safety net จริงเวลามี concurrent request ชนกัน — ชั้นนี้เท่านั้นที่รับประกันได้ 100%

## Cron แจ้งเตือน

`vercel.json` ตั้ง cron ให้ยิง `/api/cron/reminders` ทุกวันเวลา 07:00 (Asia/Bangkok) เพื่อแจ้งเตือนผู้จองที่มีประชุมในวันนั้น (Vercel Hobby plan อนุญาต cron แบบรายวันเท่านั้น จึงเลือกดีไซน์แบบ "เตือนตอนเช้าของวันที่มีนัด" แทนแบบเตือนก่อนเวลาไม่กี่นาที)

## แจ้งเตือนเจ้าหน้าที่ทางอีเมล

เมื่อมีการ **จอง** หรือ **ยกเลิกการจอง** ระบบจะส่งอีเมลไปยังเจ้าหน้าที่ทุกคนใน `STAFF_EMAILS` ผ่าน Resend (ดู `src/lib/mail.ts`) การส่งเมลเป็นแบบ best-effort — ถ้ายังไม่ได้ตั้งค่า env หรือผู้ให้บริการเมล error จะไม่ทำให้การจอง/ยกเลิกล้มเหลว

## Deploy (Vercel + Neon)

ระบบกันจองซ้ำด้วย Postgres `EXCLUDE USING gist` + extension `btree_gist` จึง**ต้องใช้ PostgreSQL จริง** ที่รัน `CREATE EXTENSION btree_gist` ได้ (Neon/Supabase/Vercel Postgres ใช้ได้; SQLite/MySQL/PlanetScale ใช้ไม่ได้)

1. สร้าง Postgres project บน [Neon](https://neon.tech/) (หรือกดเชื่อมจาก Vercel Marketplace)

2. ตั้ง environment variables บน Vercel ให้ครบตาม `.env.example` โดยเฉพาะเรื่อง connection:
   - `DATABASE_URL` → **pooled** endpoint (host ลงท้าย `-pooler`) — แอปรันบน serverless ต้องใช้ตัวนี้กัน connection เต็ม
   - `DIRECT_URL` → **direct** endpoint — ใช้ตอน migrate เท่านั้น

   ที่เหลือ: `NEXTAUTH_URL` (โดเมนจริง), `NEXTAUTH_SECRET`, `LINE_*`, `CRON_SECRET` และ (ถ้าใช้เมล) `RESEND_API_KEY`, `MAIL_FROM`, `STAFF_EMAILS`

3. รัน migration เข้าฐานข้อมูล (ยิงผ่าน direct endpoint อัตโนมัติผ่าน `prisma.config.ts`):

   ```bash
   npx prisma migrate deploy
   ```

4. Deploy — build script (`prisma generate && next build`) จะ generate Prisma client ให้เองตอน build

> connection pooling เป็นแค่การตั้งค่า connection string — โค้ด runtime (`src/lib/prisma.ts`) ใช้ `DATABASE_URL` ตามปกติ ส่วน migration/CLI (`prisma.config.ts`) จะเลือก `DIRECT_URL` ก่อนถ้ามี
# booking-room
