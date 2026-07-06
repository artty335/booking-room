// Bangkok is a fixed UTC+7 with no daylight saving, so wall-clock conversion
// is a plain offset — no timezone database needed on the client.
//
// react-big-calendar renders Date objects using the *browser's* local
// timezone (it reads getHours()/getDate() etc.). To make the calendar always
// show Bangkok time regardless of the viewer's device timezone, we feed it
// "wall" Dates whose local fields already equal the Bangkok wall-clock time,
// then convert back to the true UTC instant when talking to the server.
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

// Real UTC instant -> a Date whose local fields equal Bangkok wall time.
// Browser-independent: reads the shifted instant's UTC fields (getUTC*),
// which don't depend on the device timezone, then rebuilds them as local.
export function toBangkokWall(utcDate: Date): Date {
  const shifted = new Date(utcDate.getTime() + BKK_OFFSET_MS);
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
  );
}

// Inverse: a wall Date (local fields = Bangkok wall time) -> real UTC instant.
export function fromBangkokWall(wallDate: Date): Date {
  return new Date(
    Date.UTC(
      wallDate.getFullYear(),
      wallDate.getMonth(),
      wallDate.getDate(),
      wallDate.getHours(),
      wallDate.getMinutes(),
      wallDate.getSeconds(),
    ) - BKK_OFFSET_MS,
  );
}
