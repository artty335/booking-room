import { Resend } from "resend";
import { ROOM_NAME, TIMEZONE } from "@/lib/booking-rules";

type NotifiableBooking = {
  title: string;
  startTime: Date;
  endTime: Date;
  user: { displayName: string };
};

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getStaffEmails(): string[] {
  return (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

// The logo (public/205.png) is served publicly — proxy.ts excludes static
// assets from the auth guard — so email clients can fetch it by absolute URL.
// MAIL_LOGO_URL wins if set; otherwise derive it from the app origin.
function getLogoUrl(): string | null {
  const explicit = process.env.MAIL_LOGO_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXTAUTH_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/205.png`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTimeRange(startTime: Date, endTime: Date): string {
  const timeFmt = new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${timeFmt.format(startTime)} - ${timeFmt.format(endTime)} น.`;
}

function formatIssued(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

// Escape user-provided strings (title, displayName) before dropping them into
// the HTML template so a booking titled `<b>x` can't inject markup.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Accent = {
  color: string;
  kicker: string;
  heading: string;
  intro: string;
};

const CREATED: Accent = {
  color: "#15803d",
  kicker: "การจองใหม่",
  heading: "แจ้งการจองใช้งานห้องประชุม",
  intro:
    "เรียน เจ้าหน้าที่ผู้ดูแลห้องประชุม ขอแจ้งว่ามีการจองใช้งานห้องประชุมเพิ่มเข้ามาในระบบ โดยมีรายละเอียดดังนี้",
};
const CANCELLED: Accent = {
  color: "#b91c1c",
  kicker: "ยกเลิกการจอง",
  heading: "แจ้งการยกเลิกการจองห้องประชุม",
  intro:
    "เรียน เจ้าหน้าที่ผู้ดูแลห้องประชุม ขอแจ้งว่ามีการยกเลิกการจองใช้งานห้องประชุมในระบบ โดยมีรายละเอียดดังนี้",
};

function renderHtml(accent: Accent, booking: NotifiableBooking): string {
  const rows: [string, string][] = [
    ["หัวข้อการประชุม", escapeHtml(booking.title)],
    ["ผู้ทำรายการ", escapeHtml(booking.user.displayName)],
    ["ห้องประชุม", ROOM_NAME],
    ["วันที่", formatDate(booking.startTime)],
    ["ช่วงเวลา", formatTimeRange(booking.startTime, booking.endTime)],
  ];

  const detailRows = rows
    .map(([label, value], index) => {
      const border =
        index === rows.length - 1 ? "" : "border-bottom:1px solid #e8edf3;";
      return `
                <tr>
                  <td style="padding:14px 0;${border}color:#64748b;font-size:13px;vertical-align:top;width:130px;white-space:nowrap;">${label}</td>
                  <td style="padding:14px 0;${border}color:#0f172a;font-size:15px;font-weight:600;vertical-align:top;">${value}</td>
                </tr>`;
    })
    .join("");

  const issued = formatIssued(new Date());
  const logoUrl = getLogoUrl();
  const emblem = logoUrl
    ? `<div style="width:56px;height:56px;border-radius:50%;background-color:#ffffff;text-align:center;line-height:56px;"><img src="${logoUrl}" width="50" height="50" alt="${ROOM_NAME}" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;" /></div>`
    : `<div style="width:56px;height:56px;border-radius:12px;background-color:#1e293b;border:1px solid #334155;text-align:center;line-height:56px;font-size:26px;">🏛️</div>`;

  return `<!DOCTYPE html>
<html lang="th">
  <body style="margin:0;padding:0;background-color:#eef1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans Thai',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
            <tr>
              <td style="background-color:#0f172a;padding:28px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:56px;vertical-align:middle;">
                      ${emblem}
                    </td>
                    <td style="padding-left:16px;vertical-align:middle;">
                      <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.2px;">ระบบจองห้องประชุม</div>
                      <div style="color:#94a3b8;font-size:13px;margin-top:3px;">${ROOM_NAME}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background-color:${accent.color};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:34px 36px 8px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${accent.color};">${accent.kicker}</div>
                <div style="margin:10px 0 0;font-size:21px;font-weight:700;color:#0f172a;line-height:1.35;">${accent.heading}</div>
                <p style="margin:16px 0 26px;font-size:14px;line-height:1.8;color:#475569;">${accent.intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e8edf3;border-left:3px solid ${accent.color};border-radius:10px;">
                  <tr>
                    <td style="padding:8px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        ${detailRows}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 30px;border-top:1px solid #eef2f6;">
                <div style="font-size:12px;color:#94a3b8;line-height:1.7;">
                  อีเมลฉบับนี้จัดส่งโดยอัตโนมัติจากระบบจอง${ROOM_NAME} เพื่อแจ้งเจ้าหน้าที่ผู้เกี่ยวข้อง โปรดอย่าตอบกลับอีเมลนี้<br />
                  วันที่แจ้ง: ${issued}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(accent: Accent, booking: NotifiableBooking): string {
  return [
    `${accent.heading} — ${ROOM_NAME}`,
    ``,
    accent.intro,
    ``,
    `หัวข้อการประชุม: ${booking.title}`,
    `ผู้ทำรายการ: ${booking.user.displayName}`,
    `ห้องประชุม: ${ROOM_NAME}`,
    `วันที่: ${formatDate(booking.startTime)}`,
    `ช่วงเวลา: ${formatTimeRange(booking.startTime, booking.endTime)}`,
    ``,
    `อีเมลฉบับนี้จัดส่งโดยอัตโนมัติ โปรดอย่าตอบกลับ`,
  ].join("\n");
}

// Best-effort staff notification. Any missing config (no API key / from
// address / recipients) or provider error is swallowed so that emailing
// staff can never turn a successful booking into a failed request — the
// booking itself is already committed by the time we get here.
async function send(
  subject: string,
  accent: Accent,
  booking: NotifiableBooking,
): Promise<void> {
  const client = getClient();
  const to = getStaffEmails();
  const from = process.env.MAIL_FROM;
  if (!client || !from || to.length === 0) return;

  try {
    const { error } = await client.emails.send({
      from,
      to,
      subject,
      text: renderText(accent, booking),
      html: renderHtml(accent, booking),
    });
    if (error) {
      console.error("staff email send failed", error);
    }
  } catch (err) {
    console.error("staff email send threw", err);
  }
}

export async function notifyStaffBookingCreated(
  booking: NotifiableBooking,
): Promise<void> {
  await send(`[แจ้งการจอง] ${ROOM_NAME}: ${booking.title}`, CREATED, booking);
}

export async function notifyStaffBookingCancelled(
  booking: NotifiableBooking,
): Promise<void> {
  await send(
    `[แจ้งยกเลิกการจอง] ${ROOM_NAME}: ${booking.title}`,
    CANCELLED,
    booking,
  );
}
