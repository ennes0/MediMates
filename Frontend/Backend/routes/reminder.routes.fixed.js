/**
 * Reminder Routes
 */
const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { db } = require('../config/database');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/reminders
 * @desc Get all reminders for a user
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
    // Parse query parameters for filtering
    const { date, status } = req.query;
    
    // Debug log for user ID
    console.log(`Getting reminders for user ID: ${req.userId}`);
    
    try {
        let query = `            SELECT r.reminder_id, r.title, r.description as reminder_description, r.date, r.time, r.status, r.created_at, r.updated_at,
                   rm.id as reminder_med_id, rm.dosage as med_dosage, rm.status as med_status, rm.taken_at, rm.notes as med_notes,
                   m.medication_id, m.name, m.strength as dosage, m.medication_type as pill_type, m.description, m.icon as icon_type
            FROM reminders r
            LEFT JOIN reminder_medications rm ON r.reminder_id = rm.reminder_id
            LEFT JOIN medications m ON rm.medication_id = m.medication_id
            WHERE r.user_id = ?`;
            
        const queryParams = [req.userId];
        
        // Add date filter if provided - handle timezone issues
        if (date) {
            console.log(`Frontend requested date: ${date}`);
            
            // Use exact string comparison to ensure we match the exact date that was stored
            // This avoids timezone conversion issues
            query += ` AND r.date = ?`;
            queryParams.push(date);
            
            // Also debug query to check if we're finding the right reminders
            console.log(`DEBUG: Checking reminders with exact date match: r.date = '${date}'`);
        }
        
        // Add status filter if provided
        if (status) {
            query += ` AND r.status = ?`;
            queryParams.push(status);
        }
        
        // Add sorting
        query += ` ORDER BY r.date DESC, r.time ASC`;
        
        console.log(`Executing reminder query for date: ${date || 'all'}`);
        console.log('SQL:', query);
        console.log('Params:', queryParams);
        
        const reminderResults = await db.all(query, queryParams);
        console.log(`Query returned ${reminderResults.length} rows`);        // Execute a separate query for medications and add them to the reminders
        // This is a reliable approach that avoids the LEFT JOIN limitations
        let medicationsByReminder = {};
        if (reminderResults.length > 0) {
            const reminderIds = reminderResults.map(r => r.reminder_id).join(',');
            console.log(`DEBUG: Checking medications for reminder IDs: ${reminderIds}`);
            
            // Execute a separate query to get medication details
            const medicationQuery = `
                SELECT rm.reminder_id, rm.id as reminder_med_id, rm.status as med_status, rm.taken_at,
                       rm.dosage as med_dosage, rm.notes as med_notes,
                       m.medication_id, m.name, m.strength as dosage, m.medication_type as pill_type, 
                       m.description, m.icon as icon_type
                FROM reminder_medications rm
                LEFT JOIN medications m ON rm.medication_id = m.medication_id
                WHERE rm.reminder_id IN (${reminderIds})`;
            
            const medicationResults = await db.all(medicationQuery);
            console.log(`DEBUG: Found ${medicationResults.length} separate medication entries`);
            
            if (medicationResults.length > 0) {
                console.log(`DEBUG: First medication:`, JSON.stringify(medicationResults[0], null, 2));
                
                // Log all medications returned for debugging
                console.log(`DEBUG: All medications found:`, JSON.stringify(medicationResults.map(m => ({
                    reminder_id: m.reminder_id,
                    medication_id: m.medication_id,
                    name: m.name
                })), null, 2));
                
                // Create a map of medications by reminder_id for easy lookup
                medicationsByReminder = {};
                medicationResults.forEach(med => {
                    if (!medicationsByReminder[med.reminder_id]) {
                        medicationsByReminder[med.reminder_id] = [];
                    }
                    medicationsByReminder[med.reminder_id].push(med);
                    console.log(`DEBUG: Added medication ${med.medication_id} (${med.name || 'unnamed'}) to reminder ${med.reminder_id}`);
                });
                
                console.log(`DEBUG: Created medications map with ${Object.keys(medicationsByReminder).length} reminder keys`);
            } else {
                console.log(`DEBUG: No medications found in reminder_medications table for these reminders`);
            }
        }
          // Process and format data
        const reminders = {};
        
        // First, create all reminder objects from reminder results
        reminderResults.forEach(item => {
            const reminderId = item.reminder_id;            // Format the date without timezone adjustments to match the date that was selected
            let reminderDate = item.date;
            
            // Handle different date formats that might come from MySQL but preserve the date
            if (reminderDate instanceof Date) {
                // Extract just the date part without timezone adjustment
                reminderDate = reminderDate.toISOString().split('T')[0];
            } else if (typeof reminderDate === 'string') {
                // If it's already a string with timezone info
                if (reminderDate.includes('T')) {
                    // It's an ISO string, just extract the date part
                    reminderDate = reminderDate.split('T')[0];
                }
                // Otherwise assume it's already in YYYY-MM-DD format
            }
            
            // Debug date information
            console.log(`Reminder ${reminderId} raw date from DB:`, item.date);
            console.log(`Reminder ${reminderId} formatted date (no timezone adjustment):`, reminderDate);
              
            // Initialize reminder object if not exists - we only want one entry per reminder
            if (!reminders[reminderId]) {
                reminders[reminderId] = {
                    id: reminderId,
                    title: item.title,
                    description: item.reminder_description,
                    date: reminderDate,
                    time: item.time,
                    isCompleted: item.status === 'completed',
                    createdAt: item.created_at,
                    updatedAt: item.updated_at,
                    medications: []
                };
            }
        });
        
        // Now add medications from our separate query results using the medicationsByReminder map
        Object.keys(reminders).forEach(reminderId => {
            const meds = medicationsByReminder[reminderId] || [];
            
            console.log(`Adding ${meds.length} medications to reminder ${reminderId}`);
            
            if (meds.length > 0) {
                meds.forEach(med => {
                    // Format the time properly
                    let scheduleTime = med.schedule_time || reminders[reminderId].time;
                    if (scheduleTime instanceof Date) {
                        // Extract only the time part in HH:MM:SS format
                        scheduleTime = scheduleTime.toTimeString().split(' ')[0];
                    } else if (typeof scheduleTime === 'string' && scheduleTime.includes('T')) {
                        // If it's an ISO string, extract just the time part
                        scheduleTime = scheduleTime.split('T')[1].substring(0, 8);
                    }
                    
                    reminders[reminderId].medications.push({
                        id: med.reminder_med_id,
                        reminderMedId: med.reminder_med_id, // Add this field to match what frontend expects
                        medicationId: med.medication_id,
                        medication_id: med.medication_id, // Include both formats for compatibility
                        name: med.name,
                        dosage: med.med_dosage || med.dosage,  // Use med_dosage if available, otherwise medication's dosage
                        pillType: med.pill_type,
                        pill_type: med.pill_type, // Include both formats for compatibility
                        description: med.description,
                        iconType: med.icon_type,
                        icon_type: med.icon_type, // Include both formats for compatibility
                        scheduleTime: scheduleTime,
                        status: med.med_status, 
                        takenAt: med.taken_at,
                        notes: med.med_notes
                    });
                    
                    console.log(`Added medication ${med.medication_id} to reminder ${reminderId}`);
                });
            } else {
                console.log(`No medications found for reminder ${reminderId}`);
            }        });
        
        // Convert the reminders object to an array for the response
        const reminderResponse = Object.values(reminders);
        
        console.log(`Reminders for date ${date || 'all'}: Found ${reminderResponse.length} reminders`);
        if (reminderResponse.length > 0) {
            console.log('First reminder:', JSON.stringify(reminderResponse[0], null, 2));
              // Check if the date matches what was requested
            if (date) {
                const requestedDate = date;
                const returnedDate = reminderResponse[0].date;
                console.log(`Requested date: ${requestedDate}, Returned date: ${returnedDate}, Match: ${requestedDate === returnedDate}`);                // Debug the actual dates from DB vs. what we're returning
                console.log("Date details:");
                console.log("- Original requested date:", date);
                console.log("- Query parameter used:", queryParams[1]);
                console.log("- Raw DB date for first reminder:", reminderResults[0].date);
                console.log("- Timezone-adjusted date returned:", returnedDate);
                
                // Check for possible timezone effects
                const rawDBDate = new Date(reminderResults[0].date);
                console.log("- Raw DB date in local timezone:", rawDBDate.toString());
                console.log("- Raw DB date in UTC:", rawDBDate.toUTCString());
                
                // Check with timezone adjustment
                const adjustedRawDate = new Date(reminderResults[0].date);
                adjustedRawDate.setHours(adjustedRawDate.getHours() + 3);
                console.log("- DB date with +3 hour adjustment:", adjustedRawDate.toISOString());
                console.log("- Adjusted date matches requested date:", adjustedRawDate.toISOString().split('T')[0] === date);
            }
        }
        
        res.status(200).json(
            formatSuccessResponse(reminderResponse)
        );
    } catch (err) {
        console.error('Error fetching reminders:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch reminders')
        );
    }
});

