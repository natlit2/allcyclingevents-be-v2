// ADFC Berlin guided cycling tours scraper — unitKey 154
const connectDB = require("../dbinit");
const scrapeAdfcCity = require("./adfcScrapeHelper");

async function scrapeAllEvents() {
  await connectDB();
  await scrapeAdfcCity({ unitKey: 154, city: "Berlin", label: "ADFC Berlin" });
}

module.exports = scrapeAllEvents;
