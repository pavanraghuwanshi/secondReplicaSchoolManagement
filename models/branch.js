const mongoose = require('mongoose');
const { encrypt, decrypt } = require('./cryptoUtils'); 

const branchSchema = new mongoose.Schema({
  branchName: {
    type: String,
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
 schoolMobile:{
    type: String,
   default: ''
  },
  username:{
    type: String,
   default: ''
  },
  password:{
    type: String,
    default: ''
  },
  email:{
    type: String,
    default: ''
  },
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
});


branchSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = encrypt(this.password);
  }
  next();
});

branchSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.password);
  return candidatePassword === decryptedPassword;
};
// Middleware to handle password encryption on `findOneAndUpdate`
branchSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update && update.password) {
    update.password = encrypt(update.password);
  }
  next();
});


module.exports = mongoose.model('Branch', branchSchema);
