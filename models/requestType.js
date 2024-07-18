const mongoose = require('mongoose');

const requestOfChildSchema = new mongoose.Schema({
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true,
  },
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String
  },
  reason: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const RequestOfChild = mongoose.model('RequestOfChild', requestOfChildSchema);
module.exports = RequestOfChild;
