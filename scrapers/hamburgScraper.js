// Hamburg cycling events scraper
// Sources: criticalmass.in API + fahrradtermine-hamburg.de (if available) + ADFC Hamburg
const https = require("https");
const puppeteer = require("puppeteer");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

const CITY = "Hamburg";

const PUPPETEER_OPTS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
};

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
    console.log(`Hamburg: already exists - ${title}`);
    return;
  }
  const ev = await Event.create({ title, start, end, link, imgLink, city: CITY });
  console.log(`Hamburg: created - ${ev._id} | ${title}`);
}

// Source 1: Critical Mass Hamburg via criticalmass.in API
async function scrapeCriticalMassHamburg() {
  try {
    console.log("Hamburg: fetching Critical Mass rides...");
    const rides = await fetchJSON("https://criticalmass.in/api/ride?city=hamburg");
    if (!Array.isArray(rides)) return;
    const now = new Date();
    const upcoming = rides.filter((r) => r.dateTime && new Date(r.dateTime) >= now);
    console.log(`Hamburg: ${upcoming.length} Critical Mass rides found`);
    for (const ride of upcoming) {
      const title = ride.title || "Critical Mass Hamburg";
      const start = new Date(ride.dateTime);
      const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
      const dateStr = start.toISOString().split("T")[0];
      await saveEvent({
        title,
        start,
        end,
        link: `https://criticalmass.in/hamburg/${dateStr}`,
        imgLink: "https://criticalmass.in/build/images/cities/hamburg.jpg",
      });
    }
  } catch (err) {
    console.error("Hamburg Critical Mass error: " + err.message);
  }
}

// Source 2: ADFC Hamburg events page
async function scrapeAdfcHamburg() {
  let browser;
  try {
    console.log("Hamburg: scraping ADFC Hamburg...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto("https://hamburg.adfc.de/veranstaltungen", { waitUntil: "networkidle2" });

    const events = await page.evaluate(() => {
      const items = document.querySelectorAll(".event-item, .veranstaltung, article, .views-row");
      return Array.from(items).slice(0, 30).map(el => {
        const titleEl = el.querySelector("h2, h3, h4, .title, .field--name-title");
        const linkEl = el.querySelector("a[href]");
        const dateEl = el.querySelector("time, .date, .field--name-field-date");
        const imgEl = el.querySelector("img");
        return {
          title: titleEl ? titleEl.innerText.trim() : "",
          link: linkEl ? linkEl.href : "",
          dateText: dateEl ? (dateEl.getAttribute("datetime") || dateEl.innerText.trim()) : "",
          imgLink: imgEl ? imgEl.src : "",
        };
      }).filter(e => e.title && e.link);
    });

    console.log(`Hamburg ADFC: found ${events.length} events`);
    const now = new Date();

    for (const ev of events) {
      if (!ev.title || !ev.dateText) continue;
      const start = new Date(ev.dateText);
      if (isNaN(start.getTime()) || start < now) continue;
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      await saveEvent({ title: ev.title, start, end, link: ev.link, imgLink: ev.imgLink });
    }
  } catch (err) {
    console.error("Hamburg ADFC error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Source 3: Hamburg Cyclassics (ADAC) + other major events via Radtouren Hamburg
async function scrapeHamburgCyclassics() {
  let browser;
  try {
    console.log("Hamburg: scraping Radtouren Hamburg...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto("https://www.hamburg.de/radfahren/veranstaltungen/", { waitUntil: "networkidle2" });

    const events = await page.evaluate(() => {
      const items = document.querySelectorAll("article, .teaser, li.event");
      return Array.from(items).slice(0, 30).map(el => {
        const titleEl = el.querySelector("h2, h3, h4, .title");
        const linkEl = el.querySelector("a[href]");
        const dateEl = el.querySelector("time, .date");
        const imgEl = el.querySelector("img");
        return {
          title: titleEl ? titleEl.innerText.trim() : "",
          link: linkEl ? linkEl.href : "",
          dateText: dateEl ? (dateEl.getAttribute("datetime") || dateEl.innerText.trim()) : "",
          imgLink: imgEl ? imgEl.src : "",
        };
      }).filter(e => e.title && e.link);
    });

    console.log(`Hamburg.de: found ${events.length} events`);
    const now = new Date();

    for (const ev of events) {
      if (!ev.title || !ev.dateText) continue;
      const start = new Date(ev.dateText);
      if (isNaN(start.getTime()) || start < now) continue;
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      await saveEvent({ title: ev.title, start, end, link: ev.link, imgLink: ev.imgLink });
    }
  } catch (err) {
    console.error("Hamburg.de error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeHamburg() {
  await connectDB();
  await scrapeCriticalMassHamburg();
  await scrapeAdfcHamburg();
  await scrapeHamburgCyclassics();
  console.log("Hamburg scraper: done.");
}

module.exports = scrapeHamburg;
