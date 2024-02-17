const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminUser = require('./models/adminUserModel');

app.use(cors());
app.use(express.json());

const mongoose = require('mongoose');
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => console.log('MongoDB connection established'))
  .catch((err) => console.error('MongoDB connection error:', err));

const Appointment = require('./models/appointmentModel');

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    res.status(201).send(appointment);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find({});
    res.status(200).send(appointments);
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

app.patch('/api/appointments/claim/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail } = req.body;
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
    await appointment.save();

    res.status(200).send({
      message: 'Appointment successfully claimed.',
      claimedAppointment: appointment,
    });
  } catch (error) {
    res.status(500).send({ message: 'An error occurred.', error });
  }
});

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
  const token = req.header('Authorization')?.split(' ')[1]; // Bearer TOKEN

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
