const Log = require('../models/logsModel');

exports.createLog = async (req, res) => {
  try {
    const { action, role, email, ip, endpoint } = req.body;
    const log = await Log.create({ action, role, email, ip, endpoint });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create log', error: err.message });
  }
};

// Get all logs
exports.getAllLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs', error: err.message });
  }
};
