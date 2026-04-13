// Check what links fahrradtermine events have in the DB
require("dotenv").config();
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

(async () => {
  await connectDB();
  const events = await Event.find({
    link: /fahrradtermine-berlin\.de/
  }).limit(10);

  console.log("Events with fahrradtermine links:", events.length);
  events.forEach(ev => {
    console.log(" -", ev.title, "→", ev.link);
  });

  // Also show a sample of all links to understand the data
  const sample = await Event.find({}).limit(10).select("title link");
  console.log("\nSample of 10 events and their links:");
  sample.forEach(ev => {
    console.log(" -", ev.title, "→", ev.link || "(no link)");
  });

  process.exit(0);
})();
