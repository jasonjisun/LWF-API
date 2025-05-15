const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
  timeSlot: {
    type: String,
    required: true,
  },
  scheduledDateTime: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contactInfo: {
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'Please enter a valid email address'],
    },
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rescheduled', 'cancelled'],
    default: 'pending',
  },
  cancellation: {
    by: {
      type: String,
      enum: ['patient', 'doctor'],
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    date: {
      type: Date,
      default: null,
    },
  },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
