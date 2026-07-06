# ระบบจองห้องประชุม 205

Next.js app สำหรับจองห้องประชุม 205 ห้องเดียว, login ด้วย LINE Login, กันเวลาจองซ้ำที่ระดับฐานข้อมูล, และแจ้งเตือนผ่าน LINE Messaging API

## Stack

- Next.js (App Router) + Tailwind CSS
- PostgreSQL + Prisma (Postgres `EXCLUDE` constraint กันจองซ้ำ)
- next-auth v5 + LINE Login provider
- `@line/bot-sdk` สำหรับ push message แจ้งเตือน
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

## Deploy

Deploy บน [Vercel](https://vercel.com/new) ต่อกับ managed Postgres (เช่น Supabase, Neon) แล้วตั้งค่า environment variables ให้ตรงกับ `.env.example`
# booking-room
