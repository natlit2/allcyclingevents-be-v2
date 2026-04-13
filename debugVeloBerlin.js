// Run this script to diagnose what the VeloBerlin scraper sees
// node debugVeloBerlin.js
const puppeteer = require("puppeteer");

const PUPPETEER_OPTS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
};

async function debug() {
  let browser;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch(PUPPETEER_OPTS);
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    console.log("Navigating to VeloBerlin events page...");
    await page.goto("https://veloberlin.com/en/events/", { waitUntil: "networkidle2" });

    // Check if .kwp-event exists
    const cardCount = await page.$$eval(".kwp-event", els => els.length).catch(() => 0);
    console.log(".kwp-event cards found:", cardCount);

    if (cardCount === 0) {
      // Show what selectors ARE present
      const bodySnippet = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
      console.log("\nPage HTML snippet (first 2000 chars):");
      console.log(bodySnippet);
    } else {
      // Show first 3 events with all data
      const events = await page.evaluate(() => {
        const cards = document.querySelectorAll(".kwp-event");
        return Array.from(cards).slice(0, 3).map(card => {
          const slickImg = card.querySelector(".slickimage");
          const imgStyle = slickImg ? slickImg.style.backgroundImage : "(no .slickimage)";
          const imgMatch = imgStyle.match(/url\("?([^")\s]+)"?\)/);

          const titleEl = card.querySelector("h2, h3, h4, .kwp-event__title");

          return {
            title: titleEl ? titleEl.innerText.trim() : "(no title)",
            imgStyle,
            imgLink: imgMatch ? imgMatch[1] : "(no match)",
            link: card.querySelector("a[href]") ? card.querySelector("a[href]").href : "(no link)",
            dayStart: card.dataset.dayStart || "(missing)",
            dayEnd: card.dataset.dayEnd || "(missing)",
            timeStart: card.dataset.timeStart || "(missing)",
            timeEnd: card.dataset.timeEnd || "(missing)",
          };
        });
      });

      const now = new Date();
      console.log("\nNow:", now.toISOString());
      console.log("\nFirst 3 events raw data:");
      events.forEach((ev, i) => {
        console.log(`\n--- Event ${i + 1} ---`);
        console.log("title:", ev.title);
        console.log("imgLink:", ev.imgLink);
        console.log("link:", ev.link);
        console.log("dayStart:", ev.dayStart);
        const parsed = ev.dayStart !== "(missing)" ? new Date(parseInt(ev.dayStart) * 1000) : null;
        console.log("dayStart as Date:", parsed ? parsed.toISOString() : "N/A");
        console.log("timeStart:", ev.timeStart);
        console.log("dayEnd:", ev.dayEnd);
        console.log("timeEnd:", ev.timeEnd);
        if (parsed) {
          console.log("Is in future:", parsed > now ? "YES" : "NO (FILTERED OUT)");
        }
      });

      // Count how many pass the future filter
      const allEvents = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".kwp-event")).map(card => ({
          title: card.querySelector("h2, h3, h4, .kwp-event__title")?.innerText?.trim() || "",
          dayStart: card.dataset.dayStart || "",
        }))
      );
      const future = allEvents.filter(ev => ev.dayStart && new Date(parseInt(ev.dayStart) * 1000) > now);
      console.log(`\nTotal cards: ${allEvents.length}`);
      console.log(`Future events (would be saved): ${future.length}`);
      if (future.length > 0) {
        console.log("First future event:", future[0].title, "→", new Date(parseInt(future[0].dayStart) * 1000).toISOString());
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

debug();
