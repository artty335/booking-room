import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { notifyBookingReminder } from "@/lib/line";
import { TIMEZONE } from "@/lib/booking-rules";

// Triggered once a day (see vercel.json) — sends a reminder for every
// CONFIRMED booking scheduled "today" in Asia/Bangkok that hasn't been
// reminded yet. Vercel's Hobby plan only allows daily cron invocations,
// so a same-day reminder (rather than an N-minutes-before one) is what's
// actually achievable without a paid plan or a separate queue.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const todayStart = dayjs().tz(TIMEZONE).startOf("day").toDate();
  const todayEnd = dayjs().tz(TIMEZONE).endOf("day").toDate();

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startTime: { gte: todayStart, lte: todayEnd },
    },
    include: { user: { select: { lineUserId: true } } },
  });

  for (const booking of bookings) {
    await notifyBookingReminder(booking);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return NextResponse.json({ remindersSent: bookings.length });
}