/**
 * @route GET /api/reminders/:id
 * @desc Get a specific reminder by ID
 * @access Private
 */
router.get('/:id', verifyToken, async (req, res) => {
    const reminderId = req.params.id;
    
    try {
        // Get reminder details with title and description
        const reminder = await db.get(
            `SELECT r.reminder_id, r.date, r.title, r.description, r.status, r.created_at, r.updated_at
             FROM reminders r
             WHERE r.reminder_id = ? AND r.user_id = ?`,
            [reminderId, req.userId]
        );
        
        if (!reminder) {
            return res.status(404).json(
                formatErrorResponse('Reminder not found')
            );
        }        // Format date with timezone adjustment
        let reminderDate = reminder.date;
        if (reminderDate instanceof Date) {
            // Adjust for timezone (+3 hours for UTC+3)
            const adjustedDate = new Date(reminderDate);
            adjustedDate.setHours(adjustedDate.getHours() + 3);
            reminderDate = adjustedDate.toISOString().split('T')[0];
        } else if (typeof reminderDate === 'string') {
            if (reminderDate.includes('T')) {
                // It's an ISO string, parse, adjust and reformat
                const adjustedDate = new Date(reminderDate);
                adjustedDate.setHours(adjustedDate.getHours() + 3);
                reminderDate = adjustedDate.toISOString().split('T')[0];
            }
        }
        // Otherwise assume it's already in YYYY-MM-DD format
        
        console.log(`Raw date from DB for reminder ${reminderId}:`, reminder.date);
        console.log(`Timezone-adjusted date:`, reminderDate);
        
        console.log(`Getting details for reminder ID: ${reminderId}, date: ${reminderDate}`);
        
        // Get medications for this reminder
        const medications = await db.all(
            `SELECT rm.id as reminder_med_id, rm.schedule_time, rm.status, rm.taken_at, rm.notes,
                    m.medication_id, m.name, m.strength as dosage, m.medication_type as pill_type, m.description, m.icon as icon_type
             FROM reminder_medications rm
             JOIN medications m ON rm.medication_id = m.medication_id
             WHERE rm.reminder_id = ?
             ORDER BY rm.schedule_time`,
            [reminderId]
        );
          res.status(200).json(
            formatSuccessResponse({
                id: reminder.reminder_id,
                title: reminder.title,
                description: reminder.description,
                date: reminderDate, // Use consistently formatted date
                isCompleted: reminder.status === 'completed',
                createdAt: reminder.created_at,
                updatedAt: reminder.updated_at,
                medications: medications.map(med => {
                    // Format the schedule time consistently
                    let scheduleTime = med.schedule_time;
                    if (scheduleTime instanceof Date) {
                        scheduleTime = scheduleTime.toTimeString().split(' ')[0];
                    } else if (typeof scheduleTime === 'string' && scheduleTime.includes('T')) {
                        scheduleTime = scheduleTime.split('T')[1].substring(0, 8);
                    }
                    
                    return {
                        id: med.reminder_med_id,
                        medicationId: med.medication_id,
                        name: med.name,
                        dosage: med.dosage,
                        pillType: med.pill_type,
                        description: med.description,
                        iconType: med.icon_type,
                        scheduleTime: scheduleTime,
                        status: med.status,
                        takenAt: med.taken_at,
                        notes: med.notes
                    };
                })
            })
        );
    } catch (err) {
        console.error('Error fetching reminder details:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch reminder details')
        );
    }
});

