const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const studentSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: true,
  },
  motherName: {
    type: String,
    required: true,
  },
  fatherName: {
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
    type: Number,
    required: true,
  },
  section: {
    type: String,
    required: true,
  }, 
  schoolname: {
    type: String,
    required: true,
  }, 
  mobile: {
    type: Number,
    required: true,
  },
  Studentage: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  pickupPoint: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ['female', 'male'], 
    required: true
  },
  uniqueId: {
    type: String,
    unique: true,
    default: function() {
      return uuidv4();
    }
  }
});

studentSchema.pre('save', async function (next) {
  const student = this;
  if (!student.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(student.password, salt);
    student.password = hashedPassword;
    next();
  } catch (err) {
    return next(err);
  }
});

studentSchema.methods.comparePassword = async function (password) {
  try {
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

const Student = mongoose.model('Student', studentSchema);
module.exports = Student;
