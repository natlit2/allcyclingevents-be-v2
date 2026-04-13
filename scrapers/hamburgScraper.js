// Hamburg cycling events scraper
// Sources: Critical Mass Hamburg (computed) + ADFC Hamburg (unitKey 158, Puppeteer)
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");
const moment = require("moment");
const scrapeAdfcCity = require("./adfcScrapeHelper");

const CITY = "Hamburg";

async function saveEvent({ title, start, end, link }) {
  // Dedup by title + calendar day + city (avoids timezone duplicate issues)
  const dateKey = moment(start).utc().format("YYYY-MM-DD");
  const dayStart = new Date(dateKey + "T00:00:00.000Z");
  const dayEnd   = new Date(dateKey + "T23:59:59.999Z");
  const found = await Event.findOne({ title, city: CITY, start: { $gte: dayStart, $lte: dayEnd } });
  if (found) {
    console.log(`Hamburg: already exists - ${title} on ${dateKey}`);
    return;
  }
  const ev = await Event.create({ title, start, end, link, imgLink: "", city: CITY });
  console.log(`Hamburg: created - ${ev._id} | ${title} | ${dateKey}`);
}

// Last Friday of each month at 18:30 Berlin local time
// Berlin is UTC+1 in winter, UTC+2 in summer (CET/CEST)
// moment() parses dates in local server time — we store as explicit UTC offset
function getCriticalMassDates() {
  const dates = [];
  const now = new Date();
  for (let monthOffset = 0; monthOffset <= 6; monthOffset++) {
    const m = moment().add(monthOffset, "months").startOf("month");
    const lastDay = m.clone().endOf("month");
    while (lastDay.day() !== 5) lastDay.subtract(1, "day");

    // Determine UTC offset for Berlin: CEST (UTC+2) Mar–Oct, CET (UTC+1) Nov–Feb
    const month = lastDay.month(); // 0-indexed
    const isSummer = month >= 2 && month <= 9; // March(2) to October(9)
    const utcOffsetHours = isSummer ? 2 : 1;

    // 18:30 Berlin = 18:30 - offset in UTC
    const utcHour = 18 - utcOffsetHours;
    const dateStr = lastDay.format("YYYY-MM-DD");
    const startUTC = new Date(`${dateStr}T${String(utcHour).padStart(2,"0")}:30:00.000Z`);

    if (startUTC >= now) dates.push(startUTC);
  }
  return dates;
}

async function scrapeHamburg() {
  await connectDB();
  console.log("Hamburg scraper: computing Critical Mass dates...");
  const dates = getCriticalMassDates();
  console.log(`Hamburg scraper: ${dates.length} upcoming Critical Mass dates`);
  for (const start of dates) {
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    await saveEvent({
      title: "Critical Mass Hamburg",
      start,
      end,
      link: "https://criticalmass.in/hamburg",
    });
  }
  await scrapeAdfcCity({ unitKey: 158, city: "Hamburg", label: "ADFC Hamburg" });
  console.log("Hamburg scraper: done.");
}

module.exports = scrapeHamburg;
