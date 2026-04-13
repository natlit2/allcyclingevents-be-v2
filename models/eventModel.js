const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 255,
  },
  start: {
    type: Date,
  },
  end: {
    type: Date,
  },
  link: {
    type: String,
  },
  imgLink: {
    type: String,
  },
  city: {
    type: String,
    default: "Berlin",
  },
});

const Event = mongoose.model("Event", EventSchema);

module.exports = Event;
