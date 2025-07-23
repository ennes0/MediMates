/**
 * Medication Routes
 */
const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { db } = require('../config/database');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * Helper function to check if a column exists in a table
 * @param {string} tableName - Name of the table
 * @param {string} columnName - Name of the column to check
 * @returns {Promise<boolean>} - Whether the column exists
 */
async function columnExists(tableName, columnName) {
    try {
        // Try MySQL's INFORMATION_SCHEMA approach
        const columns = await db.all(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [tableName, columnName]
        );
        
        return columns.length > 0;
    } catch (error) {
        console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
        // Default to assuming the column doesn't exist if we can't check
        return false;
    }
}

/**
 * @route GET /api/medications
 * @desc Get all medications for a user
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {    try {        // Debug: Log available tables first
        console.log("Checking available tables before query execution");
        try {
            const tables = await db.all("SHOW TABLES");
            console.log("Available tables:", tables);
        } catch (tableErr) {
            console.log("Error checking tables:", tableErr);
        }
        
        // Debug: Log the user ID from the token
        console.log("Fetching medications for authenticated user ID:", req.userId);
        
        // Debug: Count total medications in the database first
        try {
            const totalCount = await db.get("SELECT COUNT(*) as total FROM medications");
            console.log("Total medications in database:", totalCount.total);
        } catch (err) {
            console.log("Error counting total medications:", err);
        }
          
        // Use a more resilient query approach - first get just the core medication data
        const medications = await db.all(
            `SELECT * FROM medications WHERE user_id = ? ORDER BY name`,
            [req.userId]
        );
        
        console.log(`Found ${medications.length} medications for user ${req.userId}`);
        
        // Now for each medication, try to get inventory data
        for (const med of medications) {
            try {
                const inventory = await db.get(
                    `SELECT * FROM medication_inventory WHERE medication_id = ? LIMIT 1`,
                    [med.medication_id]
                );
                
                if (inventory) {
                    med.inventory = inventory;
                }
            } catch (invErr) {
                console.log(`Error getting inventory for medication ${med.medication_id}:`, invErr.message);
            }
            
            // Try to get schedule data
            try {
                const schedule = await db.get(
                    `SELECT * FROM medication_schedules WHERE medication_id = ? LIMIT 1`,
                    [med.medication_id]
                );
                
                if (schedule) {
                    med.schedule = schedule;
                }
            } catch (schedErr) {
                console.log(`Error getting schedule for medication ${med.medication_id}:`, schedErr.message);
            }
        }        res.status(200).json(
            formatSuccessResponse({
                medications: medications.map(med => {
                    // Extract inventory data if available
                    const inventory = med.inventory || {};
                    const schedule = med.schedule || {};
                    
                    // Log the full medication object for debugging
                    console.log(`Processing medication ${med.medication_id}:`, JSON.stringify(med));
                    
                    return {
                        id: med.medication_id,
                        name: med.name || 'Unknown Medication',
                        dosage: med.strength || schedule.dosage || '1 tablet',
                        pillType: med.icon || 'pill',
                        description: med.description || '',
                        iconType: med.icon || 'pill',
                        notes: schedule.special_instructions || med.instructions || '',
                        sideEffects: med.side_effects || '',
                        createdAt: med.created_at,
                        updatedAt: med.updated_at,
                        inventory: {
                            remainingQuantity: inventory.current_quantity || 0,
                            initialQuantity: inventory.current_quantity || 0,
                            unit: inventory.unit || 'tablets',
                            refillDate: inventory.last_refill_date || null,
                            refillReminder: inventory.refill_reminder_threshold > 0
                        }
                    };
                })
            })
        );
    } catch (err) {
        console.error('Error fetching medications:', err);
        
        // Log more details about the error for debugging
        console.log('SQL query that caused error:', err.sql);
        console.log('Error message:', err.sqlMessage);
        console.log('Error code:', err.code);
        
        return res.status(500).json(
            formatErrorResponse('Failed to fetch medications: ' + err.message)
        );
    }
});

/**
 * @route GET /api/medications/:id
 * @desc Get a specific medication by ID
 * @access Private
 */
