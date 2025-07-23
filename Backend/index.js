/**
 * MediMates API - Main Server File
 * Express REST API backend for medication management application
 */

// Import dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Import database initializer
const { db, checkReminderMedicationsSchema } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const medicationRoutes = require('./routes/medication.routes.fixed');
const reminderRoutes = require('./routes/reminder.routes.fixed');
const contactRoutes = require('./routes/contact.routes.fixed');
const chatRoutes = require('./routes/chat.routes.fixed');

// Create Express app
const app = express();

// Set port
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'))); // Also serve under /api/uploads for client compatibility

// Initialize uploads directory
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database is already initialized through the connection pool
console.log('Database connection established through pool');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/chats', chatRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to MediMates API',
        version: '1.0.0',
        status: 'active' 
    });
});

// Health check endpoint
app.get('/api/health-check', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        message: 'MediMates API is running'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Check database schema
    checkReminderMedicationsSchema()
        .then(() => console.log('Database schema check completed'))
        .catch(err => console.error('Schema check failed:', err));
});
