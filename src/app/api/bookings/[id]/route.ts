import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/schemas";
import { isBookingOverlapError, validateBookingWindow } from "@/lib/booking-rules";
import { notifyBookingCancelled } from "@/lib/line";
import { notifyStaffBookingCancelled } from "@/lib/mail";

const OVERLAP_MESSAGE = "ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing || existing.status === "CANCELLED") {
    return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
  }
  if (existing.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขการจองนี้" }, { status: 403 });
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

  const overlapping = await prisma.booking.findFirst({
    where: {
      id: { not: id },
      status: "CONFIRMED",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlapping) {
    return NextResponse.json({ error: OVERLAP_MESSAGE }, { status: 409 });
  }

  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: { title: parsed.data.title, startTime, endTime },
      include: { user: { select: { id: true, displayName: true } } },
    });
    return NextResponse.json(booking);
  } catch (err) {
    if (isBookingOverlapError(err)) {
      return NextResponse.json({ error: OVERLAP_MESSAGE }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing || existing.status === "CANCELLED") {
    return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
  }
  if (existing.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ยกเลิกการจองนี้" }, { status: 403 });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: session.user.id,
    },
    include: { user: { select: { id: true, displayName: true, lineUserId: true } } },
  });

  await notifyBookingCancelled(booking);
  await notifyStaffBookingCancelled(booking);

  return NextResponse.json(booking);
}
