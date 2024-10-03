const mongoose = require("mongoose");

const geofencingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  area: {
    type: String,
    required: true, 
  },
  isCrossed: {
    type: Boolean,
    default: false
  },
  deviceId: {
    type: String,
    required: true
  },
  busStopTime:{
    type: String,
    required: true
  },
  arrivalTime:{
    type: String
  },
  departureTime:{
    type: String
  }
});

const Geofencing = mongoose.model("Geofencing", geofencingSchema);
module.exports = Geofencing;
