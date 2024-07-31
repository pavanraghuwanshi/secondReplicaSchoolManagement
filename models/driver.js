const mongoose = require("mongoose");
const { encrypt, decrypt } = require('./cryptoUtils'); 

const driverSchema = new mongoose.Schema({
  driverName: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  phone_no: {
    type: Number,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
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

driverSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.encryptedPassword = encrypt(this.password);
    this.password = undefined; 
  }
  next();
});
driverSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.encryptedPassword);
  return candidatePassword === decryptedPassword;
};

const DriverCollection = mongoose.model("driverCollection", driverSchema);
module.exports =  DriverCollection;
