const express = require('express');
const {
    createQueueEntry,
    getQueueEntries,
    nextQueueEntry,
    completeQueueEntry,
    cancelQueueEntry,
    getCurrentQueueEntry,
    getNextQueueEntry,
    getQueueByDepartment,
    getQueueByDate,
    getQueueByPatient,
    getQueueByStatus,
    getQueueByPriority
} = require('../controllers/queueController');

const verifyJWT = require('../middlewares/verifyJWT');

const router = express.Router();

// Create a new queue entry
router.post('/create', verifyJWT(['admin', 'doctor']), createQueueEntry);

// Get all queue entries
router.get('/', getQueueEntries);

// Get the next queue entry
router.get('/next', verifyJWT(['admin', 'doctor']), nextQueueEntry);

// Complete a queue entry
router.patch('/complete', verifyJWT(['admin', 'doctor']), completeQueueEntry);

// Cancel a queue entry
router.post('/cancel', verifyJWT(['admin', 'doctor']), cancelQueueEntry);

// Get the current queue entry
router.get('/current', getCurrentQueueEntry);

// get queue based on priority
router.get('/next/:priority', verifyJWT(['admin', 'doctor']), getNextQueueEntry);

// Get queue by department
router.get('/department/:department', verifyJWT(['admin', 'doctor']), getQueueByDepartment);

// Get queue by date
router.get('/date/:date', verifyJWT(['admin', 'doctor']), getQueueByDate);

// Get queue by patient name
router.get('/patient/:patientName', verifyJWT(['admin', 'doctor']), getQueueByPatient);

// Get queue by status
router.get('/status/:status', verifyJWT(['admin', 'doctor']), getQueueByStatus);

// Get queue by priority
router.get('/priority/:priority', verifyJWT(['admin', 'doctor']), getQueueByPriority);

module.exports = router;