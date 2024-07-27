const mongoose = require('mongoose');
const Appointment = require('./models/appointmentModel');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

const generateAppointments = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connection established');

    const startTimeUTC = 17; // 12 PM EST in UTC (17:00 UTC)
    const endTimeUTC = 23; // 6 PM EST in UTC (23:00 UTC)
    const slotDuration = 30; // 30 minutes

    const today = new Date();
    const daysToGenerate = 10;

    for (let day = 0; day < daysToGenerate; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      date.setHours(0, 0, 0, 0);

      for (let hour = startTimeUTC; hour < endTimeUTC; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const appointmentStartDateUTC = new Date(date);
          appointmentStartDateUTC.setHours(hour, minute, 0, 0);

          const appointmentEndDateUTC = new Date(
            appointmentStartDateUTC.getTime() + slotDuration * 60000
          );

          // Check for overlapping appointments
          const overlappingAppointment = await Appointment.findOne({
            date: {
              $gte: appointmentStartDateUTC,
              $lt: appointmentEndDateUTC,
            },
          });

          if (!overlappingAppointment) {
            const newAppointment = new Appointment({
              date: appointmentStartDateUTC,
              duration: slotDuration, // Store the duration in minutes
              available: true,
            });

            await newAppointment.save();
          }
        }
      }
    }

    console.log('Appointments generated successfully');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error generating appointments:', error);
    mongoose.connection.close();
  }
};

generateAppointments();
