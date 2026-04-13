// Hamburg cycling events scraper
// Sources: Critical Mass Hamburg (computed dates) + ADFC Hamburg (Puppeteer)
const puppeteer = require("puppeteer");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");
const moment = require("moment");

const CITY = "Hamburg";

const PUPPETEER_OPTS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
};

async function saveEvent({ title, start, end, link, imgLink }) {
  const found = await Event.findOne({ title, start, city: CITY });
  if (found) {
    console.log(`Hamburg: already exists - ${title}`);
    return;
  }
  const ev = await Event.create({ title, start, end, link: link || "", imgLink: imgLink || "", city: CITY });
  console.log(`Hamburg: created - ${ev._id} | ${title}`);
}

// Critical Mass Hamburg happens on the last Friday of every month at 18:30
// Generate upcoming dates for the next 6 months
function getCriticalMassHamburgDates() {
  const dates = [];
  const now = new Date();
  for (let monthOffset = 0; monthOffset <= 6; monthOffset++) {
    const m = moment().add(monthOffset, "months").startOf("month");
    // Find last Friday of this month
    const lastDay = m.clone().endOf("month");
    // Walk back from end of month to find Friday (day 5)
    while (lastDay.day() !== 5) lastDay.subtract(1, "day");
    lastDay.set({ hour: 18, minute: 30, second: 0, millisecond: 0 });
    if (lastDay.toDate() >= now) {
      dates.push(lastDay.toDate());
    }
  }
  return dates;
}

async function saveCriticalMassHamburg() {
  console.log("Hamburg: computing Critical Mass dates...");
  const dates = getCriticalMassHamburgDates();
  console.log(`Hamburg: ${dates.length} upcoming Critical Mass Hamburg dates`);
  for (const start of dates) {
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    await saveEvent({
      title: "Critical Mass Hamburg",
      start,
      end,
      link: "https://criticalmass.in/hamburg",
      imgLink: "",
    });
  }
}

// ADFC Hamburg — scrape listing page from the shared ADFC touren-termine platform
// Hamburg ADFC unit key is 117
async function scrapeAdfcHamburg() {
  const now = moment().format("YYYY/MM/DD");
  const url = `https://touren-termine.adfc.de/suche?beginning=${now}&eventType=Radtour&includeSubsidiary=true&unitKey=117`;
  let browser;
  try {
    console.log("Hamburg ADFC: launching browser...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const hasResults = await page.evaluate(() => !!document.querySelector(".list-group"));
    if (!hasResults) {
      console.log("Hamburg ADFC: no .list-group found on page");
      return;
    }

    const BASE_URL = "https://touren-termine.adfc.de";
    const events = await page.evaluate((baseURL) => {
      const items = document.querySelectorAll(".list-group-item");
      const results = [];
      for (const item of items) {
        const linkEl = item.querySelector("a");
        const href = linkEl ? linkEl.getAttribute("href") : null;
        if (!href) continue;

        const titleEl =
          item.querySelector("h4") ||
          item.querySelector("h5") ||
          item.querySelector(".list-group-item-heading") ||
          item.querySelector("strong") ||
          linkEl;
        const title = titleEl ? titleEl.innerText.trim() : null;
        if (!title) continue;

        let dateText = null;
        const dds = item.querySelectorAll("dd");
        if (dds.length > 1) dateText = dds[1].innerText.trim();
        else if (dds.length === 1) dateText = dds[0].innerText.trim();
        else {
          const texts = item.querySelectorAll("small, .list-group-item-text, p, span");
          for (const t of texts) {
            const txt = t.innerText.trim();
            if (/\d{1,2}\.\s*\w+\s*\d{4}/.test(txt)) { dateText = txt; break; }
          }
        }
        results.push({ title, dateText, link: baseURL + href });
      }
      return results;
    }, BASE_URL);

    console.log(`Hamburg ADFC: found ${events.length} events on listing page`);

    for (const ev of events) {
      if (!ev.dateText) { console.log("Hamburg ADFC: no date for '" + ev.title + "', skipping"); continue; }
      const parts = ev.dateText.split(". ");
      if (parts.length < 3) { console.log("Hamburg ADFC: unexpected date format: " + ev.dateText); continue; }
      const timeParts = parts[2].split(" - ");
      const dateToFormat = parts[1] + ". " + timeParts[0];
      const parsed = moment(dateToFormat, "DD. MMMM YYYY HH:mm", "de");
      if (!parsed.isValid()) { console.log("Hamburg ADFC: could not parse: " + dateToFormat); continue; }
      const start = parsed.toISOString();
      const end = moment(start).add(2, "h").toISOString();
      await saveEvent({ title: ev.title, start, end, link: ev.link, imgLink: "" });
    }
  } catch (err) {
    console.error("Hamburg ADFC error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeHamburg() {
  await connectDB();
  await saveCriticalMassHamburg();
  await scrapeAdfcHamburg();
  console.log("Hamburg scraper: done.");
}

module.exports = scrapeHamburg;