router.get('/:id', verifyToken, async (req, res) => {
    const medicationId = req.params.id;
    
    try {
        // Get medication details
        const medication = await db.get(
            `SELECT m.medication_id, m.name, m.dosage, m.pill_type, m.description, m.icon_type,
                    m.created_at, m.updated_at, m.medication_type, m.active_ingredient,
                    mi.remaining_quantity, mi.unit, mi.refill_date, mi.refill_reminder_enabled, mi.refill_threshold,
                    ms.notes, ms.when_to_take, ms.side_effects
             FROM medications m
             LEFT JOIN medication_inventory mi ON m.medication_id = mi.medication_id
             LEFT JOIN medication_schedules ms ON m.medication_id = ms.medication_id
             WHERE m.medication_id = ? AND m.user_id = ?`,
            [medicationId, req.userId]
        );

        if (!medication) {
            return res.status(404).json(
                formatErrorResponse('Medication not found')
            );
        }

        // Get medication schedules
        const schedules = await db.all(
            `SELECT ms.schedule_id, ms.frequency, ms.start_date, ms.end_date, 
                    ms.notes, ms.when_to_take,
                    mt.time_id, mt.time_of_day, mt.specific_time, mt.dosage as time_dosage
             FROM medication_schedules ms
             LEFT JOIN medication_times mt ON ms.schedule_id = mt.schedule_id
             WHERE ms.medication_id = ?
             ORDER BY mt.specific_time`,
            [medicationId]
        );

        // Process schedules to group times by schedule
        const processedSchedules = [];
        const scheduleMap = {};
        
        schedules.forEach(item => {
            if (!scheduleMap[item.schedule_id]) {
                scheduleMap[item.schedule_id] = {
                    id: item.schedule_id,
                    frequency: item.frequency,
                    startDate: item.start_date,
                    endDate: item.end_date,
                    notes: item.notes,
                    whenToTake: item.when_to_take,
                    times: []
                };
                processedSchedules.push(scheduleMap[item.schedule_id]);
            }
            
            if (item.time_id) {
                scheduleMap[item.schedule_id].times.push({
                    id: item.time_id,
                    timeOfDay: item.time_of_day,
                    specificTime: item.specific_time,
                    dosage: item.time_dosage
                });
            }
        });

        res.status(200).json(
            formatSuccessResponse({
                id: medication.medication_id,
                name: medication.name,
                dosage: medication.dosage,
                pillType: medication.pill_type,
                description: medication.description,
                iconType: medication.icon_type,
                medicationType: medication.medication_type,
                activeIngredient: medication.active_ingredient,
                notes: medication.notes,
                sideEffects: medication.side_effects,
                whenToTake: medication.when_to_take,
                createdAt: medication.created_at,
                updatedAt: medication.updated_at,
                inventory: {
                    remainingQuantity: medication.remaining_quantity,
                    unit: medication.unit,
                    refillDate: medication.refill_date,
                    refillReminder: medication.refill_reminder_enabled === 1,
                    refillThreshold: medication.refill_threshold
                },
                schedules: processedSchedules
            })
        );
    } catch (err) {
        console.error('Error fetching medication details:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch medication details')
        );
    }
});

/**
 * @route GET /api/medications/debug/schema
 * @desc Debug endpoint to get medication schema information
 * @access Private
 */
router.get('/debug/schema', verifyToken, async (req, res) => {
    try {
        const debug = {};
          try {
            // Get all tables in the database (MySQL syntax)
            debug.allTables = await db.all("SHOW TABLES");
        } catch (e) {
            debug.tableListError = e.message;
            // Try alternative query for MySQL information_schema
            try {
                debug.allTables = await db.all("SELECT TABLE_NAME as name FROM information_schema.tables WHERE table_schema = DATABASE()");
            } catch (altErr) {
                debug.altTableListError = altErr.message;
            }
        }
        
        // Try to get schema for medications table
        try {
            debug.medicationsSchema = await db.all("DESCRIBE medications");
        } catch (e1) {
            debug.medicationsSchemaError = e1.message;
            // Try alternative for MySQL information_schema
            try {
                debug.medicationsSchema = await db.all("SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'medications'");
            } catch (altErr) {
                debug.altMedicationsSchemaError = altErr.message;
            }
        }
        
        // Try to get schema for medication_inventory table
        try {
            debug.inventorySchema = await db.all("DESCRIBE medication_inventory");
        } catch (e2) {
            debug.inventorySchemaError = e2.message;
            try {
                debug.inventorySchema = await db.all("SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'medication_inventory'");
            } catch (altErr) {
                debug.altInventorySchemaError = altErr.message;
            }
        }
        
        // Try to get schema for medication_schedules table
        try {
            debug.schedulesSchema = await db.all("DESCRIBE medication_schedules");
        } catch (e3) {
            debug.schedulesSchemaError = e3.message;
            try {
                debug.schedulesSchema = await db.all("SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'medication_schedules'");
            } catch (altErr) {
                debug.altSchedulesSchemaError = altErr.message;
            }
        }
        
        // Get a sample of each table
        try {
            debug.medicationsSample = await db.all("SELECT * FROM medications LIMIT 1");
        } catch (e4) {
            debug.medicationsSampleError = e4.message;
        }
        
        try {
            debug.inventorySample = await db.all("SELECT * FROM medication_inventory LIMIT 1");
        } catch (e5) {
            debug.inventorySampleError = e5.message;
        }
        
        try {
            debug.schedulesSample = await db.all("SELECT * FROM medication_schedules LIMIT 1");
        } catch (e6) {
            debug.schedulesSampleError = e6.message;
        }
        
        // Get counts
        try {
            const counts = await db.all(`
                SELECT 
                    (SELECT COUNT(*) FROM medications) as medications_count,
                    (SELECT COUNT(*) FROM medications WHERE user_id = ?) as user_medications_count
            `, [req.userId]);
            debug.counts = counts[0];
        } catch (e7) {
            debug.countsError = e7.message;
        }
        
        res.status(200).json(formatSuccessResponse(debug));
    } catch (err) {
        console.error('Error getting medication schema:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to retrieve medication schema: ' + err.message)
        );
    }
});

