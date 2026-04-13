require("dotenv").config();
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

(async () => {
  await connectDB();
  const events = await Event.find({
    title: { $regex: /critical|kidical/i }
  }).select("title link start");

  console.log("Critical/Kidical Mass events:", events.length);
  events.forEach(ev => {
    console.log(" -", ev.title, "(" + ev.start.toISOString().split("T")[0] + ")", "→", ev.link || "(no link)");
  });
  process.exit(0);
})();
