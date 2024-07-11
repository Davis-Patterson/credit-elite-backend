const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  duration: { type: Number, required: true },
  clientName: { type: String },
  clientEmail: { type: String },
  phoneNumber: { type: String },
  message: { type: String },
  available: { type: Boolean, default: true },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
