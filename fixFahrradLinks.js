// Fix 3 events that still have aggregator links
require("dotenv").config();
const https = require("https");
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

const BASE_URL = "https://fahrradtermine-berlin.de";

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

function extractExternalUrl(html) {
  if (!html) return null;
  const matches = html.match(/href=["']([^"'\s]+)["']/gi);
  if (!matches) return null;
  for (const match of matches) {
    const url = match.replace(/href=["']/i, "").replace(/["']$/, "");
    if (url.startsWith("http") && !url.includes("fahrradtermine-berlin.de")) {
      return url;
    }
  }
  return null;
}

(async () => {
  await connectDB();

  // Find all events with aggregator links
  const badEvents = await Event.find({ link: /fahrradtermine-berlin\.de/ });
  console.log("Events to fix:", badEvents.length);

  if (badEvents.length === 0) {
    console.log("Nothing to fix.");
    process.exit(0);
  }

  // Fetch the feed to get descriptions
  const feed = await fetchJSON(BASE_URL + "/feed/json");
  const items = Array.isArray(feed) ? feed : feed.items || [];

  // Build a lookup by title
  const feedByTitle = {};
  items.forEach(ev => {
    if (ev.title) feedByTitle[ev.title] = ev;
  });

  let fixed = 0;
  for (const ev of badEvents) {
    const feedItem = feedByTitle[ev.title];
    const officialLink = feedItem ? extractExternalUrl(feedItem.description) : null;

    ev.link = officialLink || "";
    await ev.save();

    if (officialLink) {
      console.log("Fixed: " + ev.title + " → " + officialLink);
    } else {
      console.log("Cleared (no official link found): " + ev.title);
    }
    fixed++;
  }

  console.log("\nDone. Updated:", fixed);
  process.exit(0);
})();
