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
 mobileNo:{
<<<<<<< HEAD
    type: String,
   default: ''
  },
  username:{
    type: String,
   default: '',
=======
    type: Number,
    required: true
  },
  username:{
    type: String,
    required: true,
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    unique:true
  },
  password:{
    type: String,
<<<<<<< HEAD
    default: ''
  },
  email:{
    type: String,
    default: ''
=======
    required: true
  },
  email:{
    type: String,
    required: true
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  }
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


module.exports = mongoose.model('Branch', branchSchema);
