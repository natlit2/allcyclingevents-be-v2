// Mellow Park Berlin events scraper
// Scrapes https://www.mellowpark.de/events.html for BMX/cycling events
const puppeteer = require("puppeteer");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

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

// German month name to number mapping
const GERMAN_MONTHS = {
  Jan: "01", Feb: "02", Mär: "03", Apr: "04", Mai: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Okt: "10", Nov: "11", Dez: "12",
};

function parseGermanDate(str) {
  // Expected format: "9. Mai 2026" or "9. Mai 2026 – 10. Mai 2026"
  const clean = str.includes("–") ? str.substring(0, str.indexOf("–")).trim() : str.trim();
  const parts = clean.split(" ");
  if (parts.length < 3) return null;
  const day = parts[0].replace(".", "").padStart(2, "0");
  const month = GERMAN_MONTHS[parts[1]];
  const year = parts[2];
  if (!month) return null;
  return new Date(`${year}-${month}-${day}`);
}

function parseGermanEndDate(str) {
  if (!str.includes("–")) return null;
  const endPart = str.substring(str.indexOf("–") + 1).trim();
  return parseGermanDate(endPart);
}

async function scrapeAllEvents() {
  await connectDB();
  let browser;
  try {
    console.log("Mellow Park scraper: launching browser...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto("https://www.mellowpark.de/events.html", { waitUntil: "networkidle2" });

    // Get all event links on the page
    const eventLinks = await page.evaluate(() => {
      // Try multiple selectors for event links
      const selectors = [
        "#events a.readmore",
        "#events .more a",
        "#events .teaser a",
        "#events p.more a",
        "#events > div > div > div.mod_eventlist a",
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) return Array.from(els).map((el) => el.href);
      }
      // Fallback: find all links in the events section
      const eventSection = document.querySelector("#events");
      if (eventSection) {
        return Array.from(eventSection.querySelectorAll("a[href]"))
          .map((el) => el.href)
          .filter((h) => h.includes("mellowpark.de/events"));
      }
      return [];
    });

    console.log("Mellow Park scraper: found " + eventLinks.length + " event links");

    for (const eventLink of eventLinks) {
      console.log("Mellow Park: visiting " + eventLink);
      const eventPage = await browser.newPage();
      try {
        await eventPage.setDefaultNavigationTimeout(60000);
        await eventPage.goto(eventLink, { waitUntil: "networkidle2" });

        // Scrape title
        const titleEl = await eventPage.evaluate(() => {
          const h = document.querySelector("#events-detail h2, #events-detail h1, .ce_text h2");
          return h ? h.innerText.trim() : null;
        });
        if (!titleEl) {
          console.log("Mellow Park: no title found, skipping");
          await eventPage.close();
          continue;
        }
        console.log("Mellow Park: title = " + titleEl);

        // Scrape date
        const dateStr = await eventPage.evaluate(() => {
          const timeEl = document.querySelector("#events-detail time, .event time");
          if (timeEl) return timeEl.innerText.trim();
          // Fallback: look for date text patterns
          const pEls = document.querySelectorAll("#events-detail p");
          for (const p of pEls) {
            if (/\d+\. [A-Za-zÄäÖöÜü]+ \d{4}/.test(p.innerText)) return p.innerText.trim();
          }
          return null;
        });
        if (!dateStr) {
          console.log("Mellow Park: no date found, skipping");
          await eventPage.close();
          continue;
        }
        console.log("Mellow Park: date = " + dateStr);

        const startDate = parseGermanDate(dateStr);
        if (!startDate || isNaN(startDate.getTime())) {
          console.log("Mellow Park: could not parse date: " + dateStr);
          await eventPage.close();
          continue;
        }

        const parsedEnd = parseGermanEndDate(dateStr);
        const endDate = parsedEnd || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

        // Scrape image
        let imgLink = "";
        try {
          imgLink = await eventPage.evaluate(() => {
            const img = document.querySelector(
              "#events-detail figure img, .event figure img, #events-detail img"
            );
            return img ? img.src : "";
          });
        } catch (_) {
          // Image is optional
        }

        // BUG FIX: was "return" which stopped entire loop. Changed to "continue".
        const found = await Event.findOne({ title: titleEl, start: startDate });
        if (found) {
          console.log("Mellow Park: event already exists - " + titleEl);
          await eventPage.close();
          continue;
        }

        const newEvent = await Event.create({
          title: titleEl,
          start: startDate,
          end: endDate,
          link: eventLink,
          imgLink: imgLink,
        });
        console.log("Mellow Park: new event created - " + newEvent._id);
      } catch (err) {
        console.error("Mellow Park: error on " + eventLink + ": " + err.message);
      }
      await eventPage.close();
    }
  } catch (err) {
    console.error("Mellow Park scraper error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = scrapeAllEvents;