/**
 * @route POST /api/reminders
 * @desc Create a new reminder
 * @access Private
 */
router.post('/', verifyToken, async (req, res) => {
    const { date, title, description, medications } = req.body;
    
    if (!date || !medications || medications.length === 0) {
        return res.status(400).json(
            formatErrorResponse('Date and medications are required')
        );
    }
      // Log the incoming request data
    console.log(`Creating reminder for user ${req.userId} with date: ${date}`);
    console.log(`Full reminder data:`, JSON.stringify(req.body));
    console.log(`Medications: ${JSON.stringify(medications)}`);
    
    // Check if medication IDs are valid
    if (medications.length > 0) {
        for (const med of medications) {
            if (!med.medicationId) {
                console.error(`ERROR: Missing medicationId in reminder medications`);
                return res.status(400).json(
                    formatErrorResponse('Each medication must have a medicationId')
                );
            }
            console.log(`Got medication ID: ${med.medicationId}, schedule time: ${med.scheduleTime || 'not specified'}`);
        }
    }
    
    try {        // Format date to ensure consistent handling 
        // We should preserve the exact date that was selected in the frontend
        // If date is already in YYYY-MM-DD format, use it directly
        let formattedDate;
        
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Date is already in YYYY-MM-DD format, use as is
            formattedDate = date;
        } else {
            // Parse and extract just the date part, without timezone adjustment
            // This ensures the calendar date the user selected remains the same
            const dateObj = new Date(date);
            formattedDate = dateObj.toISOString().split('T')[0];
        }
        
        console.log(`Frontend provided date: ${date}`);
        console.log(`Formatted date for DB insertion (no timezone adjustment): ${formattedDate}`);
          // Create new reminder - with time field that's required in the table schema
        const result = await db.run(
            `INSERT INTO reminders (user_id, date, time, title, description, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.userId, formattedDate, req.body.time || '09:00:00', title || 'Medication Reminder', description || null, 'pending']
        );
        
        const reminderId = result.lastID;
        console.log(`Created new reminder with ID: ${reminderId}`);
          // Insert each medication for this reminder
        for (const med of medications) {
            // Make sure we have a schedule time, use reminder time as fallback
            const scheduleTime = med.scheduleTime || req.body.time || '09:00';
            
            console.log(`Inserting medication ${med.medicationId} with schedule time ${scheduleTime}`);
            
            try {
                await db.run(
                    `INSERT INTO reminder_medications (reminder_id, medication_id, schedule_time, status)
                     VALUES (?, ?, ?, ?)`,
                    [reminderId, med.medicationId, scheduleTime, 'pending']
                );
                console.log(`Successfully added medication ${med.medicationId} to reminder ${reminderId}`);
            } catch (insertError) {
                console.error(`Error adding medication to reminder:`, insertError);
                // Continue with other medications rather than failing the entire request
            }
        }
          // Return the newly created reminder
        const reminder = await db.get(
            `SELECT r.reminder_id, r.date, r.status, r.time, r.created_at, r.updated_at
             FROM reminders r
             WHERE r.reminder_id = ?`,
            [reminderId]
        );
          const reminderMedications = await db.all(
            `SELECT rm.id, rm.dosage, rm.status, rm.taken_at, rm.notes,
                    m.medication_id, m.name, m.strength, m.medication_type, m.description, m.icon
             FROM reminder_medications rm
             JOIN medications m ON rm.medication_id = m.medication_id
             WHERE rm.reminder_id = ?`,
            [reminderId]
        );
        res.status(201).json(
            formatSuccessResponse({
                id: reminder.reminder_id,
                date: reminder.date,
                status: reminder.status || 'pending',
                time: reminder.time,
                isCompleted: reminder.status === 'completed',
                createdAt: reminder.created_at,
                updatedAt: reminder.updated_at,                medications: reminderMedications.map(med => ({
                    id: med.id,
                    medicationId: med.medication_id,
                    name: med.name,
                    dosage: med.strength || med.dosage,
                    pillType: med.medication_type,
                    description: med.description,
                    iconType: med.icon,
                    notes: med.notes,
                    status: med.status,
                    takenAt: med.taken_at
                }))
            })
        );
    } catch (err) {
        console.error('Error creating reminder:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to create reminder')
        );
    }
});

/**
 * @route PUT /api/reminders/:id/medication/:medId
 * @desc Update the status of a medication in a reminder
 * @access Private
 */
router.put('/:id/medication/:medId', verifyToken, async (req, res) => {
    const reminderId = req.params.id;
    const reminderMedId = req.params.medId;
    const { status, notes } = req.body;
    
    if (!status || !['taken', 'skipped', 'missed', 'pending'].includes(status)) {
        return res.status(400).json(
            formatErrorResponse('Valid status is required (taken, skipped, missed, pending)')
        );
    }
    
    try {
        // First verify the reminder belongs to the user
        const reminder = await db.get(
            `SELECT r.reminder_id
             FROM reminders r
             WHERE r.reminder_id = ? AND r.user_id = ?`,
            [reminderId, req.userId]
        );
        
        if (!reminder) {
            return res.status(404).json(
                formatErrorResponse('Reminder not found or access denied')
            );
        }
        
        // Update the medication status
        const takenAt = (status === 'taken') ? new Date().toISOString() : null;
        
        const updateResult = await db.run(
            `UPDATE reminder_medications
             SET status = ?, taken_at = ?, notes = ?
             WHERE reminder_med_id = ? AND reminder_id = ?`,
            [status, takenAt, notes, reminderMedId, reminderId]
        );
        
        if (updateResult.changes === 0) {
            return res.status(404).json(
                formatErrorResponse('Medication not found in this reminder')
            );
        }
        
        // Create medication history entry if status is 'taken'
        if (status === 'taken') {
            // Get medication ID
            const medication = await db.get(
                `SELECT medication_id, schedule_time
                 FROM reminder_medications
                 WHERE reminder_med_id = ?`,
                [reminderMedId]
            );
            
            // Create history entry
            await db.run(
                `INSERT INTO medication_history (user_id, medication_id, taken_date, taken_time, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.userId, medication.medication_id, reminder.date, medication.schedule_time, status, notes]
            );
        }
        
        // Check if all medications are taken, skipped, or missed
        const medicationsStatus = await db.all(
            `SELECT status
             FROM reminder_medications
             WHERE reminder_id = ?`,
            [reminderId]
        );
        
        const allCompleted = medicationsStatus.every(med => 
            med.status === 'taken' || med.status === 'skipped' || med.status === 'missed'
        );
          // If all medications are completed, mark the reminder as completed
        if (allCompleted) {
            await db.run(
                `UPDATE reminders
                 SET status = 'completed', updated_at = CURRENT_TIMESTAMP
                 WHERE reminder_id = ?`,
                [reminderId]
            );
        }
        
        res.status(200).json(
            formatSuccessResponse({
                message: `Medication status updated to ${status}`,
                reminderCompleted: allCompleted
            })
        );
    } catch (err) {
        console.error('Error updating reminder medication status:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to update reminder medication status')
        );
    }
});

