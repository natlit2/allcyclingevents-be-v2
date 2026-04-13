// One-time script: remove duplicate events (same title + same date + same city)
// Keeps the earliest-created duplicate, removes the rest
require("dotenv").config();
const connectDB = require("./dbinit");
const Event = require("./models/eventModel");

async function deduplicate() {
  await connectDB();

  const all = await Event.find({}).lean();
  console.log(`Total events before dedup: ${all.length}`);

  // Group by title + city + date (YYYY-MM-DD)
  const seen = {};
  const toDelete = [];

  for (const ev of all) {
    const dateKey = new Date(ev.start).toISOString().slice(0, 10);
    const key = `${ev.city}|${ev.title}|${dateKey}`;
    if (seen[key]) {
      toDelete.push(ev._id);
    } else {
      seen[key] = true;
    }
  }

  console.log(`Duplicates to remove: ${toDelete.length}`);
  if (toDelete.length > 0) {
    await Event.deleteMany({ _id: { $in: toDelete } });
    console.log("Duplicates removed.");
  }

  const remaining = await Event.countDocuments();
  console.log(`Total events after dedup: ${remaining}`);
  process.exit(0);
}

deduplicate().catch((e) => { console.error(e); process.exit(1); });
