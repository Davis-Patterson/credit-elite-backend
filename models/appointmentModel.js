const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  date: Date,
  timeSlot: String,
  available: {
    type: Boolean,
    default: true,
  },
  clientName: {
    type: String,
    default: '',
  },
  clientEmail: {
    type: String,
    default: '',
  },
  phoneNumber: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
