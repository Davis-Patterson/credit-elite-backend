const mongoose = require('mongoose');
const Appointment = require('./models/appointmentModel');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

const convertESTtoUTC = (date) => {
  const utcDate = new Date(date);
  utcDate.setHours(utcDate.getHours() + 5); // Convert EST to UTC (EST+5)
  return utcDate;
};

const generateAppointments = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connection established');

    const startTime = 12; // 12 PM EST
    const endTime = 18; // 6 PM EST
    const slotDuration = 30; // 30 minutes

    const today = new Date();
    const daysToGenerate = 10;

    const formatTime = (start, end) => {
      const startHour = start
        .toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        .replace(/ (AM|PM)/, '');

      const endHour = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return `${startHour} - ${endHour}`;
    };

    for (let day = 0; day < daysToGenerate; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      date.setHours(0, 0, 0, 0);

      for (let hour = startTime; hour < endTime; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const appointmentStartDateEST = new Date(date);
          appointmentStartDateEST.setHours(hour, minute, 0, 0);
          const appointmentStartDateUTC = convertESTtoUTC(
            appointmentStartDateEST
          );

          const appointmentEndDateEST = new Date(
            appointmentStartDateEST.getTime() + slotDuration * 60000
          );
          const appointmentEndDateUTC = convertESTtoUTC(appointmentEndDateEST);

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
