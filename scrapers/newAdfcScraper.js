// ADFC Berlin guided cycling tours scraper
// Scrapes https://touren-termine.adfc.de for Berlin cycling tours
const puppeteer = require("puppeteer");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");
const moment = require("moment");

// Berlin ADFC unit key is 154
const ADFC_URL = () => {
  const now = moment(new Date()).format("YYYY/MM/DD");
  return `https://touren-termine.adfc.de/suche?beginning=${now}&eventType=Radtour&includeSubsidiary=true&unitKey=154`;
};

const BASE_URL = "https://touren-termine.adfc.de";

// Windows-compatible puppeteer launch options
const PUPPETEER_OPTS = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
};

async function scrapeAllEvents() {
  await connectDB();
  let browser;
  try {
    console.log("ADFC scraper: launching browser...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(ADFC_URL(), { waitUntil: "networkidle2" });

    await page.waitForSelector(".list-group", { visible: true, timeout: 30000 });

    // Extract all event data directly from the listing page
    const events = await page.evaluate((baseURL) => {
      const items = document.querySelectorAll(".list-group-item");
      const results = [];
      for (const item of items) {
        const linkEl = item.querySelector("a");
        const href = linkEl ? linkEl.getAttribute("href") : null;
        if (!href) continue;

        // Title: try h4, h5, strong, or fallback to link text
        const titleEl =
          item.querySelector("h4") ||
          item.querySelector("h5") ||
          item.querySelector(".list-group-item-heading") ||
          item.querySelector("strong") ||
          linkEl;
        const title = titleEl ? titleEl.innerText.trim() : null;
        if (!title) continue;

        // Date: look for a dd or a .list-group-item-text or any element with date-like text
        let dateText = null;
        const dds = item.querySelectorAll("dd");
        if (dds.length > 1) {
          dateText = dds[1].innerText.trim();
        } else if (dds.length === 1) {
          dateText = dds[0].innerText.trim();
        } else {
          // Try any small/span/p that looks like a date
          const texts = item.querySelectorAll("small, .list-group-item-text, p, span");
          for (const t of texts) {
            const txt = t.innerText.trim();
            if (/\d{1,2}\.\s*\w+\s*\d{4}/.test(txt)) {
              dateText = txt;
              break;
            }
          }
        }

        results.push({
          title,
          dateText,
          link: baseURL + href,
        });
      }
      return results;
    }, BASE_URL);

    console.log("ADFC scraper: found " + events.length + " events on listing page");

    for (const ev of events) {
      if (!ev.dateText) {
        console.log("ADFC scraper: no date for '" + ev.title + "', skipping");
        continue;
      }

      // Parse date: format like "Sa. 10. Mai 2026 09:00 - 17:00"
      const parts = ev.dateText.split(". ");
      if (parts.length < 3) {
        console.log("ADFC scraper: unexpected date format: " + ev.dateText);
        continue;
      }
      const timeParts = parts[2].split(" - ");
      const dateToFormat = parts[1] + ". " + timeParts[0];
      const parsedMoment = moment(dateToFormat, "DD. MMMM YYYY HH:mm", "de");
      if (!parsedMoment.isValid()) {
        console.log("ADFC scraper: could not parse date: " + dateToFormat);
        continue;
      }
      const formatedDate = parsedMoment.toISOString();
      const endDate = moment(formatedDate).add(2, "h").toISOString();

      const found = await Event.findOne({ title: ev.title, start: formatedDate });
      if (found) {
        console.log("ADFC: event already exists - " + ev.title);
        continue;
      }

      const newEvent = await Event.create({
        title: ev.title,
        start: formatedDate,
        end: endDate,
        link: ev.link,
        imgLink: "",
        city: "Berlin",
      });
      console.log("ADFC: new event created - " + newEvent._id);
    }
  } catch (err) {
    console.error("ADFC scraper error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = scrapeAllEvents;
