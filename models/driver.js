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
  driverMobile: {
    type: String,
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
  profileImage: {
    type: String,
  },
  schoolId: { // Correct schoolId definition
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  registrationDate: { 
    type: Date, 
    default: Date.now 
  },
  deviceId:{type: String, required: true},
  deviceName:{type:String, required: true},
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  statusOfRegister: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});

driverSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = encrypt(this.password);
  }
  next();
});

driverSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.password);
  return candidatePassword === decryptedPassword;
};

const DriverCollection = mongoose.model("driverCollection", driverSchema);
module.exports =  DriverCollection;
