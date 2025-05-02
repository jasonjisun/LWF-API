const Queue = require('../models/queueModel');
const Appointment = require('../models/appointmentModel');

exports.createQueueEntry = async (req, res) => {
    try{
        // get queue to get latest queue number
        // const latestQueueEntry = await Queue.findOne({}).sort({ queueNumber: -1 });
        // const queueNumber = latestQueueEntry ? latestQueueEntry.queueNumber + 1 : 1; // Increment the latest queue number or start from 1 if no entries exist

        const { department, patientName } = req.body; // Get department and patient name from request body
        const latestQueueEntry = await Queue.findOne({}).sort({ queueNumber: -1 });
        
        const newEntry = new Queue({
            date: new Date(), // Set the date to today's date
            department,
            queueNumber: latestQueueEntry ? latestQueueEntry.queueNumber + 1 : 1, // Increment the latest queue number or start from 1 if no entries exist
            patientName,
        });

        await newEntry.save(); // Save the new queue entry to the database
        res.status(200).json({
            message: 'Queue entry created successfully',
            queueEntry: {
                date: newEntry.date,
                department: newEntry.department,
                queueNumber: newEntry.queueNumber,
                patientName: newEntry.patientName,
                isCurrent: false, // Default to false
                isNext: false, // Default to false
                status: 'waiting', // Default status
            },
        });

    }catch (error) {
        console.error('Error creating queue entry:', error);
        console.log(error);
        res.status(500).json({ message: 'Error creating queue entry' });
    }
}

exports.getQueueEntries = async (_req, res) => {
    try {
        const queueEntries = await Queue.find({})
            .sort({ date: 1, queueNumber: 1 }); // Sort by date in ascending order, then by queue number in ascending order
        res.status(200).json(queueEntries); // Return the queue entries
    } catch (error) {
        console.error('Error fetching queue entries:', error);
        res.status(500).json({ message: 'Error fetching queue entries' });
    }
}

exports.nextQueueEntry = async (req, res) => {
    try {

        // get current queue entry that is current and not next based on the queue number
        const currentQueueEntry = await Queue.findOne({ isCurrent: true, status: 'called' }); // Find the current queue entry that is not next
        
        if (currentQueueEntry) {
            // Update the current queue entry to set isCurrent to false and isNext to false
            currentQueueEntry.isCurrent = false;
            currentQueueEntry.isNext = false;
            currentQueueEntry.status = 'completed'; // Update status to 'completed'
            await currentQueueEntry.save(); // Save the updated queue entry
        }

        // get the next queue entry that is not current and not next based on the queue number
        const nextQueueEntry = await Queue.findOne({ isCurrent: false, isNext: false, status: 'waiting' }).sort({ queueNumber: 1 }); // Find the next queue entry that is not current and not next

        if (nextQueueEntry) {
            // Update the queue entry to set isCurrent to true and isNext to true
            nextQueueEntry.isCurrent = true;
            nextQueueEntry.isNext = true;
            nextQueueEntry.status = 'called'; // Update status to 'in-progress'
            await nextQueueEntry.save(); // Save the updated queue entry
            res.status(200).json({
                message: 'Next queue entry updated successfully',
                queueEntry: {
                    date: nextQueueEntry.date,
                    department: nextQueueEntry.department,
                    queueNumber: nextQueueEntry.queueNumber,
                    patientName: nextQueueEntry.patientName,
                    isCurrent: nextQueueEntry.isCurrent,
                    isNext: nextQueueEntry.isNext,
                    status: nextQueueEntry.status,
                },
            });
        }else {
            res.status(404).json({ message: 'No next queue entry found' }); // If not found, return 404
        }

    } catch (error) {
        console.error('Error updating queue entry:', error);
        res.status(500).json({ message: 'Error updating queue entry' });
    }
}

exports.completeQueueEntry = async (req, res) => {
    try {
        // get current queue entry that is current and not next based on the queue number
        const queueEntry = await Queue.findOne({ isCurrent: true, status: 'called' }); // Find the current queue entry that is not next
        if (queueEntry) {
            // Update the queue entry to set isCurrent to false and isNext to false
            queueEntry.isCurrent = false;
            queueEntry.isNext = false;
            queueEntry.status = 'completed'; // Update status to 'completed'
            await queueEntry.save(); // Save the updated queue entry

            res.status(200).json({ message: 'Queue entry completed successfully' }); // Return success message

        }
        return res.status(404).json({ message: 'No current queue entry found' }); // If not found, return 404

        
    } catch (error) {
        console.error('Error completing queue entry:', error);
        res.status(500).json({ message: 'Error completing queue entry' });
    }
}

