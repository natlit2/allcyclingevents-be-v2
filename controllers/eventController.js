const Event = require("../models/eventModel");
const connectDB = require("../dbinit");
//import your scraper
const getAllEvents = async (req, res) => {
  try {
    const city = req.query.city || "Berlin";
    const events = await Event.find({ city });
    res.status(200).json({
      Events: events,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err,
    });
  }
};

module.exports = { getAllEvents };