/**
 * @route DELETE /api/reminders/:id
 * @desc Delete a reminder
 * @access Private
 */
router.delete('/:id', verifyToken, async (req, res) => {
    const reminderId = req.params.id;
    
    try {
        // Verify the reminder belongs to the user
        const reminder = await db.get(
            `SELECT reminder_id
             FROM reminders
             WHERE reminder_id = ? AND user_id = ?`,
            [reminderId, req.userId]
        );
        
        if (!reminder) {
            return res.status(404).json(
                formatErrorResponse('Reminder not found or access denied')
            );
        }
        
        // Delete the reminder (cascade should handle related medication entries)
        const result = await db.run(
            `DELETE FROM reminders
             WHERE reminder_id = ?`,
            [reminderId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Reminder deleted successfully'
            })
        );
    } catch (err) {
        console.error('Error deleting reminder:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to delete reminder')
        );
    }
});

/**
 * @route GET /api/reminders/by-user/:userId
 * @desc [DEV ONLY] Get all reminders for a specific user (for testing)
 * @access Public (in production, this should be restricted)
 */
router.get('/by-user/:userId', async (req, res) => {
    // Parse parameters
    const { userId } = req.params;
    const { date, status } = req.query;
    
    console.log(`[DEV] Getting reminders for user ID: ${userId}`);
    
    try {
        let query = `
            SELECT r.reminder_id, r.date, r.time, r.status, r.title, r.description as reminder_description, r.created_at, r.updated_at,
                   rm.id as reminder_med_id, rm.status as med_status, rm.taken_at,
                   m.medication_id, m.name, m.strength as dosage, m.medication_type as pill_type, m.description, m.icon as icon_type
            FROM reminders r
            LEFT JOIN reminder_medications rm ON r.reminder_id = rm.reminder_id
            LEFT JOIN medications m ON rm.medication_id = m.medication_id
            WHERE r.user_id = ?`;          const queryParams = [userId];        // Add date filter if provided - handle timezone issues
        if (date) {
            // Handle timezone issues with DATE_ADD
            console.log(`[DEV] Frontend requested date: ${date}`);
            
            // Use DATE_ADD to handle the timezone offset (adding 3 hours to match UTC+3)
            query += ` AND DATE(DATE_ADD(r.date, INTERVAL 3 HOUR)) = ?`;
            queryParams.push(date);
            
            console.log(`[DEV] Using timezone-adjusted date comparison for query: ${date}`);
        }
        
        // Add status filter if provided
        if (status) {
            query += ` AND rm.status = ?`;
            queryParams.push(status);
        }
        
        // Add sorting
        query += ` ORDER BY r.date DESC, r.time ASC`;
        
        console.log(`[DEV] Executing reminder query for user: ${userId}, date: ${date || 'all'}`);
        console.log('SQL:', query);
        console.log('Params:', queryParams);
        
        const reminderResults = await db.all(query, queryParams);
        console.log(`[DEV] Query returned ${reminderResults.length} rows`);
        
        // Process and format data
        const reminders = {};
        
        reminderResults.forEach(item => {
            const reminderId = item.reminder_id;            // Format the date with timezone adjustment
            let reminderDate = item.date;
            
            // Handle different date formats that might come from MySQL
            if (reminderDate instanceof Date) {
                // Create new date and adjust for timezone (+3 hours for UTC+3)
                const adjustedDate = new Date(reminderDate);
                adjustedDate.setHours(adjustedDate.getHours() + 3);
                reminderDate = adjustedDate.toISOString().split('T')[0];
            } else if (typeof reminderDate === 'string') {
                // If it's already a string with timezone info
                if (reminderDate.includes('T')) {
                    // It's an ISO string, parse, adjust and reformat
                    const adjustedDate = new Date(reminderDate);
                    adjustedDate.setHours(adjustedDate.getHours() + 3);
                    reminderDate = adjustedDate.toISOString().split('T')[0];
                }
                // Otherwise assume it's already in YYYY-MM-DD format
            }
            
            // Debug date information
            console.log(`[DEV] Reminder ${reminderId} raw date from DB:`, item.date);
            console.log(`[DEV] Reminder ${reminderId} timezone-adjusted date:`, reminderDate);
            
            // Initialize reminder object if not exists
            if (!reminders[reminderId]) {
                reminders[reminderId] = {
                    id: reminderId,
                    title: item.title,
                    description: item.reminder_description,
                    date: reminderDate,
                    isCompleted: item.status === 'completed',
                    createdAt: item.created_at,
                    updatedAt: item.updated_at,
                    medications: []
                };
            }
            
            // Add medication to the reminder if it exists
            if (item.medication_id) {
                // Format the time properly
                let scheduleTime = item.time;
                if (scheduleTime instanceof Date) {
                    scheduleTime = scheduleTime.toTimeString().split(' ')[0];
                } else if (typeof scheduleTime === 'string' && scheduleTime.includes('T')) {
                    scheduleTime = scheduleTime.split('T')[1].substring(0, 8);
                }
                
                reminders[reminderId].medications.push({
                    id: item.reminder_med_id,
                    medicationId: item.medication_id,
                    name: item.name,
                    dosage: item.dosage,
                    pillType: item.pill_type,
                    description: item.description,
                    iconType: item.icon_type,
                    scheduleTime: scheduleTime,
                    status: item.med_status,
                    takenAt: item.taken_at,
                    notes: item.med_notes
                });
            }
        });
        
        const reminderResponse = Object.values(reminders);
        console.log(`[DEV] Reminders for user ${userId}: Found ${reminderResponse.length} reminders`);
        
        if (reminderResponse.length > 0) {
            console.log('[DEV] First reminder:', JSON.stringify(reminderResponse[0], null, 2));
        }
        
        res.status(200).json(
            formatSuccessResponse(reminderResponse)
        );
    } catch (err) {
        console.error('[DEV] Error fetching reminders:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch reminders')
        );
    }
});

