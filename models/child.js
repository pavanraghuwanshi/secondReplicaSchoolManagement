const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  childName: {
    type: String,
    required: true,
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
    required: true
  },
  dateOfBirth: {
    type: String,
    required: true
  },
  childAge: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['female', 'male'],
    required: true

  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true,

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

const Child = mongoose.model('Child', childSchema);
module.exports = Child;
