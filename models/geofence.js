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
<<<<<<< HEAD
=======
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  }
});

const Geofencing = mongoose.model("Geofencing", geofencingSchema);
module.exports = Geofencing;
