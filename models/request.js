const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    enum: ['leave']
  },
  startDate: {
    type: String,
    required: function() {
      return this.requestType === 'leave';
    }
  },
  endDate: {
    type: String,
    required: function() {
      return this.requestType === 'leave';
    }
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true,
  },
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true,
  },
  reason: {
    type: String,
    required: true
  },
  absences: [
    {
      date: { type: String },
      isAbsent: { type: Boolean, default: true }
    }
  ]
});

const Request = mongoose.model('Request', requestSchema);
module.exports = Request;
