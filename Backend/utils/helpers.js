/**
 * Utility functions for the API
 */

// Format error response
const formatErrorResponse = (message, details = null) => {
    return {
        success: false,
        message,
        details: details || {}
    };
};

// Format success response
const formatSuccessResponse = (data = {}, message = 'Success') => {
    return {
        success: true,
        message,
        data
    };
};

// Generate random string (useful for tokens)
const generateRandomString = (length = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Get current datetime in ISO format
const getCurrentDateTime = () => {
    return new Date().toISOString();
};

// Execute database queries as promises
const dbQuery = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Insert into database and return ID
const dbInsert = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
};

module.exports = {
    formatErrorResponse,
    formatSuccessResponse,
    generateRandomString,
    getCurrentDateTime,
    dbQuery,
    dbInsert
};
