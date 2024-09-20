const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const { encrypt, decrypt } = require('./cryptoUtils'); 


const parentSchema = new mongoose.Schema({
  parentName: {
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
  phone: {
    type: String,
    required: true,
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child'
  }],
  resetToken: String,
  resetTokenExpires: Date,
  fcmToken: {
    type: String
  },
  statusOfRegister: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  parentRegistrationDate: { type: Date, default: Date.now },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School'},
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
});
parentSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = encrypt(this.password);
  }
  next();
});

parentSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.password);
  return candidatePassword === decryptedPassword;
};

const Parent = mongoose.model('Parent', parentSchema);
module.exports = Parent;

