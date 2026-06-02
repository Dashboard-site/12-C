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
   PART M — PERIOD CHANGE NOTIFICATIONS
   ---------------------------------------------------------------- */

/*
  Schedule table — each entry fires ONE notification at `time`.
  `prev`  = what just ended (null for first period)
  `type`  = "period" | "break" | "lunch" | "dismissed"
  `idx`   = timetable index of the CURRENT slot (null for breaks/dismissed)
*/
const NOTIF_SCHEDULE = [
  { time: "08:40", type: "period",    idx: 0,    prev: null,       prevLabel: null },
  { time: "09:40", type: "period",    idx: 1,    prev: "period",   prevLabel: "Period 0" },
  { time: "10:20", type: "period",    idx: 2,    prev: "period",   prevLabel: "Period 1" },
  { time: "11:00", type: "break",     idx: null, prev: "period",   prevLabel: "Period 2",  breakEnd: "11:10" },
  { time: "11:10", type: "period",    idx: 3,    prev: "break",    prevLabel: null },
  { time: "11:50", type: "period",    idx: 4,    prev: "period",   prevLabel: "Period 3" },
  { time: "12:30", type: "lunch",     idx: null, prev: "period",   prevLabel: "Period 4",  breakEnd: "1:00 PM" },
  { time: "13:00", type: "period",    idx: 5,    prev: "lunch",    prevLabel: null },
  { time: "13:35", type: "period",    idx: 6,    prev: "period",   prevLabel: "Period 5" },
  { time: "14:10", type: "break",     idx: null, prev: "period",   prevLabel: "Period 6",  breakEnd: "2:20 PM" },
  { time: "14:20", type: "period",    idx: 7,    prev: "break",    prevLabel: null },
  { time: "14:55", type: "period",    idx: 8,    prev: "period",   prevLabel: "Period 7" },
  { time: "15:30", type: "period",    idx: 9,    prev: "period",   prevLabel: "Period 8" },
  { time: "16:20", type: "dismissed", idx: null, prev: "period",   prevLabel: "Period 9" }
];

let _notifPermission = Notification.permission;
let _notifTimers     = [];

function buildNotifContent(entry) {
  const day = new Date().getDay();
  const tt  = data.timetables[day] || data.timetables[String(day)] || defaults.timetables[day];

  let title = "";
  let body  = "";

  if (entry.type === "period") {
    const period = tt?.[entry.idx];
    const sub    = period?.subject  || "—";
    const teach  = period?.teacher  || "—";
    const num    = `Period ${entry.idx}`;

    if (entry.prev === "period" && entry.prevLabel) {
      const prevIdx    = parseInt(entry.prevLabel.replace("Period ", ""));
      const prevPeriod = tt?.[prevIdx];
      const prevSub    = prevPeriod?.subject || "—";
      const isAssembly = prevSub.toLowerCase().includes("assembly") || prevIdx === 0;
      const overLabel  = isAssembly ? "Prayer/Assembly Over" : `${entry.prevLabel}, ${prevSub} Over`;
      title = `📚 ${overLabel}`;
      body  = `Current Period: ${sub} · ${teach}`;
    } else {
      const prevPart = entry.prev === "break" ? "Break over." :
                       entry.prev === "lunch" ? "Lunch over." : "";
      title = `📚 ${num}: ${sub} · ${teach}`;
      body  = prevPart;
    }

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

function fireNotification(entry) {
  if (Notification.permission !== "granted") return;
  const { title, body } = buildNotifContent(entry);
  const opts = {
    body,
    icon:     "icon.png",
    badge:    "icon.png",
    tag:      `period-${entry.time}`,
    renotify: true,
    silent:   false
  };
  /* Use SW registration.showNotification — fires even when tab is backgrounded.
     Falls back to new Notification() if SW isn't ready. */
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => new Notification(title, opts));
  } else {
    new Notification(title, opts);
  }
}

/* Track which notifications have already fired today */
let _notifFiredToday = new Set();
let _notifIntervalId = null;

function scheduleAllNotifications() {
  /* Clear any previous interval */
  if (_notifIntervalId) clearInterval(_notifIntervalId);
  _notifFiredToday.clear();

  if (Notification.permission !== "granted") return;

  /* Mark any entries already past as fired so we don't re-fire on page reload */
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  NOTIF_SCHEDULE.forEach(entry => {
    const [h, m] = entry.time.split(":").map(Number);
    if (nowMin > h * 60 + m) _notifFiredToday.add(entry.time);
  });

  /* Poll every 30 s — far more reliable than long setTimeout on mobile */
  _notifIntervalId = setInterval(checkAndFireNotifications, 30000);
  console.log("Notification polling started.");
}

function checkAndFireNotifications() {
  if (Notification.permission !== "granted") return;
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  NOTIF_SCHEDULE.forEach(entry => {
    if (_notifFiredToday.has(entry.time)) return;
    const [h, m] = entry.time.split(":").map(Number);
    const entryMin = h * 60 + m;
    /* Fire if we're within a 2-minute window — handles interval timing jitter */
    if (nowMin >= entryMin && nowMin < entryMin + 2) {
      _notifFiredToday.add(entry.time);
      fireNotification(entry);
    }
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
