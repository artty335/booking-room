"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import {
  BUSINESS_HOUR_END,
  BUSINESS_HOUR_START,
  MAX_DURATION_HOURS,
  MIN_LEAD_TIME_MINUTES,
} from "@/lib/booking-rules";
import { fromBangkokWall, toBangkokWall } from "@/lib/bangkok-wall";

type ApiBooking = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  userId: string;
  user: { id: string; displayName: string };
};

const HOUR_HEIGHT = 56;
const GUTTER = 56;
const HOURS = Array.from(
  { length: BUSINESS_HOUR_END - BUSINESS_HOUR_START + 1 },
  (_, i) => BUSINESS_HOUR_START + i,
);

const pad = (n: number) => String(n).padStart(2, "0");

// "HH:mm" start options in 30-min steps. The latest valid start leaves room
// for the shortest (30-min) booking before closing time.
const START_OPTIONS: string[] = [];
for (let h = BUSINESS_HOUR_START; h <= BUSINESS_HOUR_END; h++) {
  for (const m of [0, 30]) {
    if (h * 60 + m > BUSINESS_HOUR_END * 60 - 30) break;
    START_OPTIONS.push(`${pad(h)}:${pad(m)}`);
  }
}

// Selectable meeting lengths, capped at MAX_DURATION_HOURS.
const DURATIONS: { min: number; label: string }[] = [
  { min: 30, label: "30 นาที" },
  { min: 60, label: "1 ชม." },
  { min: 90, label: "1 ชม. 30 น." },
  { min: 120, label: "2 ชม." },
  { min: 180, label: "3 ชม." },
  { min: 240, label: "4 ชม." },
].filter((d) => d.min <= MAX_DURATION_HOURS * 60);

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// Does [a, b) overlap any of the given [start, end) minute intervals?
const overlaps = (a: number, b: number, intervals: [number, number][]) =>
  intervals.some(([bs, be]) => a < be && b > bs);
// Can a booking of `dur` minutes start at `sMin` — within hours and not
// colliding with an existing booking?
const fitsDuration = (
  sMin: number,
  dur: number,
  intervals: [number, number][],
) => sMin + dur <= BUSINESS_HOUR_END * 60 && !overlaps(sMin, sMin + dur, intervals);
const hasAnyDuration = (sMin: number, intervals: [number, number][]) =>
  DURATIONS.some((d) => fitsDuration(sMin, d.min, intervals));

const thaiDate = (d: Date) =>
  new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

const dateInputValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const minutesFromStart = (d: Date) =>
  d.getHours() * 60 + d.getMinutes() - BUSINESS_HOUR_START * 60;

type CreateState = {
  open: boolean;
  date: string;
  start: string;
  durationMinutes: number;
  title: string;
  submitting: boolean;
  error: string | null;
};

const emptyCreate: CreateState = {
  open: false,
  date: "",
  start: "",
  durationMinutes: 60,
  title: "",
  submitting: false,
  error: null,
};

