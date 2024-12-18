const mongoose = require("mongoose");
const { encrypt, decrypt } = require('./cryptoUtils');

const supervisorSchema = new mongoose.Schema({
  supervisorName: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone_no: {
    type:   String,
    required: true,
  },
  aadhar: {
    type: String,
  },
  aadharImage: {
    type: String,
  },
  schoolId: {
    type: String,
  },
  profileImage: {
    type: String,
  },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  registrationDate: { type: Date, default: Date.now },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  deviceId:{type: String, required: true},
  deviceName:{type:String, required: true},
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  statusOfRegister: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});
supervisorSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = encrypt(this.password);
  }
  next();
});
supervisorSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.password);
  return candidatePassword === decryptedPassword;
};
const Supervisor = mongoose.model("Supervisor", supervisorSchema);
module.exports = Supervisor;
