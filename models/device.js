const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true
  },
  deviceName: {
    type: String,
    required: true
  },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School'
  }
});

module.exports = mongoose.model('Device', deviceSchema);


