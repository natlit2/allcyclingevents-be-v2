// Shared helper: scrape touren-termine.adfc.de listing page for any city/unitKey
const puppeteer = require("puppeteer");
const moment = require("moment");
const Event = require("../models/eventModel");

const BASE_URL = "https://touren-termine.adfc.de";

const PUPPETEER_OPTS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
};

async function scrapeAdfcCity({ unitKey, city, label }) {
  const now = moment().format("YYYY/MM/DD");
  const url = `${BASE_URL}/suche?beginning=${now}&eventType=Radtour&includeSubsidiary=true&unitKey=${unitKey}`;
  let browser;
  try {
    console.log(`${label}: launching browser...`);
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.waitForSelector(".list-group", { visible: true, timeout: 30000 });

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
          for (const t of item.querySelectorAll("small, .list-group-item-text, p, span")) {
            const txt = t.innerText.trim();
            if (/\d{1,2}\.\s*\w+\s*\d{4}/.test(txt)) { dateText = txt; break; }
          }
        }
        results.push({ title, dateText, link: baseURL + href });
      }
      return results;
    }, BASE_URL);

    console.log(`${label}: found ${events.length} events on listing page`);

    for (const ev of events) {
      if (!ev.dateText) continue;
      // Parse "Sa. 10. Mai 2026 09:00 - 17:00"
      const parts = ev.dateText.split(". ");
      if (parts.length < 3) continue;
      const timeParts = parts[2].split(" - ");
      const dateToFormat = parts[1] + ". " + timeParts[0];
      const parsed = moment(dateToFormat, "DD. MMMM YYYY HH:mm", "de");
      if (!parsed.isValid()) continue;
      const start = parsed.toISOString();
      const end = moment(start).add(2, "h").toISOString();

      const found = await Event.findOne({ title: ev.title, start, city });
      if (found) { console.log(`${label}: already exists - ${ev.title}`); continue; }

      const created = await Event.create({ title: ev.title, start, end, link: ev.link, imgLink: "", city });
      console.log(`${label}: created - ${created._id} | ${ev.title}`);
    }
  } catch (err) {
    console.error(`${label} error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = scrapeAdfcCity;
