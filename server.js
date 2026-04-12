require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const connectDB = require("./dbinit");
const events = require("./routes/eventRoute");
const cors = require("cors");

app.use(cors());
app.use(express.json());

app.use("/events", events);

app.get("/", (req, res) => {
  res.send("Allcyclingevents-berlin server is up and running!");
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await connectDB();
    require("./scrapersScheduler");
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    console.error("Check your MONGO_URI in .env and that your MongoDB Atlas cluster is active.");
  }
});
