// One-time migration: tag all existing events without a city as "Berlin"
require("dotenv").config();
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

(async () => {
  await connectDB();
  const result = await Event.updateMany(
    { city: { $in: [null, undefined, ""] } },
    { $set: { city: "Berlin" } }
  );
  console.log("Tagged as Berlin:", result.modifiedCount, "events");
  process.exit(0);
})();