/**
 * @route GET /api/reminders/admin/debug
 * @desc [DEV ONLY] Debug endpoint to list all users and reminders
 * @access Public (in production, this should be restricted)
 */
router.get('/admin/debug', async (req, res) => {
    try {
        console.log('[ADMIN DEBUG] Fetching all users and reminders');
        
        // Get all users
        const users = await db.all('SELECT user_id, email FROM users');
        console.log('[ADMIN DEBUG] Users found:', users.length);
        
        // Get all reminders with raw date format
        const reminders = await db.all(`
            SELECT r.reminder_id, r.user_id, r.date, r.time, r.title, r.description, r.status,
                   DATE_FORMAT(r.date, '%Y-%m-%d') AS formatted_date
            FROM reminders r
            ORDER BY r.user_id, r.date DESC`);
        console.log('[ADMIN DEBUG] Reminders found:', reminders.length);
        
        // Get all reminder medications with more details
        const reminderMeds = await db.all(`
            SELECT rm.reminder_id, rm.id, rm.medication_id, rm.status, rm.taken_at, 
                   m.name as medication_name, r.date as reminder_date, r.user_id
            FROM reminder_medications rm
            JOIN medications m ON rm.medication_id = m.medication_id
            JOIN reminders r ON rm.reminder_id = r.reminder_id
            ORDER BY r.user_id, r.date DESC`);
        console.log('[ADMIN DEBUG] Reminder medications found:', reminderMeds.length);
        
        // Special output for reminders to debug date format
        if (reminders.length > 0) {
            const sampleReminder = reminders[0];
            console.log('[ADMIN DEBUG] Sample reminder:');
            console.log('  ID:', sampleReminder.reminder_id);
            console.log('  User ID:', sampleReminder.user_id);            console.log('  Raw date:', sampleReminder.date);
            console.log('  MySQL formatted date:', sampleReminder.formatted_date);
            
            // Show the date with the day adjustment applied
            const jsDate = new Date(sampleReminder.date);
            console.log('  JS formatted date (raw):', jsDate.toISOString());            // No adjustment needed - show the date exactly as stored
            console.log('  JS formatted date (no adjustment):', new Date(sampleReminder.date).toISOString());
            
            // Get associated medications for this reminder
            const relatedMeds = reminderMeds.filter(m => m.reminder_id === sampleReminder.reminder_id);
            console.log('  Associated medications:', relatedMeds.length);
            if (relatedMeds.length > 0) {
                console.log('    First medication:', relatedMeds[0].medication_name);
            }
        }
        
        res.status(200).json({
            success: true,
            users,
            reminders,
            reminderMeds,
            dateInfo: {
                serverTime: new Date().toISOString(),
                localTime: new Date().toString(),
                mysqlTime: await db.get('SELECT NOW() as now').then(row => row.now)
            }
        });
    } catch (err) {
        console.error('[ADMIN DEBUG] Error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch debug information',
            errorDetails: err.message
        });
    }
});

