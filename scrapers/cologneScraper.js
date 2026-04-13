// Cologne cycling events scraper
// Sources:
//   1. Critical Mass Cologne — computed dates (last Friday of each month, 18:00, Rudolfplatz)
//   2. ADFC Cologne — REST API (unitKey 164090), no Puppeteer needed
const https = require("https");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");
const moment = require("moment");

const CITY = "Cologne";

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: "application/json" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("JSON parse error: " + e.message)); }
      });
    }).on("error", reject);
  });
}

async function saveEvent({ title, start, end, link, imgLink }) {
  const found = await Event.findOne({ title, start, city: CITY });
  if (found) {
    console.log(`Cologne: already exists - ${title}`);
    return;
  }
  const ev = await Event.create({ title, start, end, link: link || "", imgLink: imgLink || "", city: CITY });
  console.log(`Cologne: created - ${ev._id} | ${title}`);
}

// Critical Mass Cologne — last Friday of each month at 18:00 at Rudolfplatz
function getCriticalMassDates() {
  const dates = [];
  const now = new Date();
  for (let monthOffset = 0; monthOffset <= 6; monthOffset++) {
    const lastDay = moment().add(monthOffset, "months").endOf("month");
    while (lastDay.day() !== 5) lastDay.subtract(1, "day"); // find last Friday
    lastDay.set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
    if (lastDay.toDate() >= now) dates.push(lastDay.toDate());
  }
  return dates;
}

async function saveCriticalMassCologne() {
  console.log("Cologne: computing Critical Mass dates...");
  const dates = getCriticalMassDates();
  console.log(`Cologne: ${dates.length} upcoming Critical Mass dates`);
  for (const start of dates) {
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    await saveEvent({
      title: "Critical Mass Köln",
      start,
      end,
      link: "https://criticalmass.in/koln",
      imgLink: "",
    });
  }
}

// ADFC Cologne — REST API, returns guided bike tours for unitKey 164090
async function scrapeAdfcCologne() {
  console.log("Cologne ADFC: fetching events from API...");
  try {
    const url = "https://api-touren-termine.adfc.de/api/eventItems/search?unitKey=164090&fromNow=true&eventType=Radtour&pageSize=100";
    const data = await fetchJSON(url);

    // API may return array directly or { items: [...] } or { data: [...] }
    const items = Array.isArray(data)
      ? data
      : data.items || data.data || data.eventItems || [];

    console.log(`Cologne ADFC: ${items.length} events in response`);
    const now = new Date();

    for (const ev of items) {
      if (!ev.title || !ev.beginning) continue;
      const start = new Date(ev.beginning);
      if (isNaN(start.getTime()) || start < now) continue;
      const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const link = ev.cSlug
        ? `https://touren-termine.adfc.de/radveranstaltung/${ev.cSlug}`
        : "https://touren-termine.adfc.de";
      await saveEvent({
        title: ev.title,
        start,
        end,
        link,
        imgLink: ev.imageUrl || "",
      });
    }
  } catch (err) {
    console.error("Cologne ADFC error: " + err.message);
  }
}

async function scrapeCologne() {
  await connectDB();
  await saveCriticalMassCologne();
  await scrapeAdfcCologne();
  console.log("Cologne scraper: done.");
}

module.exports = scrapeCologne;