/**
 * @route POST /api/medications/debug/create-test-data
 * @desc Create test medications for development testing
 * @access Private
 */
router.post('/debug/create-test-data', verifyToken, async (req, res) => {
    try {
        // Check if user already has medications
        const existingMeds = await db.all(
            'SELECT COUNT(*) as count FROM medications WHERE user_id = ?',
            [req.userId]
        );
        
        if (existingMeds[0].count > 0) {
            return res.status(200).json(
                formatSuccessResponse({
                    message: `User already has ${existingMeds[0].count} medications`,
                    existingCount: existingMeds[0].count
                })
            );
        }
        
        // Sample medications to create
        const testMeds = [
            {
                name: 'Aspirin',
                description: 'Pain relief and anti-inflammatory',
                medication_type: 'NSAID',
                strength: '500mg',
                icon: 'pill',
                color: 'white',
                side_effects: 'Stomach irritation, risk of bleeding'
            },
            {
                name: 'Ibuprofen',
                description: 'Pain and fever reducer',
                medication_type: 'NSAID',
                strength: '200mg',
                icon: 'medicine',
                color: 'blue',
                side_effects: 'Stomach upset, dizziness'
            },
            {
                name: 'Paracetamol',
                description: 'Pain and fever reliever',
                medication_type: 'Analgesic',
                strength: '500mg',
                icon: 'pill',
                color: 'white',
                side_effects: 'Liver damage in high doses'
            },
            {
                name: 'Allegra',
                description: 'Antihistamine for allergies',
                medication_type: 'Antihistamine',
                strength: '120mg',
                icon: 'antihistamines',
                color: 'orange',
                side_effects: 'Drowsiness, dry mouth'
            },
            {
                name: 'Amoxicillin',
                description: 'Antibiotic for bacterial infections',
                medication_type: 'Antibiotic',
                strength: '250mg',
                icon: 'antibiotics',
                color: 'blue',
                side_effects: 'Diarrhea, rash, nausea'
            }
        ];
        
        // Insert each medication
        const results = [];
        
        for (const med of testMeds) {
            const result = await db.run(
                `INSERT INTO medications 
                (user_id, name, description, medication_type, strength, icon, color, side_effects)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.userId, 
                    med.name, 
                    med.description, 
                    med.medication_type, 
                    med.strength,
                    med.icon, 
                    med.color, 
                    med.side_effects
                ]
            );
            
            results.push({
                id: result.lastID,
                name: med.name
            });
              // Also create inventory record
            await db.run(
                `INSERT INTO medication_inventory
                (medication_id, current_quantity, unit, refill_reminder_threshold)
                VALUES (?, ?, ?, ?)`,
                [result.lastID, Math.floor(Math.random() * 30) + 5, 'tablets', 5]
            );
              // Create medication schedule
            await db.run(
                `INSERT INTO medication_schedules
                (medication_id, start_date, frequency, times_per_day, dosage, dosage_unit, special_instructions)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    result.lastID,
                    new Date().toISOString().split('T')[0],
                    'daily',
                    1,
                    '1',
                    'tablet',
                    'Take with water after meals'
                ]
            );
        }
        
        res.status(200).json(
            formatSuccessResponse({
                message: `Created ${results.length} test medications`,
                medications: results
            })
        );
    } catch (err) {
        console.error('Error creating test medications:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to create test medications: ' + err.message)
        );
    }
});

