// Fahrradtermine Berlin scraper
// Uses free JSON feed from fahrradtermine-berlin.de
const https = require("https");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

const BASE_URL = "https://fahrradtermine-berlin.de";

// Fallback links for known recurring events with no external URL in description
const KNOWN_LINKS = {
  "Critical Mass Berlin": "https://criticalmass.in/berlin",
  "Critical Mass Potsdam": "https://criticalmass.in/potsdam",
  "Kidical Mass Tempelhof": "https://kidical-mass.de",
  "Kidical Mass": "https://kidical-mass.de",
};

// Extract the first external URL from HTML description, ignoring the aggregator itself
function extractExternalUrl(html) {
  if (!html) return null;
  const matches = html.match(/href=["']([^"'\s]+)["']/gi);
  if (!matches) return null;
  for (const match of matches) {
    const url = match.replace(/href=["']/i, "").replace(/["']$/, "");
    if (
      url.startsWith("http") &&
      !url.includes("fahrradtermine-berlin.de")
    ) {
      return url;
    }
  }
  return null;
}

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

async function scrapeFahrradtermine() {
  await connectDB();
  try {
    console.log("Fahrradtermine scraper: fetching JSON feed...");
    const feed = await fetchJSON(BASE_URL + "/feed/json");
    const items = Array.isArray(feed) ? feed : feed.items || [];
    console.log("Fahrradtermine scraper: " + items.length + " events in feed");

    const now = new Date();

    for (const ev of items) {
      const title = ev.title || ev.name;
      if (!title) continue;

      const startDate = ev.start_datetime ? new Date(ev.start_datetime * 1000) : null;
      if (!startDate || startDate < now) continue;

      const endDate = ev.end_datetime
        ? new Date(ev.end_datetime * 1000)
        : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      // Use official URL from description, fall back to known links, never use aggregator URL
      const link = extractExternalUrl(ev.description) || KNOWN_LINKS[title] || "";

      // Image URL: /media/[filename] 
      let imgLink = "";
      if (ev.media && ev.media.length > 0) {
        const mediaUrl = ev.media[0].url || "";
        imgLink = mediaUrl.startsWith("http") ? mediaUrl : BASE_URL + "/media/" + mediaUrl;
      }

      const found = await Event.findOne({ title, start: startDate });
      if (found) {
        console.log("Fahrradtermine: already exists - " + title);
        continue;
      }

      const newEvent = await Event.create({ title, start: startDate, end: endDate, link, imgLink });
      console.log("Fahrradtermine: created - " + newEvent._id + " | img: " + imgLink);
    }
  } catch (err) {
    console.error("Fahrradtermine scraper error: " + err.message);
  }
}

module.exports = scrapeFahrradtermine;
