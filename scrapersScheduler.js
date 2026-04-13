// Scrapers scheduler - runs all scrapers once at startup and then daily at 12:00 UTC
const schedule = require("node-schedule");

const adfcScraper = require("./scrapers/newAdfcScraper");
const cmScraper = require("./scrapers/CMscraper");
const fahrradtermineScraper = require("./scrapers/eventbriteScraper");
const mellowParkScraper = require("./scrapers/newMellowParkScraper");
const veloBerlinScraper = require("./scrapers/veloBerlinScraper");
const hamburgScraper = require("./scrapers/hamburgScraper");

// Run all scrapers in sequence, catching errors so one failure doesn't stop others
async function runAllScrapers() {
  console.log("=== Starting all scrapers ===");
  try { await cmScraper(); } catch (e) { console.error("CMscraper failed:", e.message); }
  try { await fahrradtermineScraper(); } catch (e) { console.error("Fahrradtermine scraper failed:", e.message); }
  try { await adfcScraper(); } catch (e) { console.error("ADFC scraper failed:", e.message); }
  try { await mellowParkScraper(); } catch (e) { console.error("MellowPark scraper failed:", e.message); }
  try { await veloBerlinScraper(); } catch (e) { console.error("VeloBerlin scraper failed:", e.message); }
  try { await hamburgScraper(); } catch (e) { console.error("Hamburg scraper failed:", e.message); }
  console.log("=== All scrapers finished ===");
}

// Run once immediately when the server starts
runAllScrapers();

// Then schedule to run daily at 12:00 UTC
const rule = new schedule.RecurrenceRule();
rule.hour = 12;
rule.minute = 0;

const job = schedule.scheduleJob(rule, () => {
  console.log("Scheduled scraper run starting...");
  runAllScrapers();
});

// Graceful shutdown on process exit (not on startup)
process.on("SIGTERM", () => schedule.gracefulShutdown());
process.on("SIGINT", () => schedule.gracefulShutdown());

module.exports = schedule;