/**
 * @route GET /api/reminders/debug/medications
 * @desc Debug endpoint to check all medications and reminder_medications
 * @access Private
 */
router.get('/debug/medications', verifyToken, async (req, res) => {
    try {
        // Get all medications for this user
        const medications = await db.all(
            `SELECT m.* FROM medications m WHERE m.user_id = ?`, 
            [req.userId]
        );
        
        // Get all reminder_medications for this user's reminders
        const reminderMeds = await db.all(
            `SELECT rm.* 
             FROM reminder_medications rm
             JOIN reminders r ON rm.reminder_id = r.reminder_id
             WHERE r.user_id = ?`,
            [req.userId]
        );
        
        // Also get a sample of reminders with medications properly joined
        const sampleJoin = await db.all(
            `SELECT r.reminder_id, r.title, r.date, r.time,
                    rm.id as reminder_med_id, rm.medication_id, rm.dosage,
                    m.name, m.medication_type as pill_type, m.icon as icon_type
             FROM reminders r
             JOIN reminder_medications rm ON r.reminder_id = rm.reminder_id
             JOIN medications m ON rm.medication_id = m.medication_id
             WHERE r.user_id = ?
             LIMIT 10`,
            [req.userId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                medications,
                reminderMeds,
                sampleJoin,
                counts: {
                    medications: medications.length,
                    reminderMeds: reminderMeds.length,
                    sampleJoin: sampleJoin.length
                }
            })
        );
    } catch (err) {
        console.error('Error in debug medications endpoint:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch debug medication data')
        );
    }
});

/**
 * @route GET /api/reminders/debug/data
 * @desc Debug endpoint to check raw reminders and medications data
 * @access Private - Should only be used in development
 */
router.get('/debug/data', verifyToken, async (req, res) => {
    try {
        // Get all reminders for the authenticated user
        const userReminders = await db.all('SELECT * FROM reminders WHERE user_id = ?', [req.userId]);
        console.log(`Found ${userReminders.length} reminders for user ${req.userId}`);
        
        // Get all medications for the authenticated user
        const userMedications = await db.all('SELECT * FROM medications WHERE user_id = ?', [req.userId]);
        console.log(`Found ${userMedications.length} medications for user ${req.userId}`);
        
        // Get reminder-medication relationships for this user's reminders
        let reminderMeds = [];
        if (userReminders.length > 0) {
            const reminderIds = userReminders.map(r => r.reminder_id).join(',');
            reminderMeds = await db.all(`
                SELECT rm.* 
                FROM reminder_medications rm
                WHERE rm.reminder_id IN (${reminderIds})
            `);
        }
        console.log(`Found ${reminderMeds.length} reminder-medication relationships`);
        
        // Get all users for comparison (remove passwords)
        const users = await db.all('SELECT user_id, email, is_active FROM users');
        
        // Run the main query that we use in the regular endpoint
        const { date } = req.query;
        let mainQuery = `
            SELECT r.reminder_id, r.title, r.description, r.date, r.time, r.status, r.user_id,
                rm.id as reminder_med_id, rm.dosage as med_dosage, rm.status as med_status, 
                m.medication_id, m.name, m.strength, m.medication_type
            FROM reminders r
            LEFT JOIN reminder_medications rm ON r.reminder_id = rm.reminder_id
            LEFT JOIN medications m ON rm.medication_id = m.medication_id
            WHERE r.user_id = ?
        `;
        const queryParams = [req.userId];
        
        if (date) {
            mainQuery += ` AND DATE(DATE_ADD(r.date, INTERVAL 3 HOUR)) = ?`;
            queryParams.push(date);
        }
        
        const mainQueryResults = await db.all(mainQuery, queryParams);
        console.log(`Main query returned ${mainQueryResults.length} results`);
        
        res.status(200).json(
            formatSuccessResponse({
                userReminders,
                userMedications,
                reminderMeds,
                users: users.length,
                mainQueryResults,
                userId: req.userId
            })
        );
    } catch (err) {
        console.error('Error in debug data endpoint:', err);
        return res.status(500).json(
            formatErrorResponse('Error in debug data endpoint')
        );
    }
});

/**
 * @route GET /api/reminders/debug/date/:date
 * @desc Debug endpoint to check reminders for a specific date
 * @access Private - Should only be used in development
 */
