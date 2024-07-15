// models/child.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const childSchema = new mongoose.Schema({
  childName: {
    type: String,
    required: true,
  },
  parentName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
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
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  dateOfBirth: {
    type: String,
    required: true,
  },
  childAge: {
    type: Number,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ['female', 'male'],
    required: true
  },
  profileImageUrl:{
    type:String,
    required:true
  },
  homeAddress:{
    type:String
  }
});

childSchema.pre('save', async function (next) {
  const child = this;
  if (!child.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(child.password, salt);
    child.password = hashedPassword;
    next();
  } catch (err) {
    return next(err);
  }
});

childSchema.methods.comparePassword = async function (password) {
  try {
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

const Child = mongoose.model('Child', childSchema);
module.exports = Child;
