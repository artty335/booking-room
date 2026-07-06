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

// "HH:mm" options in 30-min steps across business hours.
const TIME_OPTIONS: string[] = [];
for (let h = BUSINESS_HOUR_START; h <= BUSINESS_HOUR_END; h++) {
  for (const m of [0, 30]) {
    if (h === BUSINESS_HOUR_END && m > 0) break;
    TIME_OPTIONS.push(`${pad(h)}:${pad(m)}`);
  }
}

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
  end: string;
  title: string;
  submitting: boolean;
  error: string | null;
};

const emptyCreate: CreateState = {
  open: false,
  date: "",
  start: "",
  end: "",
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

  const openCreate = (startHour: number) => {
    const start = `${pad(startHour)}:00`;
    const endHour = Math.min(startHour + 1, BUSINESS_HOUR_END);
    setCreate({
      ...emptyCreate,
      open: true,
      date: dateInputValue(day),
      start,
      end: `${pad(endHour)}:00`,
    });
  };

  const submitCreate = async () => {
    const { date, start, end, title } = create;
    if (!title.trim()) {
      setCreate((c) => ({ ...c, error: "กรุณาระบุหัวข้อการประชุม" }));
      return;
    }
    const [y, mo, d] = date.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startUtc = fromBangkokWall(new Date(y, mo - 1, d, sh, sm));
    const endUtc = fromBangkokWall(new Date(y, mo - 1, d, eh, em));

    if (endUtc <= startUtc) {
      setCreate((c) => ({ ...c, error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" }));
      return;
    }
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
              onChange={(e) => setCreate((c) => ({ ...c, date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="เวลาเริ่ม"
                value={create.start}
                onChange={(e) => setCreate((c) => ({ ...c, start: e.target.value }))}
                fullWidth
              >
                {TIME_OPTIONS.slice(0, -1).map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="เวลาสิ้นสุด"
                value={create.end}
                onChange={(e) => setCreate((c) => ({ ...c, end: e.target.value }))}
                fullWidth
              >
                {TIME_OPTIONS.slice(1).map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            </Stack>
            {create.error && <Alert severity="error">{create.error}</Alert>}
            <Typography variant="caption" color="text.secondary">
              จองได้ครั้งละไม่เกิน {MAX_DURATION_HOURS} ชั่วโมง
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setCreate(emptyCreate)}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={submitCreate} disabled={create.submitting}>
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
