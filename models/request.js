const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    enum: ['leave', 'pickup', 'drop', 'absent'],
    required: true,
  },
  startDate: {
    type: Date,
    required: function() { 
      return this.requestType === 'leave' || this.requestType === 'pickup' || this.requestType === 'drop'; 
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
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true,
  },
  reason: {
    type: String
  },
  isAbsent: {
    type: Boolean,
    default: undefined, // Do not set a default value here
    required: function() {
      return this.requestType === 'absent';
    }
  }
});

const Request = mongoose.model('Request', requestSchema);
module.exports = Request;
