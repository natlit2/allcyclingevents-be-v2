// Hamburg cycling events scraper
// Source: criticalmass.in REST API (no browser needed)
const https = require("https");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

const CITY = "Hamburg";

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

async function saveEvent({ title, start, end, link, imgLink }) {
  const found = await Event.findOne({ title, start, city: CITY });
  if (found) {
    console.log(`Hamburg: already exists - ${title}`);
    return;
  }
  const ev = await Event.create({ title, start, end, link, imgLink: imgLink || "", city: CITY });
  console.log(`Hamburg: created - ${ev._id} | ${title}`);
}

async function scrapeHamburg() {
  await connectDB();
  try {
    console.log("Hamburg scraper: fetching Critical Mass rides...");
    const rides = await fetchJSON("https://criticalmass.in/api/ride?city=hamburg");
    if (!Array.isArray(rides)) {
      console.log("Hamburg scraper: unexpected response format");
      return;
    }
    const now = new Date();
    const upcoming = rides.filter((r) => r.dateTime && new Date(r.dateTime) >= now);
    console.log(`Hamburg scraper: ${upcoming.length} upcoming rides found`);
    for (const ride of upcoming) {
      const title = ride.title || "Critical Mass Hamburg";
      const start = new Date(ride.dateTime);
      const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
      const dateStr = start.toISOString().split("T")[0];
      await saveEvent({
        title,
        start,
        end,
        link: `https://criticalmass.in/hamburg/${dateStr}`,
        imgLink: "",
      });
    }
  } catch (err) {
    console.error("Hamburg scraper error: " + err.message);
  }
  console.log("Hamburg scraper: done.");
}

module.exports = scrapeHamburg;
