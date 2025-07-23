/**
 * User Routes
 */
const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { db } = require('../config/database');
const { upload } = require('../middleware/upload.middleware');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/users/profile
 * @desc Get user's profile information
 * @access Private
 */
router.get('/profile', verifyToken, async (req, res) => {
    try {        const user = await db.get(            `SELECT u.user_id, u.email, u.created_at, u.last_login, 
                    up.name, up.profile_picture, up.phone, 
                    up.date_of_birth, up.gender, up.username
             FROM users u
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.user_id = ? AND u.is_active = 1`,
            [req.userId]
        );

        if (!user) {
            return res.status(404).json(
                formatErrorResponse('User not found or account deactivated')
            );
        }        // Ensure date_of_birth is properly formatted as YYYY-MM-DD
        let formattedDateOfBirth = user.date_of_birth;
        if (user.date_of_birth) {
            try {
                // Create a Date object (this handles ISO strings and MySQL date formats)
                const dateObj = new Date(user.date_of_birth);
                // Format as YYYY-MM-DD
                formattedDateOfBirth = dateObj.toISOString().split('T')[0];
            } catch (err) {
                console.error('Error formatting date in profile response:', err);
                // Keep original value if parsing fails
            }
        }

        res.status(200).json(
            formatSuccessResponse({
                userId: user.user_id,
                email: user.email,
                name: user.name,
                profilePicture: user.profile_picture,
                phoneNumber: user.phone,
                dateOfBirth: formattedDateOfBirth,
                gender: user.gender,
                username: user.username || '',
                createdAt: user.created_at,
                lastLogin: user.last_login
            })
        );
    } catch (err) {
        console.error('Error fetching profile:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch profile information')
        );
    }
});

/**
 * @route PUT /api/users/profile
 * @desc Update user profile information
 * @access Private
 */
router.put('/profile', verifyToken, async (req, res) => {
    const {
        name,
        phoneNumber,
        dateOfBirth,
        gender
        // Note: emergency contact fields aren't in the database schema yet
    } = req.body;try {        // Update profile in database
        // Use the correct column name 'phone' instead of 'phone_number'        // Format dateOfBirth to YYYY-MM-DD if it exists to ensure MySQL compatibility
        let formattedDateOfBirth = dateOfBirth;
        if (dateOfBirth) {
            // Try to parse and format the date correctly for MySQL
            try {
                // Create a new Date object from the input
                const dateObj = new Date(dateOfBirth);
                // Format it as YYYY-MM-DD
                formattedDateOfBirth = dateObj.toISOString().split('T')[0];
            } catch (err) {
                console.error('Error formatting date:', err);
                // If parsing fails, use the original value
            }
        }

        const result = await db.run(
            `UPDATE user_profiles 
             SET name = COALESCE(?, name),
                 phone = COALESCE(?, phone),
                 date_of_birth = COALESCE(?, date_of_birth),
                 gender = COALESCE(?, gender)
             WHERE user_id = ?`,
            [name, phoneNumber, formattedDateOfBirth, gender, req.userId]
        );

        if (result.changes === 0) {
            return res.status(404).json(
                formatErrorResponse('User profile not found')
            );
        }        // Fetch updated user data to ensure the response reflects actual database values
        const updatedUser = await db.get(
            `SELECT u.user_id, u.email, up.name, up.phone, up.date_of_birth, up.gender, up.username
             FROM users u
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.user_id = ?`,
            [req.userId]
        );        // Ensure date_of_birth is properly formatted as YYYY-MM-DD
        let formattedResponseDate = updatedUser.date_of_birth;
        if (updatedUser.date_of_birth) {
            try {
                // Create a Date object (this handles ISO strings and MySQL date formats)
                const dateObj = new Date(updatedUser.date_of_birth);
                // Format as YYYY-MM-DD
                formattedResponseDate = dateObj.toISOString().split('T')[0];
            } catch (err) {
                console.error('Error formatting date in update response:', err);
                // Keep original value if parsing fails
            }
        }        res.status(200).json(
            formatSuccessResponse({
                name: updatedUser.name,
                phoneNumber: updatedUser.phone,
                dateOfBirth: formattedResponseDate,
                gender: updatedUser.gender
                // We don't include emergency contact fields as they don't exist in the database
            })
        );
    } catch (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to update profile information')
        );
    }
});

/**
 * @route POST /api/users/upload-profile-picture
 * @desc Upload user profile picture
 * @access Private
 */
router.post('/upload-profile-picture', verifyToken, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(
                formatErrorResponse('No profile picture uploaded')
            );
        }        const profilePicUrl = `/uploads/${req.file.filename}`;
        
        // Update profile in database
        const result = await db.run(
            `UPDATE user_profiles SET profile_picture = ? WHERE user_id = ?`,
            [profilePicUrl, req.userId]
        );

        if (result.changes === 0) {
            return res.status(404).json(
                formatErrorResponse('User profile not found')
            );
        }

        res.status(200).json(
            formatSuccessResponse({
                profilePicture: profilePicUrl
            })
        );
    } catch (err) {
        console.error('Error uploading profile picture:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to upload profile picture')
        );
    }
});

/**
 * @route GET /api/users/search
 * @desc Search for users by email, name, username or medication
 * @access Private
 */
