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
    type: Number,
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
  parentRegistrationDate: { type: Date, default: Date.now }
});

// parentSchema.pre('save', async function (next) {
//   const parent = this;
//   if (!parent.isModified('password')) return next();
//   try {
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(parent.password, salt);
//     parent.password = hashedPassword;
//     next();
//   } catch (err) {
//     return next(err);
//   }
// });
// parentSchema.methods.comparePassword = async function (password) {
//   try {
//     const isMatch = await bcrypt.compare(password, this.password);
//     return isMatch;
//   } catch (err) {
//     throw err;
//   }
// };

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
