const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const queueSchema = new Schema({
    date: {
        type: Date,
        required: true,
    },
    department: {
        type: String,
        required: true,
        enum: ['Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 'Hematology', 'Infectious Diseases', 'Nephrology', 'Neurology', 'Oncology', 'Ophthalmology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Pulmonology', 'Rheumatology', 'Urology', 'General Medicine', 'General Surgery', 'ENT', 'Obstetrics and Gynecology', 'Pediatrics', 'Psychiatry', 'Radiology', 'Anesthesiology', 'Pathology', 'Emergency Medicine', 'Appointment', 'Priority'],
    },
    queueNumber: {
        type: Number,
        required: true,
    },
    patientName: {
        type: String,
        required: true,
    },
    department: {
        type: String,
        required: true,
    },
    isCurrent: {
        type: Boolean,
        default: false,
    },
    isNext: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['waiting', 'called', 'completed', 'cancelled'],
        default: 'waiting',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    priority: {
        type: String,
        enum: ['normal', 'high'],
        default: 'normal',
    }},
    { timestamps: true }  
);

module.exports = mongoose.model('Queue', queueSchema);
