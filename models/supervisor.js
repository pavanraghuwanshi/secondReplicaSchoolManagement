const mongoose = require("mongoose");
const { encrypt } = require('./cryptoUtils');
const {decrypt} = require('./cryptoUtils');
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
    type: Number,
    required: true,
  },
  aadhar: {
    type: String,
  },
  aadharImage: {
    type: String,
  },
  vehicleId: {
    type: String,
  },
  schoolId: {
    type: String,
  },
  profileImage: {
    type: String,
  },
  encryptedPassword: String
});

supervisorSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.encryptedPassword = encrypt(this.password);
    this.password = undefined; 
  }
  next();
});
supervisorSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.encryptedPassword);
  return candidatePassword === decryptedPassword;
};
const Supervisor = mongoose.model("Supervisor", supervisorSchema);
module.exports = Supervisor;
