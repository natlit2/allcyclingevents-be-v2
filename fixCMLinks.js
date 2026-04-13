require("dotenv").config();
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

const KNOWN_LINKS = {
  "Critical Mass Berlin": "https://criticalmass.in/berlin",
  "Critical Mass Potsdam": "https://criticalmass.in/potsdam",
  "Kidical Mass Tempelhof": "https://kidical-mass.de",
};

(async () => {
  await connectDB();

  for (const [title, link] of Object.entries(KNOWN_LINKS)) {
    const result = await Event.updateMany(
      { title, link: { $in: ["", null, undefined] } },
      { $set: { link } }
    );
    console.log(`${title}: updated ${result.modifiedCount} event(s) → ${link}`);
  }

  console.log("Done.");
  process.exit(0);
})();
