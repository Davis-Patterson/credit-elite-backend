const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const AdminUser = require('./models/adminUserModel');
const Appointment = require('./models/appointmentModel');

app.use(cors());
app.use(express.json());

const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => console.log('MongoDB connection established'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.post('/api/admin/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = new AdminUser({
      username,
      password: hashedPassword,
    });

    await newAdmin.save();
    res.status(201).send('Admin registered successfully.');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await AdminUser.findOne({ username });

    if (!admin) {
      return res.status(404).send('Admin not found.');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).send('Invalid credentials.');
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).send(error);
  }
});

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) return res.status(401).send('Access Denied');

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = verified;
    next();
  } catch (error) {
    res.status(400).send('Invalid Token');
  }
};

app.get('/api/protected-route', verifyToken, (req, res) => {
  res.send('Protected route accessed.');
});

app.post('/api/appointments', async (req, res) => {
  try {
    let appointmentDate = new Date(req.body.date);
    const duration = req.body.duration;
    appointmentDate.setHours(appointmentDate.getHours() + 5); // Convert EST to UTC (EST+5)

    const appointment = new Appointment({
      date: appointmentDate,
      duration: duration,
    });

    await appointment.save();

    await removeOverlappingAppointments();

    res.status(201).send(appointment);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find({});
    const estAppointments = appointments.map((appointment) => {
      const utcDate = new Date(appointment.date);
      const estDate = new Date(utcDate);
      estDate.setHours(estDate.getHours() - 5); // Convert UTC to EST (UTC-5)
      return {
        ...appointment.toObject(),
        date: estDate,
      };
    });

    // Format the appointments to only have one 'PM' for each time slot
    const formattedAppointments = estAppointments.map((appointment) => {
      const startHour = new Date(appointment.date);
      const endHour = new Date(
        appointment.date.getTime() + appointment.duration * 60000
      );
      appointment.formattedTime = formatTime(startHour, endHour);
      return appointment;
    });

    res.status(200).send(formattedAppointments);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Appointment.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).send({ message: 'Appointment not found.' });
    }
    res.status(200).send({
      message: 'Appointment successfully deleted.',
      deletedAppointment: result,
    });
  } catch (error) {
    res.status(500).send({
      message: 'An error occurred while deleting the appointment.',
      error: error,
    });
  }
});

app.delete('/api/appointments', async (req, res) => {
  try {
    const result = await Appointment.deleteMany({});
    res.status(200).send({
      message: 'All appointments successfully deleted.',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).send({
      message: 'An error occurred while deleting all appointments.',
      error: error,
    });
  }
});

app.patch('/api/appointments/claim/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail, phoneNumber, message } = req.body;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).send({ message: 'Appointment not found.' });
    }

    if (!appointment.available) {
      return res
        .status(400)
        .send({ message: 'Appointment is already claimed.' });
    }

    appointment.available = false;
    appointment.clientName = clientName;
    appointment.clientEmail = clientEmail;
    appointment.phoneNumber = phoneNumber;
    appointment.message = message;
    await appointment.save();

    res.status(200).send({
      message: 'Appointment successfully claimed.',
      claimedAppointment: appointment,
    });
  } catch (error) {
    res.status(500).send({ message: 'An error occurred.', error });
  }
});

app.delete('/api/appointments/delete/past', async (req, res) => {
  try {
    const currentDateTime = new Date();
    const result = await Appointment.deleteMany({
      date: { $lt: currentDateTime },
    });

    res.status(200).send({
      message: 'Past appointments successfully deleted.',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).send({
      message: 'An error occurred while deleting past appointments.',
      error: error,
    });
  }
});

// Function to check for and remove overlapping appointments
const removeOverlappingAppointments = async () => {
  try {
    const appointments = await Appointment.find({});
    const appointmentsByDate = {};

    // Group appointments by date
    appointments.forEach((appointment) => {
      const dateKey = appointment.date.toISOString();
      if (!appointmentsByDate[dateKey]) {
        appointmentsByDate[dateKey] = [];
      }
      appointmentsByDate[dateKey].push(appointment);
    });

    // Check for overlapping appointments
    for (const dateKey in appointmentsByDate) {
      const dailyAppointments = appointmentsByDate[dateKey];
      dailyAppointments.sort((a, b) => a.date - b.date);

      for (let i = 0; i < dailyAppointments.length - 1; i++) {
        const current = dailyAppointments[i];
        const next = dailyAppointments[i + 1];

        const currentEndTime = new Date(
          current.date.getTime() + current.duration * 60000
        ); // Dynamic duration
        if (currentEndTime > next.date) {
          // Overlap detected
          if (current.available && !next.available) {
            await Appointment.findByIdAndDelete(current._id);
          } else if (!current.available && next.available) {
            await Appointment.findByIdAndDelete(next._id);
          } else if (current.available && next.available) {
            await Appointment.findByIdAndDelete(next._id);
          }
        }
      }
    }

    console.log('Overlapping appointments removed successfully');
  } catch (error) {
    console.error('Error removing overlapping appointments:', error);
  }
};

// Update admin password
app.patch('/api/admin/update-password', verifyToken, async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).send('Username and new password are required.');
    }

    const admin = await AdminUser.findOne({ username });

    if (!admin) {
      return res.status(404).send('Admin not found.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    admin.password = hashedPassword;

    await admin.save();

    res.status(200).send('Password updated successfully.');
  } catch (error) {
    res.status(500).send('An error occurred while updating the password.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

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
