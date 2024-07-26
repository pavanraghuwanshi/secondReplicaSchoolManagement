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
    required: true
  },
  date: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    required: true
  }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
