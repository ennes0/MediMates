/**
 * Authentication Routes
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { formatSuccessResponse, formatErrorResponse, generateRandomString } = require('../utils/helpers');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password || !name) {
            return res.status(400).json(
                formatErrorResponse('Email, password, and name are required')
            );
        }

        // Check if user already exists
        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json(
                formatErrorResponse('User already exists with this email')
            );
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        try {
            // Start a transaction
            const connection = await db.pool.getConnection();
            await connection.beginTransaction();

            try {
                // Insert into users table
                const [userResult] = await connection.query(
                    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
                    [email, hashedPassword]
                );
                
                const userId = userResult.insertId;

                // Insert into user_profiles table
                await connection.query(
                    'INSERT INTO user_profiles (user_id, name) VALUES (?, ?)',
                    [userId, name]
                );

                // Insert into user_preferences table with defaults
                await connection.query(
                    'INSERT INTO user_preferences (user_id) VALUES (?)',
                    [userId]
                );

                // Commit transaction
                await connection.commit();
                connection.release();

                res.status(201).json(
                    formatSuccessResponse({ userId, email, name }, 'User registered successfully')
                );
            } catch (error) {
                // Rollback on error
                await connection.rollback();
                connection.release();
                throw error;
            }
        } catch (error) {
            console.error('Error in transaction:', error);
            return res.status(500).json(
                formatErrorResponse('Failed to complete registration')
            );
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json(
            formatErrorResponse('Server error during registration')
        );
    }
});

/**
 * @route POST /api/auth/login
 * @desc Login user and return token
 * @access Public
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json(
                formatErrorResponse('Email and password are required')
            );
        }
        
        // Find user
        const user = await db.get(
            `SELECT u.user_id, u.email, u.password_hash, up.name, up.profile_picture 
             FROM users u
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.email = ? AND u.is_active = 1`,
            [email]
        );

        // Check if user exists
        if (!user) {
            return res.status(404).json(
                formatErrorResponse('User not found or account deactivated')
            );
        }

        // Validate password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);        if (!isValidPassword) {
            return res.status(401).json(
                formatErrorResponse('Invalid credentials')
            );
        }
        
        // Create JWT token
        const token = jwt.sign(
            { id: user.user_id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Calculate expiry date (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        // Format date as MySQL expects: YYYY-MM-DD HH:MM:SS
        const mysqlDatetime = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
        
        // Store token in database
        await db.run(
            'INSERT INTO authentication_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.user_id, token, mysqlDatetime]
        );

        // Update last login time
        await db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
            [user.user_id]
        );
        
        // Return user info and token
        res.status(200).json(
            formatSuccessResponse({
                token,
                user: {
                    id: user.user_id,
                    email: user.email,
                    name: user.name,
                    profilePicture: user.profile_picture
                }
            }, 'Login successful')
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json(
            formatErrorResponse('Server error during login')
        );
    }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user by invalidating token
 * @access Private (requires token)
 */
router.post('/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(400).json(
            formatErrorResponse('No token provided')
        );
    }
    
    try {
        // Delete token from database for logout
        await db.run(
            'DELETE FROM authentication_tokens WHERE token = ?',
            [token]
        );
        
        res.status(200).json(
            formatSuccessResponse({}, 'Logout successful')
        );
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json(
            formatErrorResponse('Server error during logout')
        );
    }
});

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh user token when the current one is about to expire
 * @access Private (requires token)
 */
router.post('/refresh-token', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(400).json(
            formatErrorResponse('No token provided')
        );
    }
    
    try {
        // Verify token without checking expiration
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        
        // Check if token exists in database
        const tokenRow = await db.get(
            'SELECT * FROM authentication_tokens WHERE token = ?',
            [token]
        );
        
        if (!tokenRow) {
            return res.status(401).json(
                formatErrorResponse('Token not found in database')
            );
        }
        
        // Create a new JWT token
        const newToken = jwt.sign(
            { id: decoded.id, email: decoded.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Calculate expiry date (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        // Format date as MySQL expects: YYYY-MM-DD HH:MM:SS
        const mysqlDatetime = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
        
        // Delete old token
        await db.run('DELETE FROM authentication_tokens WHERE token = ?', [token]);
        
        // Store new token in database
        await db.run(
            'INSERT INTO authentication_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [decoded.id, newToken, mysqlDatetime]
        );
        
        // Return new token
        res.status(200).json(
            formatSuccessResponse({
                token: newToken
            }, 'Token refreshed successfully')
        );
    } catch (error) {
        console.error('Error refreshing token:', error);
        return res.status(401).json(
            formatErrorResponse('Invalid token, cannot refresh')
        );
    }
});

module.exports = router;