router.get('/search', verifyToken, async (req, res) => {
    const { email, name, username, medication } = req.query;
    
    if (!email && !name && !username && !medication) {
        return res.status(400).json(
            formatErrorResponse('At least one search parameter (email, name, username, or medication) is required')
        );
    }
    
    try {
        let users = [];
          // Search by email, name or username
        if (email || name || username) {
            const searchParams = [];
            const searchTerms = [];
            
            if (email) {
                searchParams.push('u.email LIKE ?');
                searchTerms.push(`%${email}%`);
            }
            
            if (name) {
                searchParams.push('up.name LIKE ?');
                searchTerms.push(`%${name}%`);
            }
            
            if (username) {
                searchParams.push('up.username LIKE ?');
                searchTerms.push(`%${username}%`);
            }
              users = await db.all(
                `SELECT u.user_id, u.email, up.name, up.profile_picture, up.username
                FROM users u
                JOIN user_profiles up ON u.user_id = up.user_id
                WHERE (${searchParams.join(' OR ')}) AND u.is_active = 1 AND u.user_id != ?
                LIMIT 10`,
                [...searchTerms, req.userId]
            );
        }
        
        // Search by medication name
        if (medication) {            const medicationUsers = await db.all(
                `SELECT DISTINCT u.user_id, u.email, up.name, up.profile_picture, up.username
                FROM users u
                JOIN user_profiles up ON u.user_id = up.user_id
                JOIN medications m ON m.user_id = u.user_id
                WHERE m.name LIKE ? AND u.is_active = 1 AND u.user_id != ?
                LIMIT 10`,
                [`%${medication}%`, req.userId]
            );
            
            // Merge results without duplicates
            if (users.length > 0) {
                // If we already have users from email/name search, merge without duplicates
                const userIds = new Set(users.map(u => u.user_id));
                medicationUsers.forEach(user => {
                    if (!userIds.has(user.user_id)) {
                        users.push(user);
                        userIds.add(user.user_id);
                    }
                });
            } else {
                users = medicationUsers;
            }
        }
          res.status(200).json(
            formatSuccessResponse(users.map(user => ({
                userId: user.user_id,
                email: user.email,
                name: user.name,
                username: user.username || '',
                profilePicture: user.profile_picture
            })))
        );
    } catch (err) {
        console.error('Error searching users:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to search users')
        );
    }
});

/**
 * @route GET /api/users/:userId
 * @desc Get public profile information for a specific user
 * @access Private
 */
router.get('/:userId', verifyToken, async (req, res) => {
    const { userId } = req.params;
    
    try {        const user = await db.get(
            `SELECT u.user_id, u.email, up.name, up.profile_picture
             FROM users u
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.user_id = ? AND u.is_active = 1`,
            [userId]
        );
        
        if (!user) {
            return res.status(404).json(
                formatErrorResponse('User not found')
            );
        }
          res.status(200).json(
            formatSuccessResponse({
                userId: user.user_id,
                email: user.email,
                name: user.name,
                profilePicture: user.profile_picture
            })
        );
    } catch (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch user information')
        );
    }
});

/**
 * @route GET /api/users/check-username/:username
 * @desc Check if a username is available
 * @access Private
 */
router.get('/check-username/:username', verifyToken, async (req, res) => {
    const username = req.params.username || req.query.username;
    
    if (!username || username.length < 3) {
        return res.status(400).json(
            formatErrorResponse('Username must be at least 3 characters long')
        );
    }
    
    try {
        // Check if username already exists
        const existingUser = await db.get(
            `SELECT user_id FROM user_profiles WHERE username = ? AND user_id != ?`,
            [username, req.userId]
        );
        
        if (existingUser) {
            return res.status(200).json(
                formatSuccessResponse({
                    available: false,
                    message: 'Username is already taken'
                })
            );
        }
        
        return res.status(200).json(
            formatSuccessResponse({
                available: true,
                message: 'Username is available'
            })
        );
    } catch (err) {
        console.error('Error checking username availability:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to check username availability')
        );
    }
});

/**
 * @route GET /api/users/check-username
 * @desc Check if a username is available (query parameter version)
 * @access Private
 */
router.get('/check-username', verifyToken, async (req, res) => {
    const username = req.query.username;
    
    if (!username || username.length < 3) {
        return res.status(400).json(
            formatErrorResponse('Username must be at least 3 characters long')
        );
    }
    
    try {
        // Check if username already exists
        const existingUser = await db.get(
            `SELECT user_id FROM user_profiles WHERE username = ? AND user_id != ?`,
            [username, req.userId]
        );
        
        if (existingUser) {
            return res.status(200).json(
                formatSuccessResponse({
                    available: false,
                    message: 'Username is already taken'
                })
            );
        }
        
        return res.status(200).json(
            formatSuccessResponse({
                available: true,
                message: 'Username is available'
            })
        );
    } catch (err) {
        console.error('Error checking username availability:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to check username availability')
        );
    }
});

/**
 * @route PUT /api/users/username
 * @desc Update user's username
 * @access Private
 */
router.put('/username', verifyToken, async (req, res) => {
    const { username } = req.body;
    
    if (!username || username.length < 3) {
        return res.status(400).json(
            formatErrorResponse('Username must be at least 3 characters long')
        );
    }
    
    try {
        // Check if username already exists
        const existingUser = await db.get(
            `SELECT user_id FROM user_profiles WHERE username = ? AND user_id != ?`,
            [username, req.userId]
        );
        
        if (existingUser) {
            return res.status(409).json(
                formatErrorResponse('Username is already taken')
            );
        }
        
        // Update username
        const result = await db.run(
            `UPDATE user_profiles SET username = ? WHERE user_id = ?`,
            [username, req.userId]
        );
        
        if (result.changes === 0) {
            return res.status(404).json(
                formatErrorResponse('User profile not found')
            );
        }
        
        res.status(200).json(
            formatSuccessResponse({
                username: username,
                message: 'Username updated successfully'
            })
        );
    } catch (err) {
        console.error('Error updating username:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to update username')
        );
    }
});

module.exports = router;