/**
 * @route POST /api/medications/debug/create-simple-meds
 * @desc Create simple test medications with minimal fields
 * @access Private
 */
router.post('/debug/create-simple-meds', verifyToken, async (req, res) => {
    try {
        // Check if user already has medications
        const existingMeds = await db.all(
            'SELECT COUNT(*) as count FROM medications WHERE user_id = ?',
            [req.userId]
        );
        
        if (existingMeds[0].count > 0) {
            return res.status(200).json(
                formatSuccessResponse({
                    message: `User already has ${existingMeds[0].count} medications`,
                    existingCount: existingMeds[0].count
                })
            );
        }
        
        // Create simple test medications with just the required fields
        const testMeds = [
            { name: 'Aspirin', strength: '500mg', icon: 'pill' },
            { name: 'Ibuprofen', strength: '200mg', icon: 'medicine' },
            { name: 'Paracetamol', strength: '500mg', icon: 'pill' },
            { name: 'Allegra', strength: '120mg', icon: 'antihistamines' },
            { name: 'Amoxicillin', strength: '250mg', icon: 'antibiotics' }
        ];
        
        const results = [];
        
        // Insert each medication with minimal fields
        for (const med of testMeds) {            // Use a simple INSERT that should work with MySQL
            const result = await db.run(
                `INSERT INTO medications (user_id, name, strength, icon) VALUES (?, ?, ?, ?)`,
                [req.userId, med.name, med.strength, med.icon]
            );
            
            results.push({
                id: result.lastID,
                name: med.name
            });
        }
        
        res.status(200).json(
            formatSuccessResponse({
                message: `Created ${results.length} simple test medications`,
                medications: results
            })
        );
    } catch (err) {
        console.error('Error creating simple test medications:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to create test medications: ' + err.message)
        );
    }
});

/**
 * @route GET /api/medications/health-check
 * @desc Simple endpoint to check if the medication API is responding
 * @access Public
 */
router.get('/health-check', async (req, res) => {
    try {
        // First perform a simple database query to verify connection
        let dbStatus = 'unknown';
        let dbMessage = '';
        let tables = [];        
        try {
            // Try to query a simple table count (MySQL version)
            const result = await db.get('SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = DATABASE()');
            tables = await db.all('SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE()');
            
            dbStatus = 'connected';
            dbMessage = `Database connected, found ${result.table_count} tables`;
        } catch (dbErr) {
            dbStatus = 'error';
            dbMessage = dbErr.message;
        }
        
        res.status(200).json({
            status: 'ok',
            message: 'Medication API is working',
            timestamp: new Date().toISOString(),
            database: {
                status: dbStatus,
                message: dbMessage,
                tables: tables.map(t => t.name)
            }
        });
    } catch (err) {
        console.error('Error in health check:', err);
        res.status(500).json({
            status: 'error',
            message: 'Health check failed: ' + err.message
        });
    }
});

