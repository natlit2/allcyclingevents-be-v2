// Critical Mass Berlin scraper
// Uses the free criticalmass.in REST API - no browser/puppeteer needed
const https = require("https");
const Event = require("../models/eventModel");
const connectDB = require("../dbinit");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function scrapeCriticalMass() {
  await connectDB();
  try {
    console.log("Critical Mass scraper: fetching from API...");
    const rides = await fetchJSON("https://criticalmass.in/api/ride?city=berlin");

    if (!Array.isArray(rides)) {
      console.log("Critical Mass API: unexpected response format");
      return;
    }

    const now = new Date();
    const upcoming = rides.filter((r) => r.dateTime && new Date(r.dateTime) >= now);
    console.log(`Critical Mass scraper: ${upcoming.length} upcoming rides found`);

    for (const ride of upcoming) {
      const title = ride.title || "Critical Mass Berlin";
      const startDate = new Date(ride.dateTime);
      // Critical Mass rides typically last 3 hours
      const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
      const dateStr = startDate.toISOString().split("T")[0];
      const link = `https://criticalmass.in/berlin/${dateStr}`;
      // Official Berlin Critical Mass city image
      const imgLink = "https://criticalmass.in/build/images/cities/berlin.jpg";

      const found = await Event.findOne({ title, start: startDate });
      if (found) {
        console.log(`Critical Mass: event already exists - ${title} on ${dateStr}`);
        continue;
      }

      const newEvent = await Event.create({
        title,
        start: startDate,
        end: endDate,
        link,
        imgLink,
        city: "Berlin",
      });
      console.log(`Critical Mass: new event created - ${newEvent._id} (${title})`);
    }
  } catch (err) {
    console.error(`Critical Mass scraper error: ${err.message}`);
  }
}

module.exports = scrapeCriticalMass;
