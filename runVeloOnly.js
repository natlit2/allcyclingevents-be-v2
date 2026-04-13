require("dotenv").config();
const connectDB = require("./dbinit");
const veloBerlinScraper = require("./scrapers/veloBerlinScraper");

(async () => {
  await connectDB();
  await veloBerlinScraper();
  console.log("Done.");
  process.exit(0);
})();
