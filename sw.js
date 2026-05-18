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

   Slots:
     0 = Prayer      (07:25–07:40)
     1 = Period I    (07:40–08:20)
     2 = Period II   (08:20–09:00)
     3 = Interval    (09:00–09:10)
     4 = Period III  (09:10–09:50)
     5 = Period IV   (09:50–10:30)
   ---------------------------------------------------------------- */
const NOTIF_SCHEDULE = [
  { time: "07:25", type: "break",     idx: 0,    prev: null,     prevLabel: null,         breakEnd: "07:40" },
  { time: "07:40", type: "period",    idx: 1,    prev: "break",  prevLabel: null                            },
  { time: "08:20", type: "period",    idx: 2,    prev: "period", prevLabel: "Period I"                      },
  { time: "09:00", type: "break",     idx: null, prev: "period", prevLabel: "Period II",  breakEnd: "09:10" },
  { time: "09:10", type: "period",    idx: 4,    prev: "break",  prevLabel: null                            },
  { time: "09:50", type: "period",    idx: 5,    prev: "period", prevLabel: "Period III"                    },
  { time: "10:30", type: "dismissed", idx: null, prev: "period", prevLabel: "Period IV"                     }
];

/* Maps timetable slot index → display label (mirrors PERIOD_LABELS_NOTIF in index.html) */
const PERIOD_LABELS = { 1: "Period I", 2: "Period II", 4: "Period III", 5: "Period IV" };

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
  const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5).getTime();
  _swTimers.push(setTimeout(() => { if (_timetable) scheduleSWNotifications(); }, tomorrow - now));
}

function buildContent(entry) {
  const day = new Date().getDay();
  const tt  = _timetable?.[day] || [];
  let title = "", body = "";

  if (entry.type === "period") {
    const period = tt[entry.idx];
    const sub    = period?.subject || "---";
    const teach  = period?.teacher || "---";
    const num    = PERIOD_LABELS[entry.idx] || ("Period " + entry.idx);

    if (entry.prev === "period" && entry.prevLabel) {
      /* Find previous period's subject from timetable */
      const prevEntry = NOTIF_SCHEDULE.find(e => PERIOD_LABELS[e.idx] === entry.prevLabel && e.type === "period");
      const prevSub   = prevEntry ? (tt[prevEntry.idx]?.subject || "---") : "---";
      title = `${entry.prevLabel}, ${prevSub} Over`;
      body  = `Current Period: ${sub} - ${teach}`;
    } else {
      const prevPart = entry.prev === "break" ? "Interval over." : "";
      title = `${num}: ${sub} - ${teach}`;
      body  = prevPart;
    }

  } else if (entry.type === "break") {
    const isPrayer = entry.idx === 0;
    title = isPrayer ? "Prayer Time" : "Interval";
    body  = (entry.prevLabel ? entry.prevLabel + " over. " : "") + "Ends at " + entry.breakEnd;

  } else if (entry.type === "dismissed") {
    title = "School Dismissed";
    body  = `${entry.prevLabel} over. See you tomorrow!`;
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
