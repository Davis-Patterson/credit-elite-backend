const mongoose = require('mongoose');
const Appointment = require('./models/appointmentModel');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

const generateAppointments = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connection established');

    const startTime = 12; // 12 PM
    const endTime = 18; // 6 PM
    const slotDuration = 30; // 30 minutes

    const today = new Date();
    const daysToGenerate = 7;

    const formatTime = (date) => {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    for (let day = 0; day < daysToGenerate; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      date.setHours(0, 0, 0, 0);

      for (let hour = startTime; hour < endTime; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const appointmentDate = new Date(date);
          appointmentDate.setHours(hour, minute, 0, 0);

          const endAppointmentDate = new Date(
            appointmentDate.getTime() + slotDuration * 60000
          );

          const existingAppointment = await Appointment.findOne({
            date: appointmentDate,
          });

          if (!existingAppointment) {
            const newAppointment = new Appointment({
              date: appointmentDate,
              timeSlot: `${formatTime(appointmentDate)} - ${formatTime(
                endAppointmentDate
              )}`,
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