router.get('/debug/date/:date', verifyToken, async (req, res) => {
    const requestedDate = req.params.date;
    
    try {
        console.log(`Debug: Checking reminders for date ${requestedDate} and user ${req.userId}`);
        
        // Direct SQL query checking various date formats
        const remindersForDate = await db.all(`
            SELECT r.*, 
                   DATE_FORMAT(r.date, '%Y-%m-%d') as formatted_date, 
                   DATE(DATE_ADD(r.date, INTERVAL 3 HOUR)) as adjusted_date
            FROM reminders r
            WHERE r.user_id = ?
            ORDER BY r.date, r.time
        `, [req.userId]);
        
        console.log(`Found ${remindersForDate.length} reminders for user ${req.userId}`);
        
        // Find reminders specifically matching the requested date with different comparison methods
        const exactMatches = remindersForDate.filter(r => r.formatted_date === requestedDate);
        console.log(`Found ${exactMatches.length} exact date matches for ${requestedDate}`);

        const adjustedMatches = remindersForDate.filter(r => r.adjusted_date === requestedDate);
        console.log(`Found ${adjustedMatches.length} timezone-adjusted matches for ${requestedDate}`);
        
        // Check medications for these reminders
        let medications = [];
        if (exactMatches.length > 0 || adjustedMatches.length > 0) {
            const allMatches = [...new Set([...exactMatches, ...adjustedMatches].map(r => r.reminder_id))];
            const reminderIds = allMatches.join(',');
            
            medications = await db.all(`
                SELECT rm.*, m.name, m.strength, m.medication_type, r.date, r.time, r.title
                FROM reminder_medications rm
                JOIN medications m ON rm.medication_id = m.medication_id
                JOIN reminders r ON rm.reminder_id = r.reminder_id
                WHERE rm.reminder_id IN (${reminderIds})
            `);
            
            console.log(`Found ${medications.length} medications for matching reminders`);
        }

        // Run the query used in the main reminders endpoint
        const mainQuery = `
            SELECT r.reminder_id, r.title, r.description, r.date, r.time, r.status,
                   DATE_FORMAT(r.date, '%Y-%m-%d') as formatted_date,
                   DATE(DATE_ADD(r.date, INTERVAL 3 HOUR)) as adjusted_date,
                   rm.id as reminder_med_id, rm.dosage as med_dosage, rm.status as med_status, 
                   m.medication_id, m.name, m.strength, m.medication_type
            FROM reminders r
            LEFT JOIN reminder_medications rm ON r.reminder_id = rm.reminder_id
            LEFT JOIN medications m ON rm.medication_id = m.medication_id
            WHERE r.user_id = ? AND DATE(DATE_ADD(r.date, INTERVAL 3 HOUR)) = ?
        `;
        
        const mainQueryResults = await db.all(mainQuery, [req.userId, requestedDate]);
        console.log(`Main query returned ${mainQueryResults.length} results for ${requestedDate}`);
        
        res.status(200).json(
            formatSuccessResponse({
                requestedDate,
                remindersCount: remindersForDate.length,
                exactMatches: exactMatches.length,
                adjustedMatches: adjustedMatches.length,
                medicationsCount: medications.length,
                mainQueryResults: mainQueryResults.length,
                reminders: remindersForDate,
                medications,
                mainQueryData: mainQueryResults
            })
        );
    } catch (err) {
        console.error(`Error checking reminders for date ${requestedDate}:`, err);
        return res.status(500).json(
            formatErrorResponse(`Error checking reminders for date ${requestedDate}`)
        );
    }
});

/**
 * @route GET /api/reminders/debug/specific-date
 * @desc Debug endpoint to check reminders for 2025-06-13
 * @access Private - Should only be used in development
 */
router.get('/debug/specific-date', verifyToken, async (req, res) => {
    const specificDate = "2025-06-13";
    
    try {
        console.log(`Looking for reminders on specific date: ${specificDate}`);
        
        // First, get all reminders that might match the specific date in any format
        const allReminders = await db.all(`
            SELECT r.*, DATE_FORMAT(r.date, '%Y-%m-%d') as formatted_date
            FROM reminders r
            ORDER BY r.date, r.time
        `);
        
        console.log(`Total reminders in database: ${allReminders.length}`);
        
        // Filter for our specific date
        const remindersOnDate = allReminders.filter(r => {
            // Check various date formats
            const dateAsString = r.date.toString();
            const formattedDate = r.formatted_date;
            const dateObj = new Date(r.date);
            const adjustedDate = new Date(dateObj);
            adjustedDate.setHours(adjustedDate.getHours() + 3);
            const tzAdjustedDate = adjustedDate.toISOString().split('T')[0];
            
            // Log detailed debug for each reminder
            console.log(`Reminder ${r.reminder_id}:`);
            console.log(`- Raw date: ${r.date}`);
            console.log(`- Formatted: ${formattedDate}`);
            console.log(`- As string: ${dateAsString}`);
            console.log(`- TZ adjusted: ${tzAdjustedDate}`);
            console.log(`- Matches specific date: ${formattedDate === specificDate || tzAdjustedDate === specificDate}`);
            
            return formattedDate === specificDate || tzAdjustedDate === specificDate;
        });
        
        console.log(`Found ${remindersOnDate.length} reminders for date ${specificDate}`);
        
        // Now get the medications for these reminders
        const reminderIds = remindersOnDate.map(r => r.reminder_id);
        
        let medications = [];
        if (reminderIds.length > 0) {
            // Query for medications linked to these reminders
            medications = await db.all(`
                SELECT rm.*, m.name, m.strength, m.medication_type
                FROM reminder_medications rm
                JOIN medications m ON rm.medication_id = m.medication_id
                WHERE rm.reminder_id IN (${reminderIds.join(',')})
            `);
            
            console.log(`Found ${medications.length} medications for these reminders`);
            
            // For each reminder, check if there are associated medications
            for (const reminder of remindersOnDate) {
                const medsForReminder = medications.filter(m => m.reminder_id === reminder.reminder_id);
                console.log(`Reminder ${reminder.reminder_id} has ${medsForReminder.length} medications`);
                if (medsForReminder.length > 0) {
                    console.log(`First medication: ${JSON.stringify(medsForReminder[0])}`);
                }
            }
        }
        
        res.status(200).json(
            formatSuccessResponse({
                specificDate,
                remindersFound: remindersOnDate.length,
                medicationsFound: medications.length,
                reminders: remindersOnDate,
                medications: medications
            })
        );
    } catch (err) {
        console.error(`Error in specific date debug:`, err);
        return res.status(500).json(
            formatErrorResponse(`Error in specific date debug`)
        );
    }
});

