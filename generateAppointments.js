const mongoose = require('mongoose');
const Appointment = require('./models/appointmentModel');
const moment = require('moment-timezone');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

const generateAppointments = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connection established');

    const slotDuration = 30; // 30 minutes
    const daysToGenerate = 10;

    const timezone = 'America/New_York'; // EST time zone

    const today = moment().tz(timezone);

    for (let day = 0; day < daysToGenerate; day++) {
      const date = today.clone().add(day, 'days').startOf('day');

      for (let hour = 12; hour < 18; hour++) {
        // 12 PM to 6 PM EST
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const appointmentStartDateEST = date
            .clone()
            .set({ hour, minute, second: 0, millisecond: 0 });
          const appointmentStartDateUTC = appointmentStartDateEST
            .clone()
            .tz('UTC');

          const appointmentEndDateUTC = appointmentStartDateUTC
            .clone()
            .add(slotDuration, 'minutes');

          // Check for overlapping appointments
          const overlappingAppointment = await Appointment.findOne({
            date: {
              $gte: appointmentStartDateUTC.toDate(),
              $lt: appointmentEndDateUTC.toDate(),
            },
          });

          if (!overlappingAppointment) {
            const newAppointment = new Appointment({
              date: appointmentStartDateUTC.toDate(),
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
