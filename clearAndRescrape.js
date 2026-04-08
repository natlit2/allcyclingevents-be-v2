require("dotenv").config();
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

const cmScraper = require("./scrapers/CMscraper");
const fahrradtermineScraper = require("./scrapers/eventbriteScraper");

async function run() {
  await connectDB();
  console.log("Clearing all events from database...");
  await Event.deleteMany({});
  console.log("Database cleared.");

  console.log("Running scrapers...");
  await cmScraper();
  await fahrradtermineScraper();
  console.log("Done. You can now start the server with: node server.js");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
