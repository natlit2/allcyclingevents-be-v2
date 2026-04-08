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

    const eventLinks = await page.evaluate(() => {
      const listGroup = document.querySelectorAll(".list-group a");
      const links = [];
      for (const link of listGroup) {
        links.push(link.getAttribute("href"));
      }
      return links;
    });

    console.log("ADFC scraper: found " + eventLinks.length + " event links");

    for (const eventLink of eventLinks) {
      const baseURL = "https://touren-terme.adfc.de";
      const fullEventLink = baseURL + eventLink;
      const eventPage = await browser.newPage();
      try {
        await eventPage.setDefaultNavigationTimeout(60000);
        await eventPage.goto(fullEventLink, { waitUntil: "networkidle2" });

        await eventPage.waitForSelector("h1", { visible: true, timeout: 15000 });
        const titleEl = await eventPage.evaluate(() => {
          const el = document.querySelector("h1");
          return el ? el.innerText.trim() : null;
        });
        if (!titleEl) {
          console.log("ADFC scraper: no title found, skipping");
          await eventPage.close();
          continue;
        }
        console.log("ADFC: title = " + titleEl);

        const dateElement = await eventPage.evaluate(() => {
          const dds = document.querySelectorAll("dd");
          return dds[1] ? dds[1].innerText.trim() : null;
        });
        if (!dateElement) {
          console.log("ADFC scraper: no date found, skipping");
          await eventPage.close();
          continue;
        }
        console.log("ADFC: date = " + dateElement);

        // Parse the date: format like "Sa. 10. Mai 2026 09:00 - 17:00"
        const parts = dateElement.split(". ");
        if (parts.length < 3) {
          console.log("ADFC scraper: unexpected date format: " + dateElement);
          await eventPage.close();
          continue;
        }
        const timeParts = parts[2].split(" - ");
        const dateToFormat = parts[1] + ". " + timeParts[0];
        const parsedMoment = moment(dateToFormat, "DD. MMMM YYYY HH:mm", "de");
        if (!parsedMoment.isValid()) {
          console.log("ADFC scraper: could not parse date: " + dateToFormat);
          await eventPage.close();
          continue;
        }
        const formatedDate = parsedMoment.toISOString();
        const endDate = moment(formatedDate).add(2, "h").toISOString();

        let imgElement = "";
        try {
          await eventPage.waitForSelector("img.pswp__img", { visible: true, timeout: 5000 });
          imgElement = await eventPage.evaluate(() => {
            const imgs = document.querySelectorAll("img.pswp__img");
            return Array.from(imgs).map((v) => v.src)[0] || "";
          });
        } catch (_) {
          // Image is optional
        }

        const found = await Event.findOne({ title: titleEl, start: formatedDate });
        if (found) {
          console.log("ADFC: event already exists - " + titleEl);
          await eventPage.close();
          continue;
        }

        const newEvent = await Event.create({
          title: titleEl,
          start: formatedDate,
          end: endDate,
          link: fullEventLink,
          imgLink: imgElement,
        });
        console.log("ADFC: new event created - " + newEvent._id);
      } catch (err) {
        console.error("ADFC scraper: error on " + fullEventLink + ": " + err.message);
      }
      await eventPage.close();
    }
  } catch (err) {
    console.error("ADFC scraper error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = scrapeAllEvents;
