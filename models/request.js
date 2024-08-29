const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    enum: ['leave', 'changeRoute'],
    required: true,
  },
  startDate: {
    type: Date,
    required: function() {
      return this.requestType === 'leave';
    }
  },
  endDate: {
    type: Date,
    required: function() {
      return this.requestType === 'leave';
    }
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true,
  },
  childId : {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true,
  },
  reason: {
    type: String
  },
  newRoute: {
    type: String,
    required: function() {
      return this.requestType === 'changeRoute';
    }
  },
  statusOfRequest : {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
  },
  absences: [
    {
      date: { type: String },
      isAbsent: { type: Boolean, default: true }
    }
  ],
  requestDate: { type: Date, default: Date.now },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
  }
});

const Request = mongoose.model('Request', requestSchema);
module.exports = Request;
