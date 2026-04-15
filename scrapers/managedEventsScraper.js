// Managed events scraper
// Hard-coded known major events for Hamburg and Cologne.
// On every run:
//   - If the event date is in the past → delete it from DB if it exists
//   - If the event date is in the future → upsert it into DB
// This way the DB always reflects reality: stale events are cleaned up automatically.

const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

// All times stored as UTC. Berlin is UTC+2 in summer (Mar–Oct), UTC+1 in winter.
// Events below use local Berlin time converted to UTC manually.
const MANAGED_EVENTS = [
  // ─── BERLIN ─────────────────────────────────────────────────────────────────
  {
    title: "Rewind Cycles Bazaar 2026",
    start: new Date("2026-04-15T10:00:00.000Z"), // 12:00 Berlin (UTC+2)
    end:   new Date("2026-04-15T16:00:00.000Z"), // 18:00 Berlin (UTC+2)
    city:  "Berlin",
    link:  "https://www.facebook.com/rewindcycles/",
    imgLink: "https://cdn.prod.website-files.com/6050d741564621d2aa48c91c/642e7cbef54a03c20e0fa623_WhatsApp%20Image%202023-04-06%20at%2010.02.49.jpg",
  },

  // ─── HAMBURG ────────────────────────────────────────────────────────────────
  {
    title: "Hamburg Sternfahrt 2026",
    start: new Date("2026-06-21T08:00:00.000Z"), // 10:00 Berlin (UTC+2)
    end:   new Date("2026-06-21T14:00:00.000Z"),
    city:  "Hamburg",
    link:  "https://hamburg.adfc.de/sternfahrt",
    imgLink: "",
  },
  {
    title: "ADAC Cyclassics Hamburg 2026",
    start: new Date("2026-08-16T06:00:00.000Z"), // 08:00 Berlin (UTC+2)
    end:   new Date("2026-08-16T16:00:00.000Z"),
    city:  "Hamburg",
    link:  "https://www.timeto.com/de/event/adac-cyclassics",
    imgLink: "",
  },
  {
    title: "CANYON Dopamine Delivery Tour — Berlin to Hamburg",
    start: new Date("2026-05-25T06:00:00.000Z"), // 08:00 Berlin (UTC+2)
    end:   new Date("2026-05-25T22:00:00.000Z"),
    city:  "Hamburg",
    link:  "https://www.grouprides.cc/dashboard/closing-ride-rr-x-canyon-dopamine-delivery-tour-2026-2026-05-25",
    imgLink: "",
  },
  {
    title: "SYN APEX World Tour 2026 — Hamburg",
    start: new Date("2026-09-11T14:00:00.000Z"), // 16:00 Berlin (UTC+2)
    end:   new Date("2026-09-11T20:00:00.000Z"),
    city:  "Hamburg",
    link:  "https://www.eventbrite.com/e/syn-apex-world-tour-2026hamburg-tickets-1978824163341",
    imgLink: "",
  },
  {
    title: "BIKE FILM TOUR Season 2 — Hamburg",
    start: new Date("2026-09-27T17:00:00.000Z"), // 19:00 Berlin (UTC+2)
    end:   new Date("2026-09-27T21:00:00.000Z"),
    city:  "Hamburg",
    link:  "https://www.eventbrite.de/e/bike-film-tour-season-2-tickets-1982967286534",
    imgLink: "",
  },

  // ─── COLOGNE ────────────────────────────────────────────────────────────────
  {
    title: "CANYON Dopamine Delivery Tour — Cologne",
    start: new Date("2026-05-13T14:00:00.000Z"), // 16:00 Berlin (UTC+2)
    end:   new Date("2026-05-13T20:00:00.000Z"),
    city:  "Cologne",
    link:  "https://www.grouprides.cc/dashboard/rad-race-x-canyon-dopamine-road-tour-2026*-cologne-2026-05-13",
    imgLink: "",
  },
  {
    title: "SYN APEX World Tour 2026 — Cologne",
    start: new Date("2026-09-16T14:00:00.000Z"), // 16:00 Berlin (UTC+2)
    end:   new Date("2026-09-16T20:00:00.000Z"),
    city:  "Cologne",
    link:  "https://www.eventbrite.de/d/germany--k%C3%B6ln/bike/",
    imgLink: "",
  },
];

async function syncManagedEvents() {
  await connectDB();
  const now = new Date();
  console.log("Managed events: syncing " + MANAGED_EVENTS.length + " events...");

  for (const ev of MANAGED_EVENTS) {
    const isPast = ev.start < now;
    const existing = await Event.findOne({ title: ev.title, city: ev.city });

    if (isPast) {
      // Event has passed — remove from DB if it's still there
      if (existing) {
        await Event.deleteOne({ _id: existing._id });
        console.log(`Managed events: deleted past event — ${ev.title}`);
      }
    } else {
      // Event is upcoming — upsert
      if (existing) {
        // Update in case details changed (link, time, etc.)
        await Event.updateOne({ _id: existing._id }, {
          $set: { start: ev.start, end: ev.end, link: ev.link, imgLink: ev.imgLink }
        });
        console.log(`Managed events: updated — ${ev.title}`);
      } else {
        await Event.create(ev);
        console.log(`Managed events: created — ${ev.title}`);
      }
    }
  }
  console.log("Managed events: done.");
}

module.exports = syncManagedEvents;
