const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const verifyJWT = require('../middlewares/verifyJWT');

// Protected: Get all logs (e.g., only admin)
router.get('/', verifyJWT(['admin']), logsController.getAllLogs);

// Optional: Allow manual creation of logs
router.post('/', verifyJWT(), logsController.createLog);

module.exports = router;