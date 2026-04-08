// Fahrradtermine Berlin scraper
// Uses free JSON feed from fahrradtermine-berlin.de
const https = require("https");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

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

      // Event page URL: /event/[slug]
      const link = BASE_URL + "/event/" + (ev.slug || ev.id);

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
