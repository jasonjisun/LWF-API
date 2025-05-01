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
    ref: 'User', // Assuming you're using a 'User' model for patients
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you're using a 'User' model for doctors
    required: true,
  },
  contactInfo: {
    phone: {
      type: String,
      required: true, // Add validation for phone number if needed
    },
    email: {
      type: String,
      required: true, // Add validation for email if needed
      match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'Please enter a valid email address'],
    },
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed','rescheduled', 'cancelled'],
    default: 'pending',
  },
  cancellationNote: {
    type: String,
    default: null,
  },  
});

module.exports = mongoose.model('Appointment', appointmentSchema);
