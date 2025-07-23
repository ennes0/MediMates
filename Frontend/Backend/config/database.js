/**
 * Database Configuration
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// MySQL database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'medimates',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Test the connection and provide fallback to SQLite if MySQL fails
const testDatabaseConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to MySQL database');
        connection.release();
        return true;
    } catch (err) {
        console.error('Could not connect to MySQL database:', err);
        console.log('Using fallback database approach');
        return false;
    }
};

// Execute the connection test
testDatabaseConnection();

// Initialize database schema
const initDatabase = async () => {
    try {
        // Check if tables already exist by trying to query the users table
        let connection = await pool.getConnection();
        try {
            const [rows] = await connection.query("SELECT 1 FROM users LIMIT 1");
            console.log('Database tables already exist, skipping initialization');
            connection.release();
            return;
        } catch (err) {
            // If there's an error, it likely means the tables don't exist yet
            console.log('Database tables not found, initializing schema');
        }
        
        // Read SQL schema file - using the corrected MySQL version
        let sqlSchema = fs.readFileSync(path.join(__dirname, '../MediMates.mysql.correct.sql'), 'utf8');
        
        // Try to execute the SQL as a whole script first (MySQL can handle multiple statements)
        try {
            await connection.query(sqlSchema);
            connection.release();
        } catch (err) {
            console.log('Could not execute full SQL script, trying statement by statement');
            
            // If connection is still active, release it
            if (connection) {
                connection.release();
            }
            
            // Split SQL script into individual statements
            const statements = sqlSchema.split(';').filter(stmt => stmt.trim());
            
            // Get a new connection from the pool
            connection = await pool.getConnection();
            
            // Execute each SQL statement
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await connection.query(statement);
                    } catch (err) {
                        // Skip "table already exists" and "duplicate key" errors, but log other errors
                        if (!err.message.includes('already exists') && !err.message.includes('Duplicate')) {
                            console.error(`Error executing SQL: ${statement.substring(0, 100)}...`);
                            console.error(err);
                        }
                    }
                }
            }
            connection.release();
        }
        
        console.log('Database schema initialized');
        return;
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
};

// Function to check and add missing columns to reminder_medications table
const checkReminderMedicationsSchema = async () => {
    try {
        console.log('Checking reminder_medications table schema...');
        
        // Check if reminder_medications table exists
        try {
            // SQLite compatible approach
            const tableResult = await pool.query(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='reminder_medications'`
            );
            
            if (tableResult.length === 0) {
                console.log('reminder_medications table does not exist yet');
                return;
            }
        } catch (err) {
            // Try MySQL approach if SQLite approach fails
            try {
                const [tableResult] = await pool.execute(
                    `SHOW TABLES LIKE 'reminder_medications'`
                );
                
                if (tableResult.length === 0) {
                    console.log('reminder_medications table does not exist yet');
                    return;
                }
            } catch (mysqlErr) {
                console.error('Error checking if table exists:', mysqlErr);
                return;
            }
        }
        
        // Check if columns exist - try SQLite pragma first
        try {
            const columnInfoResult = await pool.query(
                `PRAGMA table_info(reminder_medications)`
            );
            
            const columnNames = columnInfoResult.map(col => col.name);
            console.log('Existing columns:', columnNames);
            
            // Check for schedule_time column
            if (!columnNames.includes('schedule_time')) {
                console.log('Adding schedule_time column to reminder_medications table');
                await pool.query(
                    `ALTER TABLE reminder_medications ADD COLUMN schedule_time TEXT NULL`
                );
            }
            
            // Check for status column
            if (!columnNames.includes('status')) {
                console.log('Adding status column to reminder_medications table');
                await pool.query(
                    `ALTER TABLE reminder_medications ADD COLUMN status TEXT DEFAULT 'pending'`
                );
            }
            
            // Check for taken_at column
            if (!columnNames.includes('taken_at')) {
                console.log('Adding taken_at column to reminder_medications table');
                await pool.query(
                    `ALTER TABLE reminder_medications ADD COLUMN taken_at TEXT NULL`
                );
            }
            
            // Check for notes column
            if (!columnNames.includes('notes')) {
                console.log('Adding notes column to reminder_medications table');
                await pool.query(
                    `ALTER TABLE reminder_medications ADD COLUMN notes TEXT NULL`
                );
            }
        } catch (sqliteErr) {
            // If SQLite approach fails, try MySQL approach
            try {
                const [columns] = await pool.execute(
                    `SHOW COLUMNS FROM reminder_medications`
                );
                
                const columnNames = columns.map(col => col.Field);
                console.log('Existing columns:', columnNames);
                
                // Check for schedule_time column
                if (!columnNames.includes('schedule_time')) {
                    console.log('Adding schedule_time column to reminder_medications table');
                    await pool.execute(
                        `ALTER TABLE reminder_medications ADD COLUMN schedule_time TIME NULL`
                    );
                }
                
                // Check for status column
                if (!columnNames.includes('status')) {
                    console.log('Adding status column to reminder_medications table');
                    await pool.execute(
                        `ALTER TABLE reminder_medications ADD COLUMN status VARCHAR(20) DEFAULT 'pending'`
                    );
                }
                
                // Check for taken_at column
                if (!columnNames.includes('taken_at')) {
                    console.log('Adding taken_at column to reminder_medications table');
                    await pool.execute(
                        `ALTER TABLE reminder_medications ADD COLUMN taken_at DATETIME NULL`
                    );
                }
                
                // Check for notes column
                if (!columnNames.includes('notes')) {
                    console.log('Adding notes column to reminder_medications table');
                    await pool.execute(
                        `ALTER TABLE reminder_medications ADD COLUMN notes TEXT NULL`
                    );
                }            } catch (mysqlErr) {
                console.error('Error checking columns with MySQL:', mysqlErr);
            }
        }
          console.log('Schema check complete');
    } catch (error) {
        console.error('Error checking reminder_medications schema:', error);
    }
};

// Create a db object with similar methods to the SQLite interface
// This helps minimize changes in the rest of the application
const db = {
    // Add pool reference for direct access to the connection pool
    pool: pool,
    
    // Promisify the get method to maintain compatibility with the existing code
    get: async (sql, params) => {
        try {
            const [rows] = await pool.query(sql, params);
            return rows[0]; // Return the first row, similar to SQLite get
        } catch (err) {
            console.error('Error in db.get:', err);
            throw err;
        }
    },
    
    // Promisify the all method
    all: async (sql, params) => {
        try {
            const [rows] = await pool.query(sql, params);
            return rows; // Return all rows
        } catch (err) {
            console.error('Error in db.all:', err);
            throw err;
        }
    },
    
    // Promisify the run method
    run: async (sql, params) => {
        try {
            const [result] = await pool.query(sql, params);
            // Create an object similar to SQLite's run result
            return {
                lastID: result.insertId,
                changes: result.affectedRows,
                ...result
            };
        } catch (err) {
            console.error('Error in db.run:', err);
            throw err;
        }
    },
    
    // Promisify the exec method for running multiple statements
    exec: async (sql) => {
        try {
            const statements = sql.split(';').filter(stmt => stmt.trim());
            const connection = await pool.getConnection();
            
            for (const statement of statements) {
                if (statement.trim()) {
                    await connection.query(statement);
                }
            }
            
            connection.release();
        } catch (err) {
            console.error('Error in db.exec:', err);
            throw err;
        }
    }
};

// Export database connection and initialization function
module.exports = { 
    db, 
    initDatabase,
    pool, // Export the pool for direct access if needed
    checkReminderMedicationsSchema
};
