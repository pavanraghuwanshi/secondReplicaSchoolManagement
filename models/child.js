const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  childName: {
    type: String,
    required: true,
  },
  class: {
    type: String,
    required: true,
  },
  rollno: {
    type: String,
    required: true,
  },
  section: {
    type: String,
    required: true,
  },
  schoolName: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: String,
    required: true
  },
  childAge: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['female', 'male'],
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true,
  },
  vehicleId: { type: String, default: null },
  registrationDate: { type: Date, default: Date.now }
});

const Child = mongoose.model('Child', childSchema);
module.exports = Child;
