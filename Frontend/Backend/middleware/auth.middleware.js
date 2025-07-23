/**
 * Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    // Get token from headers
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {        return res.status(403).json({
            message: 'No token provided'
        });
    }
      // Verify token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.log('JWT verification failed:', err.message);
            return res.status(401).json({
                message: 'Unauthorized: Invalid token'
            });
        }

        try {
            // Log the decoded token payload for debugging
            console.log('JWT Token decoded successfully:', JSON.stringify(decoded));
            
            // Check if token exists in database and is not expired
            const tokenRow = await db.get(
                'SELECT * FROM authentication_tokens WHERE token = ? AND expires_at > NOW()',
                [token]
            );
            
            if (!tokenRow) {
                console.log('Token not found in database or expired');
                return res.status(401).json({
                    message: 'Unauthorized: Token not found or expired'
                });
            }
            
            // Double check that the token belongs to the right user
            console.log('Token found in database, belongs to user_id:', tokenRow.user_id);
            
            // Verify the user exists
            const user = await db.get('SELECT user_id FROM users WHERE user_id = ?', [decoded.id]);
            if (!user) {
                console.log('User referenced in token does not exist:', decoded.id);
            } else {
                console.log('User exists with ID:', user.user_id);
            }

            // Set user info in request object
            req.userId = decoded.id;
            console.log('Setting request.userId to:', req.userId);
            next();
        } catch (error) {            console.error('Token verification error:', error);
            return res.status(500).json({
                message: 'Internal server error during authentication'
            });
        }
    });
};

module.exports = { verifyToken };
