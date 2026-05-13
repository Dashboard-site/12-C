const CACHE_NAME = "class12c-dashboard-v4";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.png",
  "./logo.png",
  "./bg1.png","./bg2.png","./bg3.png","./bg4.png","./bg5.png",
  "./bg6.png","./bg7.png","./bg8.png","./bg9.png","./bg10.png",
  "./Ndot_font.woff2"
];

/* ----------------------------------------------------------------
   INSTALL & FETCH
   ---------------------------------------------------------------- */
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});

/* ----------------------------------------------------------------
   NOTIFICATION SCHEDULE  (mirrors NOTIF_SCHEDULE in index.html)
   ---------------------------------------------------------------- */
const NOTIF_SCHEDULE = [
  { time: "08:40", type: "period",    idx: 0,    prev: null,     prevLabel: null },
  { time: "09:40", type: "period",    idx: 1,    prev: "period", prevLabel: "Period 0" },
  { time: "10:20", type: "period",    idx: 2,    prev: "period", prevLabel: "Period 1" },
  { time: "11:00", type: "break",     idx: null, prev: "period", prevLabel: "Period 2", breakEnd: "11:10" },
  { time: "11:10", type: "period",    idx: 3,    prev: "break",  prevLabel: null },
  { time: "11:50", type: "period",    idx: 4,    prev: "period", prevLabel: "Period 3" },
  { time: "12:30", type: "lunch",     idx: null, prev: "period", prevLabel: "Period 4", breakEnd: "1:00 PM" },
  { time: "13:00", type: "period",    idx: 5,    prev: "lunch",  prevLabel: null },
  { time: "13:35", type: "period",    idx: 6,    prev: "period", prevLabel: "Period 5" },
  { time: "14:10", type: "break",     idx: null, prev: "period", prevLabel: "Period 6", breakEnd: "2:20 PM" },
  { time: "14:20", type: "period",    idx: 7,    prev: "break",  prevLabel: null },
  { time: "14:55", type: "period",    idx: 8,    prev: "period", prevLabel: "Period 7" },
  { time: "15:30", type: "period",    idx: 9,    prev: "period", prevLabel: "Period 8" },
  { time: "16:20", type: "dismissed", idx: null, prev: "period", prevLabel: "Period 9" }
];

let _timetable = null;
let _swTimers  = [];

/* ----------------------------------------------------------------
   MESSAGE HANDLER — page sends timetable + triggers scheduling
   ---------------------------------------------------------------- */
self.addEventListener("message", event => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === "SCHEDULE_NOTIFICATIONS") {
    _timetable = msg.timetable;
    scheduleSWNotifications();
  }
  if (msg.type === "CANCEL_NOTIFICATIONS") {
    cancelSWTimers();
  }
});

/* ----------------------------------------------------------------
   SCHEDULING
   ---------------------------------------------------------------- */
function cancelSWTimers() {
  _swTimers.forEach(t => clearTimeout(t));
  _swTimers = [];
}

function scheduleSWNotifications() {
  cancelSWTimers();
  const now       = Date.now();
  const d         = new Date();
  const todayBase = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  NOTIF_SCHEDULE.forEach(entry => {
    const [h, m] = entry.time.split(":").map(Number);
    const fireAt = todayBase + h * 3600000 + m * 60000;
    const delay  = fireAt - now;
    if (delay > 0) {
      _swTimers.push(setTimeout(() => swShowNotification(entry), delay));
    }
  });

  /* Auto-reschedule at midnight */
  const tomorrow   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5).getTime();
  _swTimers.push(setTimeout(() => { if (_timetable) scheduleSWNotifications(); }, tomorrow - now));
}

function buildContent(entry) {
  const day = new Date().getDay();
  const tt  = _timetable?.[day] || [];
  let title = "", body = "";

  if (entry.type === "period") {
    const p = tt[entry.idx];
    const sub   = p?.subject || "—";
    const teach = p?.teacher || "—";
    title = `📚 Period ${entry.idx}`;
    const pre = entry.prev === "period" ? `${entry.prevLabel} over · `
              : entry.prev === "break"  ? "Break over · "
              : entry.prev === "lunch"  ? "Lunch over · " : "";
    body = `${pre}${sub} · ${teach}`;
  } else if (entry.type === "break") {
    title = "☕ Break Time";
    body  = `${entry.prevLabel} over · Break until ${entry.breakEnd}`;
  } else if (entry.type === "lunch") {
    title = "🍽️ Lunch Break";
    body  = `${entry.prevLabel} over · Lunch until ${entry.breakEnd}`;
  } else if (entry.type === "dismissed") {
    title = "🏁 School Dismissed";
    body  = `${entry.prevLabel} over · See you tomorrow!`;
  }
  return { title, body };
}

function swShowNotification(entry) {
  const { title, body } = buildContent(entry);
  self.registration.showNotification(title, {
    body,
    icon:     "icon.png",
    badge:    "icon.png",
    tag:      `period-${entry.time}`,
    renotify: true,
    silent:   false
  });
}

/* ----------------------------------------------------------------
   NOTIFICATION CLICK — focus or open the app
   ---------------------------------------------------------------- */
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(list => {
        for (const c of list) { if ("focus" in c) return c.focus(); }
        return self.clients.openWindow("./index.html");
      })
  );
});
