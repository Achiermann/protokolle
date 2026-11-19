// The Booking PWA lives at /booking. Login and workspace selection carry a
// `?next=` param so users of that app land back in it instead of on `/`.
// Only known targets are accepted, so `next` can't become an open redirect.
export const BOOKING_PATH = "/booking";

export function isBookingPath(pathname) {
  return pathname === BOOKING_PATH || pathname?.startsWith(`${BOOKING_PATH}/`);
}

export function safeNext(value) {
  return value === BOOKING_PATH ? BOOKING_PATH : null;
}

export function withNext(path, next) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

// "Workspace wechseln" target; from Booking it returns to Booking afterwards.
export function workspaceUrl(pathname) {
  return withNext("/workspace", isBookingPath(pathname) ? BOOKING_PATH : null);
}