/**
 * @route POST /api/medications
 * @desc Add a new medication for the user
 * @access Private
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        console.log('Adding new medication for user:', req.userId);
        console.log('Medication data:', JSON.stringify(req.body));

        // Check required fields
        const { name, dosage } = req.body;
        if (!name || !dosage) {
            return res.status(400).json(
                formatErrorResponse('Medication name and dosage are required')
            );
        }        // Start a database transaction with MySQL syntax
        await db.run('START TRANSACTION');        try {
            // Check for essential columns using our helper function
            const hasStrengthColumn = await columnExists('medications', 'strength');
            const hasIconColumn = await columnExists('medications', 'icon');
            const hasIconTypeColumn = await columnExists('medications', 'icon_type');
            const hasSideEffectsColumn = await columnExists('medications', 'side_effects');
            const hasInstructionsColumn = await columnExists('medications', 'instructions');
            const hasActiveIngredientColumn = await columnExists('medications', 'active_ingredient');
            
            console.log("Column checks:", {
                strength: hasStrengthColumn,
                icon: hasIconColumn,
                icon_type: hasIconTypeColumn,
                side_effects: hasSideEffectsColumn,
                instructions: hasInstructionsColumn,
                active_ingredient: hasActiveIngredientColumn
            });            // Use a simpler and more compatible approach
            console.log("Attempting simple insert with essential fields");
            
            // Start with the absolute minimum required fields
            const medInsertResult = await db.run(
                `INSERT INTO medications (user_id, name) VALUES (?, ?)`,
                [req.userId, name]
            );
            
            const newMedicationId = medInsertResult.lastID;
            console.log('Created basic medication with ID:', newMedicationId);
            
            // Now try to update with additional fields if they exist
            if (hasStrengthColumn) {
                await db.run(
                    `UPDATE medications SET strength = ? WHERE medication_id = ?`,
                    [dosage, newMedicationId]
                );
                console.log('Updated strength column');
            }
            
            if (hasIconColumn) {
                await db.run(
                    `UPDATE medications SET icon = ? WHERE medication_id = ?`,
                    [req.body.icon_type || 'medicine', newMedicationId]
                );
                console.log('Updated icon column');
            } else if (hasIconTypeColumn) {
                await db.run(
                    `UPDATE medications SET icon_type = ? WHERE medication_id = ?`,
                    [req.body.icon_type || 'medicine', newMedicationId]
                );
                console.log('Updated icon_type column');
            }
            
            // Continue with more updates for other fields
            await db.run(
                `UPDATE medications SET description = ?, color = ? WHERE medication_id = ?`,
                [req.body.description || '', req.body.color || '#FFFFFF', newMedicationId]
            );
            
            if (hasActiveIngredientColumn) {
                await db.run(
                    `UPDATE medications SET active_ingredient = ? WHERE medication_id = ?`,
                    [req.body.active_ingredient || '', newMedicationId]
                );
            }
            
            if (hasSideEffectsColumn) {
                await db.run(
                    `UPDATE medications SET side_effects = ? WHERE medication_id = ?`,
                    [req.body.side_effects || '', newMedicationId]
                );
            }
            
            if (hasInstructionsColumn) {
                await db.run(
                    `UPDATE medications SET instructions = ? WHERE medication_id = ?`,
                    [req.body.notes || '', newMedicationId]
                );
            }
              // We've already created the medication record with the simple approach above
            // No need to execute another INSERT statement            // Insert inventory record if quantity data provided
            const remainingQuantity = parseInt(req.body.remaining_quantity) || 0;
            try {
                await db.run(
                    `INSERT INTO medication_inventory
                    (medication_id, current_quantity, unit, refill_reminder_threshold, last_refill_date)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        newMedicationId,
                        remainingQuantity,
                        req.body.unit || 'tablet',
                        5, // Default threshold
                        req.body.refill_date || null
                    ]
                );
                console.log('Added inventory record');
            } catch (invErr) {
                console.error('Error adding inventory:', invErr);
                // Continue anyway since this is not critical
            }

            // Insert a schedule record
            let scheduleId;
            try {
                const scheduleResult = await db.run(
                    `INSERT INTO medication_schedules
                    (medication_id, start_date, end_date, frequency, times_per_day, dosage, dosage_unit, special_instructions, when_to_take)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newMedicationId,
                        req.body.start_date || new Date().toISOString().split('T')[0],
                        req.body.end_date || null,
                        req.body.frequency || 'daily',
                        1, // Default times per day
                        dosage.split(' ')[0] || '1', // Extract numeric part of dosage
                        req.body.unit || 'tablet',
                        req.body.notes || '',
                        req.body.when_to_take || ''
                    ]
                );
                
                scheduleId = scheduleResult.lastID;
                console.log('Added schedule record with ID:', scheduleId);
            } catch (schedErr) {
                console.error('Error adding schedule:', schedErr);
                // Continue anyway since we can still add the medication without a schedule
            }            // Add reminder times if provided and we have a valid scheduleId
            if (scheduleId) {
                try {
                    if (req.body.reminder_times && Array.isArray(req.body.reminder_times)) {
                        for (const reminder of req.body.reminder_times) {
                            await db.run(
                                `INSERT INTO medication_times
                                (schedule_id, time_of_day, specific_time)
                                VALUES (?, ?, ?)`,
                                [
                                    scheduleId,
                                    reminder.time_of_day || 'morning',
                                    reminder.time || '08:00'
                                ]
                            );
                        }
                        console.log('Added reminder times from array');
                    } else {
                        // Add a default reminder time
                        await db.run(
                            `INSERT INTO medication_times
                            (schedule_id, time_of_day, specific_time)
                            VALUES (?, ?, ?)`,
                            [
                                scheduleId,
                                'morning',
                                req.body.time || '08:00'
                            ]
                        );
                        console.log('Added default reminder time');
                    }
                } catch (timeErr) {
                    console.error('Error adding medication times:', timeErr);
                    // Continue anyway since this is not critical
                }
            }// Commit the transaction using MySQL syntax
            await db.run('COMMIT');            // Return the created medication ID and success message
            res.status(201).json(
                formatSuccessResponse({
                    message: 'Medication added successfully',
                    medicationId: newMedicationId,
                    medication: {
                        id: newMedicationId,
                        name: name,
                        dosage: dosage
                    }
                })
            );
        } catch (err) {
            // Rollback on error using MySQL syntax
            console.error('Transaction error:', err);
            try {
                await db.run('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Error during rollback:', rollbackErr);
            }
            throw err;
        }
    } catch (err) {
        console.error('Error adding medication:', err);
        
        // More detailed error information
        let errorMessage = 'Failed to add medication';
        if (err.code) {
            errorMessage += ` (Error code: ${err.code})`;
        }
        if (err.message) {
            errorMessage += `: ${err.message}`;
        }
        
        return res.status(500).json(
            formatErrorResponse(errorMessage)
        );
    }
});

/**
 * @route POST /api/medications/simple
 * @desc Add a new medication with minimal fields - fallback for compatibility
 * @access Private
 */
