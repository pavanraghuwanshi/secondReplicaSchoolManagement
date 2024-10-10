const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  childName: { type: String, required: true },
  class: { type: String, required: true },
  rollno: { type: String, required: true },
  section: { type: String, required: true },
  dateOfBirth: { type: String, required: true },
  childAge: { type: Number, required: true },
  pickupPoint:{type: String},
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, 
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  gender: { type: String, enum: ['female', 'male'], required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true },
  deviceId:{type: String, required: true},
  deviceName:{type:String, required: true},
  registrationDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Child', childSchema);
