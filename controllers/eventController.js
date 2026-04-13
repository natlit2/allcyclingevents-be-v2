const Event = require("../models/eventModel");
const connectDB = require("../dbinit");
//import your scraper
const getAllEvents = async (req, res) => {
  try {
    const city = req.query.city || "Berlin";
    // For Berlin: also include legacy events with no city field
    // For other cities: strict match only
    const query = city === "Berlin"
      ? { $or: [{ city: "Berlin" }, { city: { $exists: false } }, { city: null }, { city: "" }] }
      : { city };
    const events = await Event.find(query);
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