export function BookingCalendar({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Selected day as a Bangkok wall-clock midnight.
  const [day, setDay] = useState(() => {
    const w = toBangkokWall(new Date());
    return new Date(w.getFullYear(), w.getMonth(), w.getDate());
  });
  const [create, setCreate] = useState<CreateState>(emptyCreate);
  const [viewing, setViewing] = useState<ApiBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      setBookings(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadBookings();
  }, [loadBookings]);

  // Bookings that fall on the selected day, mapped to wall-clock positions.
  const dayBookings = useMemo(() => {
    return bookings
      .map((b) => ({ b, start: toBangkokWall(new Date(b.startTime)), end: toBangkokWall(new Date(b.endTime)) }))
      .filter(
        ({ start }) =>
          start.getFullYear() === day.getFullYear() &&
          start.getMonth() === day.getMonth() &&
          start.getDate() === day.getDate(),
      );
  }, [bookings, day]);

  const nowWall = toBangkokWall(new Date());
  const isToday =
    nowWall.getFullYear() === day.getFullYear() &&
    nowWall.getMonth() === day.getMonth() &&
    nowWall.getDate() === day.getDate();

  const shiftDay = (delta: number) =>
    setDay((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));

  const goToday = () => {
    const w = toBangkokWall(new Date());
    setDay(new Date(w.getFullYear(), w.getMonth(), w.getDate()));
  };

  // Busy [startMin, endMin) intervals for a given "YYYY-MM-DD" (Bangkok wall).
  const busyIntervals = useCallback(
    (dateStr: string): [number, number][] => {
      if (!dateStr) return [];
      const [y, mo, d] = dateStr.split("-").map(Number);
      return bookings
        .map((b) => ({
          s: toBangkokWall(new Date(b.startTime)),
          e: toBangkokWall(new Date(b.endTime)),
        }))
        .filter(
          ({ s }) =>
            s.getFullYear() === y && s.getMonth() === mo - 1 && s.getDate() === d,
        )
        .map(({ s, e }) => [
          s.getHours() * 60 + s.getMinutes(),
          e.getHours() * 60 + e.getMinutes(),
        ]);
    },
    [bookings],
  );

  // Earliest bookable minute for a date: now + lead time if it's today,
  // otherwise anytime.
  const earliestMinFor = useCallback((dateStr: string) => {
    if (!dateStr) return -1;
    const [y, mo, d] = dateStr.split("-").map(Number);
    const w = toBangkokWall(new Date());
    if (w.getFullYear() === y && w.getMonth() === mo - 1 && w.getDate() === d) {
      return w.getHours() * 60 + w.getMinutes() + MIN_LEAD_TIME_MINUTES;
    }
    return -1;
  }, []);

  const busyForDate = useMemo(
    () => busyIntervals(create.date),
    [busyIntervals, create.date],
  );
  const earliestMin = useMemo(
    () => earliestMinFor(create.date),
    [earliestMinFor, create.date],
  );

  // Pick a valid (start, duration) for a date, keeping the caller's
  // preferences when they still fit around existing bookings.
  const pickSlot = useCallback(
    (dateStr: string, preferStart: string, preferDur: number) => {
      const intervals = busyIntervals(dateStr);
      const earliest = earliestMinFor(dateStr);
      const startOk = (t: string) => {
        const s = toMin(t);
        return (
          s >= earliest && !overlaps(s, s + 1, intervals) && hasAnyDuration(s, intervals)
        );
      };
      const start =
        preferStart && startOk(preferStart)
          ? preferStart
          : (START_OPTIONS.find(startOk) ?? preferStart);
      const sMin = toMin(start);
      const durationMinutes = fitsDuration(sMin, preferDur, intervals)
        ? preferDur
        : (DURATIONS.find((d) => fitsDuration(sMin, d.min, intervals))?.min ??
          preferDur);
      return { start, durationMinutes };
    },
    [busyIntervals, earliestMinFor],
  );

  const openCreate = (startHour: number) => {
    const date = dateInputValue(day);
    const slot = pickSlot(date, `${pad(startHour)}:00`, 60);
    setCreate({ ...emptyCreate, open: true, date, ...slot });
  };

  const changeDate = (date: string) =>
    setCreate((c) => ({ ...c, date, ...pickSlot(date, c.start, c.durationMinutes) }));

  const changeStart = (start: string) =>
    setCreate((c) => {
      const sMin = toMin(start);
      const durationMinutes = fitsDuration(sMin, c.durationMinutes, busyForDate)
        ? c.durationMinutes
        : (DURATIONS.find((d) => fitsDuration(sMin, d.min, busyForDate))?.min ??
          c.durationMinutes);
      return { ...c, start, durationMinutes };
    });

  const startDisabled = (t: string) => {
    const sMin = toMin(t);
    return (
      sMin < earliestMin ||
      overlaps(sMin, sMin + 1, busyForDate) ||
      !hasAnyDuration(sMin, busyForDate)
    );
  };
  const durationDisabled = (dur: number) =>
    !create.start || !fitsDuration(toMin(create.start), dur, busyForDate);

  const dayFull = create.open && START_OPTIONS.every(startDisabled);
  const selectionInvalid =
    !create.start || startDisabled(create.start) || durationDisabled(create.durationMinutes);
  const endMin = create.start ? toMin(create.start) + create.durationMinutes : 0;

  const submitCreate = async () => {
    const { date, start, durationMinutes, title } = create;
    if (!title.trim()) {
      setCreate((c) => ({ ...c, error: "กรุณาระบุหัวข้อการประชุม" }));
      return;
    }
    const [y, mo, d] = date.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const startWall = new Date(y, mo - 1, d, sh, sm);
    const endWall = new Date(startWall.getTime() + durationMinutes * 60_000);
    const startUtc = fromBangkokWall(startWall);
    const endUtc = fromBangkokWall(endWall);

    if (startUtc.getTime() < Date.now() + MIN_LEAD_TIME_MINUTES * 60_000) {
      setCreate((c) => ({
        ...c,
        error: `ต้องจองล่วงหน้าอย่างน้อย ${MIN_LEAD_TIME_MINUTES} นาที`,
      }));
      return;
    }

    setCreate((c) => ({ ...c, submitting: true, error: null }));
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        startTime: startUtc.toISOString(),
        endTime: endUtc.toISOString(),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setCreate((c) => ({ ...c, submitting: false, error: body?.error ?? "จองไม่สำเร็จ" }));
      return;
    }
    setCreate(emptyCreate);
    setToast("จองห้องสำเร็จ");
    await loadBookings();
  };

  const cancelBooking = async () => {
    if (!viewing) return;
    setCancelling(true);
    const res = await fetch(`/api/bookings/${viewing.id}`, { method: "DELETE" });
    setCancelling(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "ยกเลิกไม่สำเร็จ");
      setViewing(null);
      return;
    }
    setViewing(null);
    setToast("ยกเลิกการจองแล้ว");
    await loadBookings();
  };

  const canCancel = (b: ApiBooking) => b.userId === currentUserId || isAdmin;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, flex: 1 }}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}>
        {/* Toolbar */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button size="small" variant="outlined" color="inherit" onClick={goToday}>
              วันนี้
            </Button>
            <IconButton size="small" onClick={() => shiftDay(-1)} aria-label="วันก่อนหน้า">
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => shiftDay(1)} aria-label="วันถัดไป">
              <ChevronRightIcon fontSize="small" />
            </IconButton>
            <Box>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {thaiDate(day)}
              </Typography>
              {isToday && (
                <Typography variant="caption" color="primary" sx={{ fontWeight: 500 }}>
                  วันนี้
                </Typography>
              )}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {loading && <CircularProgress size={18} />}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openCreate(Math.max(BUSINESS_HOUR_START, Math.min(9, BUSINESS_HOUR_END - 1)))}
            >
              จองห้อง
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Day grid */}
        <Box
          sx={{
            position: "relative",
            height: HOURS.length * HOUR_HEIGHT,
            maxHeight: 560,
            overflowY: "auto",
          }}
        >
          <Box sx={{ position: "relative", height: (HOURS.length - 1) * HOUR_HEIGHT + 1 }}>
            {/* Hour cells + labels */}
            {HOURS.map((h, i) => (
              <Box
                key={h}
                onClick={() => h < BUSINESS_HOUR_END && openCreate(h)}
                sx={{
                  position: "absolute",
                  top: i * HOUR_HEIGHT,
                  left: 0,
                  right: 0,
                  height: HOUR_HEIGHT,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  cursor: h < BUSINESS_HOUR_END ? "pointer" : "default",
                  "&:hover":
                    h < BUSINESS_HOUR_END
                      ? { bgcolor: "action.hover" }
                      : undefined,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    top: -9,
                    left: 6,
                    width: GUTTER - 12,
                    color: "text.disabled",
                    bgcolor: "background.paper",
                    px: 0.5,
                  }}
                >
                  {pad(h)}:00
                </Typography>
              </Box>
            ))}

            {/* Now indicator */}
            {isToday &&
              minutesFromStart(nowWall) >= 0 &&
              minutesFromStart(nowWall) <= (HOURS.length - 1) * 60 && (
                <Box
                  sx={{
                    position: "absolute",
                    left: GUTTER,
                    right: 0,
                    top: (minutesFromStart(nowWall) / 60) * HOUR_HEIGHT,
                    height: 0,
                    borderTop: "2px solid",
                    borderColor: "error.main",
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                />
              )}

            {/* Booking blocks */}
            {dayBookings.map(({ b, start, end }) => {
              const top = (minutesFromStart(start) / 60) * HOUR_HEIGHT;
              const height = Math.max(
                22,
                ((minutesFromStart(end) - minutesFromStart(start)) / 60) * HOUR_HEIGHT - 4,
              );
              const mine = b.userId === currentUserId;
              return (
                <Paper
                  key={b.id}
                  onClick={() => setViewing(b)}
                  elevation={0}
                  sx={{
                    position: "absolute",
                    left: GUTTER + 4,
                    right: 6,
                    top: top + 2,
                    height,
                    px: 1,
                    py: 0.5,
                    overflow: "hidden",
                    cursor: "pointer",
                    bgcolor: mine ? "primary.main" : "grey.500",
                    color: "#fff",
                    borderRadius: 2,
                    zIndex: 2,
                    transition: "filter .12s",
                    "&:hover": { filter: "brightness(0.94)" },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block", lineHeight: 1.2 }}>
                    {pad(start.getHours())}:{pad(start.getMinutes())}–{pad(end.getHours())}:{pad(end.getMinutes())}
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block", lineHeight: 1.2, opacity: 0.95 }} noWrap>
                    {b.title}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          แตะช่องเวลาว่างเพื่อจอง · แตะรายการที่จองไว้เพื่อดู/ยกเลิก · เวลาทำการ {pad(BUSINESS_HOUR_START)}:00–{pad(BUSINESS_HOUR_END)}:00
        </Typography>
      </Paper>

      {/* Create dialog */}
      <Dialog open={create.open} onClose={() => setCreate(emptyCreate)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>จองห้องประชุม 205</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="หัวข้อการประชุม"
              value={create.title}
              onChange={(e) => setCreate((c) => ({ ...c, title: e.target.value }))}
              autoFocus
              fullWidth
            />
            <TextField
              label="วันที่"
              type="date"
              value={create.date}
              onChange={(e) => changeDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            {dayFull ? (
              <Alert severity="info">ช่วงเวลาทำการของวันนี้ถูกจองเต็มแล้ว ลองเลือกวันอื่น</Alert>
            ) : (
              <>
                <TextField
                  select
                  label="เวลาเริ่ม"
                  value={create.start}
                  onChange={(e) => changeStart(e.target.value)}
                  fullWidth
                >
                  {START_OPTIONS.map((t) => (
                    <MenuItem key={t} value={t} disabled={startDisabled(t)}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    ระยะเวลา
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {DURATIONS.map((dr) => {
                      const disabled = durationDisabled(dr.min);
                      const selected = create.durationMinutes === dr.min;
                      return (
                        <Button
                          key={dr.min}
                          size="small"
                          disableElevation
                          variant={selected ? "contained" : "outlined"}
                          color={selected ? "primary" : "inherit"}
                          disabled={disabled}
                          onClick={() => setCreate((c) => ({ ...c, durationMinutes: dr.min }))}
                          sx={{ borderRadius: 999, minWidth: 0, px: 1.75 }}
                        >
                          {dr.label}
                        </Button>
                      );
                    })}
                  </Box>
                </Box>
              </>
            )}
            {create.error && <Alert severity="error">{create.error}</Alert>}
            {!dayFull && create.start && (
              <Typography variant="caption" color="text.secondary">
                {create.start} – {fromMin(endMin)} น. · จองได้ครั้งละไม่เกิน {MAX_DURATION_HOURS} ชั่วโมง
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setCreate(emptyCreate)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={create.submitting || dayFull || selectionInvalid}
          >
            {create.submitting ? "กำลังบันทึก…" : "ยืนยันการจอง"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View / cancel dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="xs" fullWidth>
        {viewing && (
          <>
            <DialogTitle sx={{ fontWeight: 600 }}>{viewing.title}</DialogTitle>
            <DialogContent>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  {thaiDate(toBangkokWall(new Date(viewing.startTime)))}
                </Typography>
                <Typography variant="body2">
                  {(() => {
                    const s = toBangkokWall(new Date(viewing.startTime));
                    const e = toBangkokWall(new Date(viewing.endTime));
                    return `${pad(s.getHours())}:${pad(s.getMinutes())} – ${pad(e.getHours())}:${pad(e.getMinutes())} น.`;
                  })()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  จองโดย {viewing.user.displayName}
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button color="inherit" onClick={() => setViewing(null)}>
                ปิด
              </Button>
              {canCancel(viewing) && (
                <Button color="error" variant="contained" onClick={cancelBooking} disabled={cancelling}>
                  {cancelling ? "กำลังยกเลิก…" : "ยกเลิกการจอง"}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
