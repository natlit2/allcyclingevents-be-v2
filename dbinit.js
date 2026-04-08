const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  // If already connected, do nothing
  if (mongoose.connection.readyState >= 1) return;
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
};

module.exports = connectDB;
