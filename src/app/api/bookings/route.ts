import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/schemas";
import { isBookingOverlapError, validateBookingWindow } from "@/lib/booking-rules";
import { notifyBookingCreated } from "@/lib/line";

const OVERLAP_MESSAGE = "ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      ...(from && to
        ? { startTime: { lt: new Date(to) }, endTime: { gt: new Date(from) } }
        : {}),
    },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(bookings);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);

  const windowError = validateBookingWindow(startTime, endTime);
  if (windowError) {
    return NextResponse.json({ error: windowError }, { status: 400 });
  }

  // Friendly pre-check for the common case. Two concurrent requests can both
  // pass this and still collide — the DB exclude constraint below is what
  // actually guarantees no double-booking.
  const overlapping = await prisma.booking.findFirst({
    where: {
      status: "CONFIRMED",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlapping) {
    return NextResponse.json({ error: OVERLAP_MESSAGE }, { status: 409 });
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        title: parsed.data.title,
        startTime,
        endTime,
        userId: session.user.id,
      },
      include: { user: { select: { id: true, displayName: true, lineUserId: true } } },
    });

    await notifyBookingCreated(booking);

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (isBookingOverlapError(err)) {
      return NextResponse.json({ error: OVERLAP_MESSAGE }, { status: 409 });
    }
    throw err;
  }
}
