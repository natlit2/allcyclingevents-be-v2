require("dotenv").config();
const scrapeVeloBerlin = require("./scrapers/veloBerlinScraper");
scrapeVeloBerlin().then(() => { console.log("done"); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
