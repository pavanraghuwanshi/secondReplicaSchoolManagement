const mongoose = require("mongoose");

const geofencingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: null,
  },
  area: {
    type: String,
    required: true, 
  },
  calendarId: {
    type: Number,
    required: true,
  },
  attributes: {
    type: Map,
    of: String,  
    default: {},
  },
  isCrossed: {
    type: Boolean,
    default: false
  },
  deviceId: {
    type: String,
    required: true
  }
});

const Geofencing = mongoose.model("Geofencing", geofencingSchema);
module.exports = Geofencing;
