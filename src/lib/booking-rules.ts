import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

export const TIMEZONE = "Asia/Bangkok";

// The room is physically in Bangkok, so all wall-clock math below anchors
// to Bangkok explicitly via `.tz(TIMEZONE)` on each call. We deliberately do
// NOT call dayjs.tz.setDefault() — a global default leaks into the client
// bundle and breaks react-big-calendar's rendering (see the wall-clock
// conversion in src/components/booking-calendar.tsx for why).
dayjs.extend(utc);
dayjs.extend(timezone);

export const ROOM_NAME = "ห้องประชุม 205";
export const BUSINESS_HOUR_START = 6;
export const BUSINESS_HOUR_END = 23;
export const MAX_DURATION_HOURS = 4;
export const MIN_LEAD_TIME_MINUTES = 15;

export function validateBookingWindow(
  startTime: Date,
  endTime: Date,
): string | null {
  if (endTime.getTime() <= startTime.getTime()) {
    return "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }

  const durationHours =
    (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  if (durationHours > MAX_DURATION_HOURS) {
    return `จองได้ไม่เกินครั้งละ ${MAX_DURATION_HOURS} ชั่วโมง`;
  }

  if (dayjs(startTime).isBefore(dayjs().add(MIN_LEAD_TIME_MINUTES, "minute"))) {
    return `ต้องจองล่วงหน้าอย่างน้อย ${MIN_LEAD_TIME_MINUTES} นาที`;
  }

  const localStart = dayjs(startTime).tz(TIMEZONE);
  const localEnd = dayjs(endTime).tz(TIMEZONE);

  if (!localStart.isSame(localEnd, "day")) {
    return "การจองต้องเริ่มและจบภายในวันเดียวกัน";
  }

  const endsAfterHours =
    localEnd.hour() > BUSINESS_HOUR_END ||
    (localEnd.hour() === BUSINESS_HOUR_END && localEnd.minute() > 0);

  if (localStart.hour() < BUSINESS_HOUR_START || endsAfterHours) {
    return `จองได้เฉพาะเวลาทำการ ${BUSINESS_HOUR_START}:00-${BUSINESS_HOUR_END}:00`;
  }

  return null;
}

export function isBookingOverlapError(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } } | null)?.cause;
  return cause?.code === "23P01";
}