/**
 * @route POST /api/reminders/debug/create-test-data
 * @desc Create test medications and link them to existing reminders
 * @access Private
 */
router.post('/debug/create-test-data', verifyToken, async (req, res) => {
    try {
        // First check if user already has medications
        const existingMedications = await db.all(
            'SELECT COUNT(*) as count FROM medications WHERE user_id = ?',
            [req.userId]
        );
        
        if (existingMedications[0].count > 0) {
            return res.status(200).json(
                formatSuccessResponse({
                    message: `User already has ${existingMedications[0].count} medications, no test data created`,
                    existingCount: existingMedications[0].count
                })
            );
        }
        
        // Get user's reminders
        const reminders = await db.all(
            'SELECT reminder_id FROM reminders WHERE user_id = ? LIMIT 5',
            [req.userId]
        );
        
        if (reminders.length === 0) {
            return res.status(404).json(
                formatErrorResponse('No reminders found for this user to attach medications to')
            );
        }
        
        // Create some test medications
        const testMeds = [
            { name: 'Aspirin', medication_type: 'pill', strength: '500mg', icon: 'pill' },
            { name: 'Ibuprofen', medication_type: 'pill', strength: '200mg', icon: 'medicine' },
            { name: 'Paracetamol', medication_type: 'pill', strength: '500mg', icon: 'pill' },
            { name: 'Allergex', medication_type: 'tablet', strength: '120mg', icon: 'antihistamines' },
            { name: 'Antibiotics', medication_type: 'capsule', strength: '250mg', icon: 'antibiotics' }
        ];
        
        const medicationIds = [];
        
        // Insert each medication
        for (const med of testMeds) {
            const result = await db.run(
                `INSERT INTO medications 
                (user_id, name, medication_type, strength, icon, description) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [req.userId, med.name, med.medication_type, med.strength, med.icon, 'Test medication']
            );
            
            medicationIds.push(result.lastID);
        }
        
        // Link medications to reminders
        let reminderMedCount = 0;
        for (let i = 0; i < reminders.length; i++) {
            const reminderId = reminders[i].reminder_id;
            
            // Link 1-3 medications to each reminder
            const medCount = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < medCount; j++) {
                const medIndex = (i + j) % medicationIds.length;
                
                await db.run(
                    `INSERT INTO reminder_medications
                    (reminder_id, medication_id, dosage, status)
                    VALUES (?, ?, ?, ?)`,
                    [reminderId, medicationIds[medIndex], '1', 'pending']
                );
                reminderMedCount++;
            }
        }
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Test data created successfully',
                medications: medicationIds.length,
                reminderMedications: reminderMedCount
            })
        );
    } catch (err) {
        console.error('Error creating test medications:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to create test medication data: ' + err.message)
        );
    }
});

/**
 * @route GET /api/reminders/debug
 * @desc Get debug information about reminders
 * @access Private
 */
router.get('/debug', verifyToken, async (req, res) => {
    try {
        console.log('Running reminder debug for user:', req.userId);
        
        // Check if reminders table exists
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='reminders'`
        );
        
        if (!tableCheck) {
            return res.json(formatSuccessResponse({
                status: 'error',
                message: 'Reminders table does not exist'
            }));
        }
        
        // Count reminders
        const reminderCount = await db.get(
            `SELECT COUNT(*) as count FROM reminders WHERE user_id = ?`,
            [req.userId]
        );
        
        // Count reminder_medications
        const medicationLinkCount = await db.get(
            `SELECT COUNT(*) as count FROM reminder_medications rm
             JOIN reminders r ON rm.reminder_id = r.reminder_id
             WHERE r.user_id = ?`,
            [req.userId]
        );
        
        // Get sample data
        const reminderSample = await db.all(
            `SELECT r.reminder_id, r.date, r.time, r.title
             FROM reminders r
             WHERE r.user_id = ?
             ORDER BY r.created_at DESC
             LIMIT 5`,
            [req.userId]
        );
        
        // Get sample medication links
        const medicationLinkSample = await db.all(
            `SELECT rm.id, rm.reminder_id, rm.medication_id, rm.schedule_time, rm.status,
                    m.name as medication_name
             FROM reminder_medications rm
             JOIN reminders r ON rm.reminder_id = r.reminder_id
             JOIN medications m ON rm.medication_id = m.medication_id
             WHERE r.user_id = ?
             ORDER BY rm.created_at DESC
             LIMIT 5`,
            [req.userId]
        );
        
        // Check schema
        const reminderSchema = await db.all(
            `PRAGMA table_info(reminders)`
        );
        
        const reminderMedicationsSchema = await db.all(
            `PRAGMA table_info(reminder_medications)`
        );
        
        return res.json(formatSuccessResponse({
            summary: {
                reminderCount: reminderCount.count,
                medicationLinkCount: medicationLinkCount.count,
                tables: {
                    reminders: tableCheck ? 'exists' : 'missing',
                }
            },
            samples: {
                reminders: reminderSample,
                medicationLinks: medicationLinkSample
            },
            schema: {
                reminders: reminderSchema,
                reminderMedications: reminderMedicationsSchema
            }
        }));
    } catch (error) {
        console.error('Reminder debug error:', error);
        return res.status(500).json(
            formatErrorResponse(`Error running reminder debug: ${error.message}`)
        );
    }
});

module.exports = router;