exports.resetQueue = async (req, res) => {
    try {
        // delete all queue entries
        await Queue.deleteMany({}); // Delete all queue entries

        res.status(200).json({ message: 'Queue reset successfully' }); // Return success message

    } catch (error) {
        console.error('Error resetting queue:', error);
        res.status(500).json({ message: 'Error resetting queue' });
    }
}

exports.cancelQueueEntry = async (req, res) => {
    try {
        
        // get current queue entry that is current and not next based on the queue number
        const isCurrentQueueEntry = await Queue.findOne({ isCurrent: true, status: 'called' }); // Find the current queue entry that is not next
        if (isCurrentQueueEntry) {
            // Update the queue entry to set isCurrent to false and isNext to false
            isCurrentQueueEntry.isCurrent = false;
            isCurrentQueueEntry.isNext = false;
            isCurrentQueueEntry.status = 'cancelled'; // Update status to 'cancelled'
            await isCurrentQueueEntry.save(); // Save the updated queue entry

            res.status(200).json({ message: 'Queue entry cancelled successfully' }); // Return success message
        } else{
            return res.status(404).json({ message: 'No current queue entry found' }); // If not found, return 404
        }
    } catch (error) {
        console.error('Error cancelling queue entry:', error);
        res.status(500).json({ message: 'Error cancelling queue entry' });
    }
}

exports.getCurrentQueueEntry = async (req, res) => {
    try {
        const currentQueueEntry = await Queue.findOne({ isCurrent: true }); // Find the current queue entry

        if (!currentQueueEntry) {
            return res.status(404).json({ message: 'No current queue entry found' }); // If not found, return 404
        }
        res.status(200).json(currentQueueEntry); // Return the current queue entry
    } catch (error) {
        res.status(500).json({ message: 'Error fetching current queue entry' });
    }
}

exports.getNextQueueEntry = async (req, res) => {
    try {
        const nextQueueEntry = await Queue.findOne({ isNext: true }); // Find the next queue entry
        if (!nextQueueEntry) {
            return res.status(404).json({ message: 'No next queue entry found' }); // If not found, return 404
        }
        res.status(200).json(nextQueueEntry); // Return the next queue entry
    } catch (error) {
        console.error('Error fetching next queue entry:', error);
        res.status(500).json({ message: 'Error fetching next queue entry' });
    }
}

exports.getQueueByDepartment = async (req, res) => {
    try {
        const { department } = req.params; // Get the department from the request parameters
        const queueEntries = await Queue.find({ department }).sort({ queueNumber: 1 }); // Find queue entries by department and sort by queue number
        res.status(200).json(queueEntries); // Return the queue entries
    } catch (error) {
        console.error('Error fetching queue entries by department:', error);
        res.status(500).json({ message: 'Error fetching queue entries by department' });
    }
}

exports.getQueueByDate = async (req, res) => {
    try {
        const { date } = req.params; // Get the date from the request parameters
        const queueEntries = await Queue.find({ date }).sort({ queueNumber: 1 }); // Find queue entries by date and sort by queue number
        res.status(200).json(queueEntries); // Return the queue entries
    } catch (error) {
        console.error('Error fetching queue entries by date:', error);
        res.status(500).json({ message: 'Error fetching queue entries by date' });
    }
}

exports.getQueueByPatient = async (req, res) => {
    try {
        const { patientName } = req.params; // Get the patient name from the request parameters
        const queueEntries = await Queue.find({ patientName }).sort({ queueNumber: 1 }); // Find queue entries by patient name and sort by queue number
        res.status(200).json(queueEntries); // Return the queue entries
    } catch (error) {
        console.error('Error fetching queue entries by patient:', error);
        res.status(500).json({ message: 'Error fetching queue entries by patient' });
    }
}

exports.getQueueByStatus = async (req, res) => {
    try {
        const { status } = req.params; // Get the status from the request parameters
        const queueEntries = await Queue.find({ status }).sort({ queueNumber: 1 }); // Find queue entries by status and sort by queue number
        res.status(200).json(queueEntries); // Return the queue entries
    } catch (error) {
        console.error('Error fetching queue entries by status:', error);
        res.status(500).json({ message: 'Error fetching queue entries by status' });
    }
}

exports.getQueueByPriority = async (req, res) => {
    try {
        const { priority } = req.params; // Get the priority from the request parameters
        const queueEntries = await Queue.find({ priority }).sort({ queueNumber: 1 }); // Find queue entries by priority and sort by queue number
        res.status(200).json(queueEntries); // Return the queue entries
    } catch (error) {
        console.error('Error fetching queue entries by priority:', error);
        res.status(500).json({ message: 'Error fetching queue entries by priority' });
    }
}
