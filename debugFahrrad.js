// Check what fields the fahrradtermine feed provides
require("dotenv").config();
const https = require("https");

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

(async () => {
  const feed = await fetchJSON("https://fahrradtermine-berlin.de/feed/json");
  const items = Array.isArray(feed) ? feed : feed.items || [];
  console.log("Total items:", items.length);
  console.log("\nAll fields on first 3 items:");
  items.slice(0, 3).forEach((ev, i) => {
    console.log(`\n--- Item ${i + 1} ---`);
    console.log(JSON.stringify(ev, null, 2));
  });
})();
