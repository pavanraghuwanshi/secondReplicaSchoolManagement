const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
  },
  date: {
    type: String,
    required: true
  },
  pickup: { 
    type: Boolean, 
    default: null 
  },
  drop: { 
    type: Boolean, 
    default: null 
  },
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
