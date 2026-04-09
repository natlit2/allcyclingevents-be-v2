// VeloBerlin annual bike festival scraper
// Scrapes https://veloberlin.com/en/events/
const puppeteer = require("puppeteer");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

const PUPPETEER_OPTS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
};

// Combine a Unix day timestamp with a "HH:MM" time string into a full Date
function buildDateTime(dayTimestamp, timeStr) {
  const base = new Date(parseInt(dayTimestamp) * 1000);
  if (!timeStr) return base;
  const [hours, minutes] = timeStr.split(":").map(Number);
  base.setUTCHours(hours, minutes, 0, 0);
  return base;
}

async function scrapeVeloBerlin() {
  await connectDB();
  let browser;
  try {
    console.log("VeloBerlin scraper: launching browser...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto("https://veloberlin.com/en/events/", { waitUntil: "networkidle2" });

    // Wait for event cards to render
    await page.waitForSelector(".kwp-event", { visible: true, timeout: 20000 });

    const events = await page.evaluate(() => {
      const cards = document.querySelectorAll(".kwp-event");
      return Array.from(cards).map(card => {
        // Image: extract URL from slickimage background-image style
        const slickImg = card.querySelector(".slickimage");
        const imgStyle = slickImg ? slickImg.style.backgroundImage : "";
        const imgMatch = imgStyle.match(/url\("?([^")\s]+)"?\)/);
        const imgLink = imgMatch ? imgMatch[1] : "";

        // Title: from heading or title class
        const titleEl = card.querySelector("h2, h3, h4, .kwp-event__title");
        const title = titleEl ? titleEl.innerText.trim() : "";

        // Link: first anchor in card
        const linkEl = card.querySelector("a[href]");
        const link = linkEl ? linkEl.href : "https://veloberlin.com/en/events/";

        return {
          title,
          imgLink,
          link,
          dayStart: card.dataset.dayStart,
          dayEnd: card.dataset.dayEnd,
          timeStart: card.dataset.timeStart,
          timeEnd: card.dataset.timeEnd,
        };
      });
    });

    console.log("VeloBerlin scraper: found " + events.length + " events");

    const now = new Date();

    for (const ev of events) {
      if (!ev.title || !ev.dayStart) continue;

      const startDate = buildDateTime(ev.dayStart, ev.timeStart);
      if (startDate < now) continue;

      const endDate = ev.timeEnd
        ? buildDateTime(ev.dayEnd || ev.dayStart, ev.timeEnd)
        : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      const found = await Event.findOne({ title: ev.title, start: startDate });
      if (found) {
        console.log("VeloBerlin: already exists - " + ev.title);
        continue;
      }

      const newEvent = await Event.create({
        title: ev.title,
        start: startDate,
        end: endDate,
        link: ev.link,
        imgLink: ev.imgLink,
      });
      console.log("VeloBerlin: created - " + newEvent._id + " | " + ev.title);
    }
  } catch (err) {
    console.error("VeloBerlin scraper error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = scrapeVeloBerlin;
