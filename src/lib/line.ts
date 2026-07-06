import { messagingApi } from "@line/bot-sdk";
import { ROOM_NAME, TIMEZONE } from "@/lib/booking-rules";

type NotifiableBooking = {
  title: string;
  startTime: Date;
  endTime: Date;
  user: { lineUserId: string };
};

function getClient(): messagingApi.MessagingApiClient | null {
  const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return null;
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}

function formatRange(startTime: Date, endTime: Date): string {
  const dateFmt = new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateFmt.format(startTime)} เวลา ${timeFmt.format(startTime)}-${timeFmt.format(endTime)}`;
}

async function push(to: string, text: string): Promise<void> {
  const client = getClient();
  if (!client) {
    // No Messaging API channel configured yet (e.g. local dev) — skip silently.
    return;
  }
  await client.pushMessage({ to, messages: [{ type: "text", text }] });
}

export async function notifyBookingCreated(
  booking: NotifiableBooking,
): Promise<void> {
  await push(
    booking.user.lineUserId,
    `จองสำเร็จ: ${ROOM_NAME}\nหัวข้อ: ${booking.title}\n${formatRange(booking.startTime, booking.endTime)}`,
  );
}

export async function notifyBookingCancelled(
  booking: NotifiableBooking,
): Promise<void> {
  await push(
    booking.user.lineUserId,
    `ยกเลิกการจอง: ${ROOM_NAME}\nหัวข้อ: ${booking.title}\n${formatRange(booking.startTime, booking.endTime)}`,
  );
}

export async function notifyBookingReminder(
  booking: NotifiableBooking,
): Promise<void> {
  await push(
    booking.user.lineUserId,
    `แจ้งเตือน: อีกไม่นานถึงเวลาประชุมที่ ${ROOM_NAME}\nหัวข้อ: ${booking.title}\n${formatRange(booking.startTime, booking.endTime)}`,
  );
}