router.post('/simple', verifyToken, async (req, res) => {
    try {
        console.log('Adding simple medication for user:', req.userId);
        
        // Only require the absolute minimum fields
        const { name } = req.body;
        if (!name) {
            return res.status(400).json(
                formatErrorResponse('Medication name is required')
            );
        }
        
        // Insert with only the most basic fields that should be in any schema
        const result = await db.run(
            `INSERT INTO medications (user_id, name) VALUES (?, ?)`,
            [req.userId, name]
        );
        
        const medicationId = result.lastID;
        
        res.status(201).json(
            formatSuccessResponse({
                message: 'Simple medication added successfully',
                medicationId,
                medication: {
                    id: medicationId,
                    name: name
                }
            })
        );
    } catch (err) {
        console.error('Error adding simple medication:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to add simple medication: ' + err.message)
        );
    }
});

/**
 * @route PUT /api/medications/:id
 * @desc Update an existing medication
 * @access Private
 */
router.put('/:id', verifyToken, async (req, res) => {    try {
        const medicationId = req.params.id;
        console.log(`Updating medication ${medicationId} for user ${req.userId}`);
        console.log('Update data:', JSON.stringify(req.body));
        
        // Log date fields specifically to debug date-related issues
        if (req.body.start_date) {
            console.log('start_date received:', req.body.start_date, 'type:', typeof req.body.start_date);
        }
        if (req.body.end_date) {
            console.log('end_date received:', req.body.end_date, 'type:', typeof req.body.end_date);
        }

        // First check if the medication exists and belongs to this user
        const medication = await db.get(
            `SELECT * FROM medications WHERE medication_id = ? AND user_id = ?`,
            [medicationId, req.userId]
        );

        if (!medication) {
            return res.status(404).json(
                formatErrorResponse(`Medication not found or not authorized to update`)
            );
        }

        // Start a transaction
        await db.run('START TRANSACTION');

        try {
            // Get column info to handle different schema variations
            const hasStrengthColumn = await columnExists('medications', 'strength');
            const hasIconColumn = await columnExists('medications', 'icon');
            const hasIconTypeColumn = await columnExists('medications', 'icon_type');
            const hasSideEffectsColumn = await columnExists('medications', 'side_effects');
            const hasInstructionsColumn = await columnExists('medications', 'instructions');
            const hasActiveIngredientColumn = await columnExists('medications', 'active_ingredient');

            // Update the medication table - only update fields that are provided
            const { name, description, dosage, medication_type, active_ingredient, 
                    icon_type, color, side_effects, notes } = req.body;

            // Build update statement dynamically
            const updateFields = [];
            const updateParams = [];

            if (name) {
                updateFields.push('name = ?');
                updateParams.push(name);
            }
            
            if (description !== undefined) {
                updateFields.push('description = ?');
                updateParams.push(description);
            }
            
            if (medication_type !== undefined) {
                updateFields.push('medication_type = ?');
                updateParams.push(medication_type);
            }
            
            if (dosage && hasStrengthColumn) {
                updateFields.push('strength = ?');
                updateParams.push(dosage);
            }
            
            if (active_ingredient !== undefined && hasActiveIngredientColumn) {
                updateFields.push('active_ingredient = ?');
                updateParams.push(active_ingredient);
            }
            
            if (icon_type && hasIconTypeColumn) {
                updateFields.push('icon_type = ?');
                updateParams.push(icon_type);
            } else if (icon_type && hasIconColumn) {
                updateFields.push('icon = ?');
                updateParams.push(icon_type);
            }
            
            if (color) {
                updateFields.push('color = ?');
                updateParams.push(color);
            }
            
            if (side_effects !== undefined && hasSideEffectsColumn) {
                updateFields.push('side_effects = ?');
                updateParams.push(side_effects);
            }
            
            if (notes !== undefined && hasInstructionsColumn) {
                updateFields.push('instructions = ?');
                updateParams.push(notes);
            }

            // Only update if there are fields to update
            if (updateFields.length > 0) {
                // Add medicationId to params
                updateParams.push(medicationId);
                
                const updateSql = `UPDATE medications SET ${updateFields.join(', ')} WHERE medication_id = ?`;
                console.log('Update SQL:', updateSql);
                
                await db.run(updateSql, updateParams);
                console.log('Updated medication table');
            }

            // Update inventory if provided
            if (req.body.remaining_quantity !== undefined || req.body.unit || req.body.refill_date) {
                const inventory = await db.get(
                    `SELECT * FROM medication_inventory WHERE medication_id = ?`,
                    [medicationId]
                );

                if (inventory) {
                    // Update existing inventory
                    const invUpdateFields = [];
                    const invUpdateParams = [];

                    if (req.body.remaining_quantity !== undefined) {
                        invUpdateFields.push('current_quantity = ?');
                        invUpdateParams.push(req.body.remaining_quantity);
                    }

                    if (req.body.unit) {
                        invUpdateFields.push('unit = ?');
                        invUpdateParams.push(req.body.unit);
                    }

                    if (req.body.refill_date) {
                        invUpdateFields.push('last_refill_date = ?');
                        invUpdateParams.push(req.body.refill_date);
                    }

                    if (invUpdateFields.length > 0) {
                        invUpdateParams.push(medicationId);
                        await db.run(
                            `UPDATE medication_inventory SET ${invUpdateFields.join(', ')} WHERE medication_id = ?`,
                            invUpdateParams
                        );
                        console.log('Updated inventory');
                    }
                } else {
                    // Create inventory if it doesn't exist
                    await db.run(
                        `INSERT INTO medication_inventory 
                        (medication_id, current_quantity, unit, refill_reminder_threshold, last_refill_date)
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            medicationId,
                            req.body.remaining_quantity || 0,
                            req.body.unit || 'tablet',
                            5, // Default threshold
                            req.body.refill_date || null
                        ]
                    );
                    console.log('Created inventory');
                }
            }

            // Update schedule if provided
            if (req.body.frequency || req.body.start_date || req.body.end_date) {
                const schedule = await db.get(
                    `SELECT * FROM medication_schedules WHERE medication_id = ?`,
                    [medicationId]
                );

                if (schedule) {
                    // Update existing schedule
                    const schedUpdateFields = [];
                    const schedUpdateParams = [];

                    if (req.body.frequency) {
                        schedUpdateFields.push('frequency = ?');
                        schedUpdateParams.push(req.body.frequency);
                    }                    // Ensure start_date is always updated if provided
                    if (req.body.start_date) {
                        // Remove time portion if present to ensure proper date format
                        const formattedStartDate = req.body.start_date.split('T')[0];
                        console.log(`Formatting start_date: ${req.body.start_date} => ${formattedStartDate}`);
                        schedUpdateFields.push('start_date = ?');
                        schedUpdateParams.push(formattedStartDate);
                    }

                    // Ensure end_date is always updated if provided
                    if (req.body.end_date) {
                        // Remove time portion if present to ensure proper date format
                        const formattedEndDate = req.body.end_date.split('T')[0];
                        console.log(`Formatting end_date: ${req.body.end_date} => ${formattedEndDate}`);
                        schedUpdateFields.push('end_date = ?');
                        schedUpdateParams.push(formattedEndDate);
                    }

                    if (req.body.notes !== undefined) {
                        schedUpdateFields.push('special_instructions = ?');
                        schedUpdateParams.push(req.body.notes);
                    }                    // when_to_take alanı için kontrol
                    if (req.body.when_to_take !== undefined) {
                        // Sütunun var olup olmadığını kontrol et
                        const hasWhenToTakeColumn = await columnExists('medication_schedules', 'when_to_take');
                        if (hasWhenToTakeColumn) {
                            schedUpdateFields.push('when_to_take = ?');
                            schedUpdateParams.push(req.body.when_to_take);
                        } else {
                            console.log('when_to_take column does not exist in medication_schedules table, skipping this field');
                            // Alternatif olarak special_instructions alanına eklenebilir
                            if (!schedUpdateFields.includes('special_instructions = ?')) {
                                schedUpdateFields.push('special_instructions = CONCAT(IFNULL(special_instructions, ""), " (When to take: ', req.body.when_to_take, ')")');
                                // Bu bir string literal olduğu için params'a bir şey eklemiyoruz
                            }
                        }
                    }

                    if (schedUpdateFields.length > 0) {
                        schedUpdateParams.push(medicationId);
                        await db.run(
                            `UPDATE medication_schedules SET ${schedUpdateFields.join(', ')} WHERE medication_id = ?`,
                            schedUpdateParams
                        );
                        console.log('Updated schedule');
                    }
                } else {                    // Create schedule if it doesn't exist - with when_to_take
                    try {
                        // Önce when_to_take sütunu var mı kontrol et
                        const hasWhenToTakeColumn = await columnExists('medication_schedules', 'when_to_take');
                        
                        if (hasWhenToTakeColumn) {                            // Ensure dates are properly formatted before insertion
                            const formattedStartDate = req.body.start_date ? req.body.start_date.split('T')[0] : new Date().toISOString().split('T')[0];
                            const formattedEndDate = req.body.end_date ? req.body.end_date.split('T')[0] : null;
                            
                            console.log(`Creating schedule with start_date: ${formattedStartDate}, end_date: ${formattedEndDate}`);
                            
                            await db.run(
                                `INSERT INTO medication_schedules
                                (medication_id, start_date, end_date, frequency, times_per_day, dosage, dosage_unit, special_instructions, when_to_take)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    medicationId,
                                    formattedStartDate,
                                    formattedEndDate,
                                    req.body.frequency || 'daily',
                                    1,
                                    req.body.dosage?.split(' ')[0] || '1',
                                    req.body.unit || 'tablet',
                                    req.body.notes || '',
                                    req.body.when_to_take || null
                                ]
                            );
                        } else {
                            // Sütun yoksa eski şemayla devam et                            // Ensure dates are properly formatted before insertion
                            const formattedStartDate = req.body.start_date ? req.body.start_date.split('T')[0] : new Date().toISOString().split('T')[0];
                            const formattedEndDate = req.body.end_date ? req.body.end_date.split('T')[0] : null;
                            
                            console.log(`Creating schedule with start_date: ${formattedStartDate}, end_date: ${formattedEndDate}`);
                            
                            await db.run(
                                `INSERT INTO medication_schedules
                                (medication_id, start_date, end_date, frequency, times_per_day, dosage, dosage_unit, special_instructions)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    medicationId,
                                    formattedStartDate,
                                    formattedEndDate,
                                    req.body.frequency || 'daily',
                                    1,
                                    req.body.dosage?.split(' ')[0] || '1',
                                    req.body.unit || 'tablet',
                                    req.body.notes || ''
                                ]
                            );
                        }
                    } catch (scheduleErr) {
                        console.error('Error creating schedule:', scheduleErr);
                        // Continue anyway as this is not critical
                    }
                    console.log('Created schedule');
                }
            }

            // Update reminder times if provided
            if (req.body.reminder_times && Array.isArray(req.body.reminder_times)) {
                const schedule = await db.get(
                    `SELECT * FROM medication_schedules WHERE medication_id = ?`,
                    [medicationId]
                );
                
                if (schedule) {
                    // Delete existing times
                    await db.run(
                        `DELETE FROM medication_times WHERE schedule_id = ?`,
                        [schedule.schedule_id]
                    );                    // Add new times
                    for (const reminder of req.body.reminder_times) {
                        await db.run(
                            `INSERT INTO medication_times
                            (schedule_id, time_of_day)
                            VALUES (?, ?)`,
                            [
                                schedule.schedule_id,
                                reminder.time_of_day || '08:00'
                            ]
                        );
                    }
                    console.log('Updated reminder times');
                }
            }

            // Commit the transaction
            await db.run('COMMIT');

            res.status(200).json(
                formatSuccessResponse({
                    message: 'Medication updated successfully',
                    medicationId,
                    medication: {
                        id: medicationId,
                        ...req.body
                    }
                })
            );
        } catch (err) {
            // Rollback on error
            console.error('Transaction error:', err);
            try {
                await db.run('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Error during rollback:', rollbackErr);
            }
            throw err;
        }
    } catch (err) {
        console.error('Error updating medication:', err);
        
        let errorMessage = 'Failed to update medication';
        if (err.code) {
            errorMessage += ` (Error code: ${err.code})`;
        }
        if (err.message) {
            errorMessage += `: ${err.message}`;
        }
        
        return res.status(500).json(
            formatErrorResponse(errorMessage)
        );
    }
});

module.exports = router;
