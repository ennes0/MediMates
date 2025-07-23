/**
 * Contact Routes
 */
const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { db } = require('../config/database');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/contacts/friend-requests
 * @desc Get all friend requests for a user (both sent and received)
 * @access Private
 */
router.get('/friend-requests', verifyToken, async (req, res) => {
    try {
        // Get friend requests sent by the user
        const sentRequests = await db.all(
            `SELECT fr.request_id, fr.recipient_id, fr.status, fr.sent_at, fr.updated_at,
                    u.email, up.name, up.profile_picture, up.username
             FROM friend_requests fr
             JOIN users u ON fr.recipient_id = u.user_id
             JOIN user_profiles up ON fr.recipient_id = up.user_id
             WHERE fr.requester_id = ?
             ORDER BY fr.sent_at DESC`,
            [req.userId]
        );

        // Get friend requests received by the user
        const receivedRequests = await db.all(
            `SELECT fr.request_id, fr.requester_id, fr.status, fr.sent_at, fr.updated_at,
                    u.email, up.name, up.profile_picture, up.username
             FROM friend_requests fr
             JOIN users u ON fr.requester_id = u.user_id
             JOIN user_profiles up ON fr.requester_id = up.user_id
             WHERE fr.recipient_id = ?
             ORDER BY fr.sent_at DESC`,
            [req.userId]
        );

        res.status(200).json(
            formatSuccessResponse({
                sent: sentRequests.map(request => ({
                    id: request.request_id,
                    userId: request.recipient_id,
                    status: request.status,
                    name: request.name,
                    username: request.username,
                    email: request.email,
                    profilePicture: request.profile_picture,
                    sentAt: request.sent_at,
                    updatedAt: request.updated_at
                })),
                received: receivedRequests.map(request => ({
                    id: request.request_id,
                    userId: request.requester_id,
                    status: request.status,
                    name: request.name,
                    username: request.username,
                    email: request.email,
                    profilePicture: request.profile_picture,
                    sentAt: request.sent_at,
                    updatedAt: request.updated_at
                }))
            })
        );
    } catch (err) {
        console.error('Error fetching friend requests:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch friend requests')
        );
    }
});

/**
 * @route PUT /api/contacts/friend-requests/:id/accept
 * @desc Accept a friend request
 * @access Private
 */
router.put('/friend-requests/:id/accept', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    
    try {
        // Get the friend request and check if the current user is the recipient
        const friendRequest = await db.get(
            `SELECT fr.request_id, fr.requester_id, fr.recipient_id, fr.status,
                   up_requester.name as requester_name, up_recipient.name as recipient_name
             FROM friend_requests fr
             JOIN user_profiles up_requester ON fr.requester_id = up_requester.user_id
             JOIN user_profiles up_recipient ON fr.recipient_id = up_recipient.user_id
             WHERE fr.request_id = ? AND fr.recipient_id = ? AND fr.status = 'pending'`,
            [requestId, req.userId]
        );
        
        if (!friendRequest) {
            return res.status(404).json(
                formatErrorResponse('Friend request not found or you do not have permission to accept it')
            );
        }
        
        // Update the friend request status to 'accepted'
        await db.run(
            `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
            [requestId]
        );
        
        // Add the requester as a contact for the current user
        const result1 = await db.run(
            `INSERT INTO contacts (user_id, contact_user_id, contact_type, name)
             VALUES (?, ?, 'friend', ?)`,
            [req.userId, friendRequest.requester_id, friendRequest.requester_name]
        );
        
        // Add the current user as a contact for the requester
        const result2 = await db.run(
            `INSERT INTO contacts (user_id, contact_user_id, contact_type, name)
             VALUES (?, ?, 'friend', ?)`,
            [friendRequest.requester_id, req.userId, friendRequest.recipient_name]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Friend request accepted',
                contactId: result1.lastID,
                requestId: friendRequest.request_id,
                friendId: friendRequest.requester_id,
                friendName: friendRequest.requester_name
            })
        );
    } catch (err) {
        console.error('Error accepting friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to accept friend request')
        );
    }
});

/**
 * @route PUT /api/contacts/friend-requests/:id/reject
 * @desc Reject a friend request
 * @access Private
 */
router.put('/friend-requests/:id/reject', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    
    try {
        // Get the friend request and check if the current user is the recipient
        const friendRequest = await db.get(
            `SELECT request_id, requester_id, recipient_id, status
             FROM friend_requests
             WHERE request_id = ? AND recipient_id = ? AND status = 'pending'`,
            [requestId, req.userId]
        );
        
        if (!friendRequest) {
            return res.status(404).json(
                formatErrorResponse('Friend request not found or you do not have permission to reject it')
            );
        }
        
        // Update the friend request status to 'rejected'
        await db.run(
            `UPDATE friend_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
            [requestId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Friend request rejected',
                requestId: friendRequest.request_id
            })
        );
    } catch (err) {
        console.error('Error rejecting friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to reject friend request')
        );
    }
});

/**
 * @route DELETE /api/contacts/friend-requests/:id
 * @desc Cancel a friend request
 * @access Private
 */
router.delete('/friend-requests/:id', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    
    try {
        // Check if the friend request exists and the current user is the sender
        const friendRequest = await db.get(
            `SELECT request_id, requester_id 
             FROM friend_requests
             WHERE request_id = ? AND requester_id = ?`,
            [requestId, req.userId]
        );
        
        if (!friendRequest) {
            return res.status(404).json(
                formatErrorResponse('Friend request not found or you do not have permission to cancel it')
            );
        }
        
        // Delete the friend request
        await db.run(
            `DELETE FROM friend_requests WHERE request_id = ?`,
            [requestId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Friend request cancelled successfully'
            })
        );
    } catch (err) {
        console.error('Error cancelling friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to cancel friend request')
        );
    }
});

/**
 * @route GET /api/contacts
 * @desc Get all contacts for a user
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
    try {        const contacts = await db.all(
            `SELECT c.contact_id, c.contact_user_id, c.contact_type, c.created_at, c.updated_at,
                    u.email, up.name, up.profile_picture
             FROM contacts c
             JOIN users u ON c.contact_user_id = u.user_id
             JOIN user_profiles up ON c.contact_user_id = up.user_id
             WHERE c.user_id = ?
             ORDER BY up.name`,
            [req.userId]
        );
        
        res.status(200).json(
            formatSuccessResponse(
                contacts.map(contact => ({                    id: contact.contact_id,
                    userId: contact.contact_user_id,
                    type: contact.contact_type,
                    name: contact.name,
                    email: contact.email,
                    profilePicture: contact.profile_picture,
                    createdAt: contact.created_at,
                    updatedAt: contact.updated_at
                }))
            )
        );
    } catch (err) {
        console.error('Error fetching contacts:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch contacts')
        );
    }
});

/**
 * @route GET /api/contacts/:id
 * @desc Get a specific contact by ID
 * @access Private
 */
router.get('/:id', verifyToken, async (req, res) => {
    const contactId = req.params.id;
    
    try {
        const contact = await db.get(        `SELECT c.contact_id, c.contact_user_id, c.contact_type, c.name, 
                    c.can_view_medications, c.can_view_reminders, c.can_view_history,
                    c.created_at, c.updated_at,                    u.email, up.name as user_name, up.profile_picture
             FROM contacts c
             JOIN users u ON c.contact_user_id = u.user_id
             JOIN user_profiles up ON c.contact_user_id = up.user_id
             WHERE c.contact_id = ? AND c.user_id = ?`,
            [contactId, req.userId]
        );
        
        if (!contact) {
            return res.status(404).json(
                formatErrorResponse('Contact not found')
            );
        }
          res.status(200).json(
            formatSuccessResponse({
                id: contact.contact_id,
                userId: contact.contact_user_id,
                type: contact.contact_type,
                contactName: contact.name,
                name: contact.user_name,
                email: contact.email,
                profilePicture: contact.profile_picture,
                permissions: {
                    canViewMedications: contact.can_view_medications === 1,
                    canViewReminders: contact.can_view_reminders === 1,
                    canViewHistory: contact.can_view_history === 1
                },
                createdAt: contact.created_at,
                updatedAt: contact.updated_at
            })
        );
    } catch (err) {
        console.error('Error fetching contact:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch contact information')
        );
    }
});

/**
 * @route POST /api/contacts
 * @desc Send a friend request to another user
 * @access Private
 */
router.post('/', verifyToken, async (req, res) => {
    const { userId, type = 'friend' } = req.body;
    
    if (!userId) {
        return res.status(400).json(
            formatErrorResponse('User ID is required')
        );
    }
    
    // Can't send friend request to yourself
    if (parseInt(userId) === parseInt(req.userId)) {
        return res.status(400).json(
            formatErrorResponse('Cannot add yourself as a friend')
        );
    }
    
    try {
        // Check if user exists and get their profile
        const userProfile = await db.get(
            `SELECT u.user_id, u.email, up.name
             FROM users u
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.user_id = ? AND u.is_active = 1`,
            [userId]
        );
        
        if (!userProfile) {
            return res.status(404).json(
                formatErrorResponse('User not found or account is inactive')
            );
        }
        
        // Check if contact already exists
        const existingContact = await db.get(
            `SELECT contact_id FROM contacts WHERE user_id = ? AND contact_user_id = ?`,
            [req.userId, userId]
        );
        
        if (existingContact) {
            return res.status(409).json(
                formatErrorResponse('Contact already exists')
            );
        }
        
        // Check if there's already a friend request
        const existingRequest = await db.get(
            `SELECT request_id, status FROM friend_requests 
             WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)`,
            [req.userId, userId, userId, req.userId]
        );
        
        // If there's already a request from the recipient to the current user
        if (existingRequest && existingRequest.status === 'pending' && existingRequest.requester_id == userId) {
            // Auto-accept the request since both users want to be friends
            await db.run(
                `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
                [existingRequest.request_id]
            );
            
            // Add contacts for both users
            const requesterProfile = await db.get(
                `SELECT name FROM user_profiles WHERE user_id = ?`,
                [req.userId]
            );

            // Add contact for current user
            const result1 = await db.run(
                `INSERT INTO contacts (user_id, contact_user_id, contact_type, name)
                 VALUES (?, ?, ?, ?)`,
                [req.userId, userId, type, userProfile.name]
            );
            
            // Add contact for the other user
            const result2 = await db.run(
                `INSERT INTO contacts (user_id, contact_user_id, contact_type, name)
                 VALUES (?, ?, ?, ?)`,
                [userId, req.userId, type, requesterProfile.name]
            );
            
            // Get contact details
            const contact = await db.get(
                `SELECT c.contact_id, c.contact_user_id, c.contact_type, c.name,
                        c.created_at, c.updated_at,
                        u.email, up.name as user_name, up.profile_picture
                 FROM contacts c
                 JOIN users u ON c.contact_user_id = u.user_id
                 JOIN user_profiles up ON c.contact_user_id = up.user_id
                 WHERE c.contact_id = ?`,
                [result1.lastID]
            );
            
            res.status(201).json(
                formatSuccessResponse({
                    id: contact.contact_id,
                    userId: contact.contact_user_id,
                    type: contact.contact_type,
                    name: contact.user_name,
                    contactName: contact.name,
                    email: contact.email,
                    profilePicture: contact.profile_picture,
                    createdAt: contact.created_at,
                    updatedAt: contact.updated_at,
                    requestStatus: 'accepted',
                    message: 'Friend request automatically accepted'
                })
            );
            return;
        }
        
        // If there's already a pending friend request from the current user
        if (existingRequest && existingRequest.status === 'pending') {
            return res.status(200).json(
                formatSuccessResponse({
                    requestId: existingRequest.request_id,
                    status: existingRequest.status,
                    message: 'Friend request already sent and is pending'
                })
            );
        }
        
        // If the request was previously rejected, allow to send it again
        if (existingRequest && existingRequest.status === 'rejected') {
            await db.run(
                `UPDATE friend_requests SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
                [existingRequest.request_id]
            );
            
            res.status(200).json(
                formatSuccessResponse({
                    requestId: existingRequest.request_id,
                    status: 'pending',
                    message: 'Friend request sent'
                })
            );
            return;
        }
        
        // Create a new friend request
        const request = await db.run(
            `INSERT INTO friend_requests (requester_id, recipient_id)
             VALUES (?, ?)`,
            [req.userId, userId]
        );
        
        // Get the requester's name for the notification
        const requesterName = await db.get(
            `SELECT name FROM user_profiles WHERE user_id = ?`,
            [req.userId]
        );
        
        res.status(201).json(
            formatSuccessResponse({
                requestId: request.lastID,
                status: 'pending',
                recipientId: userId,
                recipientName: userProfile.name,
                message: 'Friend request sent successfully'
            })
        );
        
    } catch (err) {
        console.error('Error sending friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to send friend request')
        );
    }
});

/**
 * @route PUT /api/contacts/:id
 * @desc Update a contact
 * @access Private
 */
router.put('/:id', verifyToken, async (req, res) => {
    const contactId = req.params.id;
    const { type, contactName, canViewMedications, canViewReminders, canViewHistory } = req.body;
    
    try {
        // Check if contact exists and belongs to the user
        const existingContact = await db.get(
            `SELECT c.contact_id, c.contact_user_id 
             FROM contacts c
             WHERE c.contact_id = ? AND c.user_id = ?`,
            [contactId, req.userId]
        );
        
        if (!existingContact) {
            return res.status(404).json(
                formatErrorResponse('Contact not found or access denied')
            );
        }
        
        // If no name provided, we need to get the name from the user's profile
        let nameToUse = contactName;
        if (!nameToUse) {
            // Get the user's name from their profile
            const userProfile = await db.get(
                `SELECT name FROM user_profiles WHERE user_id = ?`,
                [existingContact.contact_user_id]
            );
            if (userProfile) {
                nameToUse = userProfile.name;
            }
        }
        
        // Update contact
        await db.run(
            `UPDATE contacts
             SET contact_type = COALESCE(?, contact_type),
                 name = ?,
                 can_view_medications = COALESCE(?, can_view_medications),
                 can_view_reminders = COALESCE(?, can_view_reminders),
                 can_view_history = COALESCE(?, can_view_history),
                 updated_at = CURRENT_TIMESTAMP
             WHERE contact_id = ?`,
            [
                type, 
                nameToUse, 
                canViewMedications === undefined ? null : (canViewMedications ? 1 : 0), 
                canViewReminders === undefined ? null : (canViewReminders ? 1 : 0), 
                canViewHistory === undefined ? null : (canViewHistory ? 1 : 0),
                contactId
            ]
        );
          // Get updated contact details
        const contact = await db.get(
            `SELECT c.contact_id, c.contact_user_id, c.contact_type, c.name,
                    c.can_view_medications, c.can_view_reminders, c.can_view_history,
                    c.created_at, c.updated_at,
                    u.email, up.name as user_name, up.profile_picture
             FROM contacts c
             JOIN users u ON c.contact_user_id = u.user_id
             JOIN user_profiles up ON c.contact_user_id = up.user_id
             WHERE c.contact_id = ?`,
            [contactId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                id: contact.contact_id,
                userId: contact.contact_user_id,
                type: contact.contact_type,
                contactName: contact.name,
                name: contact.user_name,
                email: contact.email,
                profilePicture: contact.profile_picture,
                permissions: {
                    canViewMedications: contact.can_view_medications === 1,
                    canViewReminders: contact.can_view_reminders === 1,
                    canViewHistory: contact.can_view_history === 1
                },
                createdAt: contact.created_at,
                updatedAt: contact.updated_at
            })
        );
    } catch (err) {
        console.error('Error updating contact:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to update contact')
        );
    }
});

/**
 * @route DELETE /api/contacts/:id
 * @desc Delete a contact
 * @access Private
 */
router.delete('/:id', verifyToken, async (req, res) => {
    const contactId = req.params.id;
    
    try {        // Check if contact exists and belongs to the user
        const existingContact = await db.get(
            `SELECT contact_id, contact_user_id, contact_type FROM contacts WHERE contact_id = ? AND user_id = ?`,
            [contactId, req.userId]
        );
        
        if (!existingContact) {
            return res.status(404).json(
                formatErrorResponse('Contact not found or access denied')
            );
        }
        
        // Get the other user's ID and check if they have this user as a contact (reciprocal relationship)
        const otherUserId = existingContact.contact_user_id;
          // Start a transaction to ensure both contacts are deleted or none
        await db.run('START TRANSACTION');
        
        try {
            // Delete the contact from this user's list
            await db.run(
                `DELETE FROM contacts WHERE contact_id = ?`,
                [contactId]
            );
            
            // Delete the reciprocal contact from the other user's list (if exists)
            if (existingContact.contact_type === 'friend') {
                await db.run(
                    `DELETE FROM contacts 
                     WHERE user_id = ? AND contact_user_id = ? AND contact_type = 'friend'`,
                    [otherUserId, req.userId]
                );
            }
            
            // Commit the transaction
            await db.run('COMMIT');
        } catch (err) {
            // Rollback in case of error
            await db.run('ROLLBACK');
            throw err;
        }
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Contact deleted successfully'
            })
        );
    } catch (err) {
        console.error('Error deleting contact:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to delete contact')
        );
    }
});

/**
 * @route GET /api/contacts/friend-requests
 * @desc Get all friend requests for a user (both sent and received)
 * @access Private
 */
router.get('/friend-requests', verifyToken, async (req, res) => {
    try {
        // Get friend requests sent by the user
        const sentRequests = await db.all(
            `SELECT fr.request_id, fr.recipient_id, fr.status, fr.sent_at, fr.updated_at,
                    u.email, up.name, up.profile_picture, up.username
             FROM friend_requests fr
             JOIN users u ON fr.recipient_id = u.user_id
             JOIN user_profiles up ON fr.recipient_id = up.user_id
             WHERE fr.requester_id = ?
             ORDER BY fr.sent_at DESC`,
            [req.userId]
        );

        // Get friend requests received by the user
        const receivedRequests = await db.all(
            `SELECT fr.request_id, fr.requester_id, fr.status, fr.sent_at, fr.updated_at,
                    u.email, up.name, up.profile_picture, up.username
             FROM friend_requests fr
             JOIN users u ON fr.requester_id = u.user_id
             JOIN user_profiles up ON fr.requester_id = up.user_id
             WHERE fr.recipient_id = ?
             ORDER BY fr.sent_at DESC`,
            [req.userId]
        );

        res.status(200).json(
            formatSuccessResponse({
                sent: sentRequests.map(request => ({
                    id: request.request_id,
                    userId: request.recipient_id,
                    status: request.status,
                    name: request.name,
                    username: request.username,
                    email: request.email,
                    profilePicture: request.profile_picture,
                    sentAt: request.sent_at,
                    updatedAt: request.updated_at
                })),
                received: receivedRequests.map(request => ({
                    id: request.request_id,
                    userId: request.requester_id,
                    status: request.status,
                    name: request.name,
                    username: request.username,
                    email: request.email,
                    profilePicture: request.profile_picture,
                    sentAt: request.sent_at,
                    updatedAt: request.updated_at
                }))
            })
        );
    } catch (err) {
        console.error('Error fetching friend requests:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch friend requests')
        );
    }
});

/**
 * @route PUT /api/contacts/friend-requests/:id/accept
 * @desc Accept a friend request
 * @access Private
 */
router.put('/friend-requests/:id/accept', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    
    try {
        // Get the friend request and check if the current user is the recipient
        const friendRequest = await db.get(
            `SELECT fr.request_id, fr.requester_id, fr.recipient_id, fr.status,
                   up_requester.name as requester_name, up_recipient.name as recipient_name
             FROM friend_requests fr
             JOIN user_profiles up_requester ON fr.requester_id = up_requester.user_id
             JOIN user_profiles up_recipient ON fr.recipient_id = up_recipient.user_id
             WHERE fr.request_id = ? AND fr.recipient_id = ? AND fr.status = 'pending'`,
            [requestId, req.userId]
        );
        
        if (!friendRequest) {
            return res.status(404).json(
                formatErrorResponse('Friend request not found or you do not have permission to accept it')
            );
        }
        
        // Update the friend request status to 'accepted'
        await db.run(
            `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
            [requestId]
        );
        
        // Add the requester as a contact for the current user
        const result1 = await db.run(
            `INSERT INTO contacts (user_id, contact_user_id, contact_type, name)
             VALUES (?, ?, 'friend', ?)`,
            [req.userId, friendRequest.requester_id, friendRequest.requester_name]
        );
        
        // Add the current user as a contact for the requester
        const result2 = await db.run(
            `INSERT INTO contacts (user_id, contact_user_id, contact_type, name)
             VALUES (?, ?, 'friend', ?)`,
            [friendRequest.requester_id, req.userId, friendRequest.recipient_name]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Friend request accepted',
                contactId: result1.lastID,
                requestId: friendRequest.request_id,
                friendId: friendRequest.requester_id,
                friendName: friendRequest.requester_name
            })
        );
    } catch (err) {
        console.error('Error accepting friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to accept friend request')
        );
    }
});

/**
 * @route PUT /api/contacts/friend-requests/:id/reject
 * @desc Reject a friend request
 * @access Private
 */
router.put('/friend-requests/:id/reject', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    
    try {
        // Get the friend request and check if the current user is the recipient
        const friendRequest = await db.get(
            `SELECT request_id, requester_id, recipient_id, status
             FROM friend_requests
             WHERE request_id = ? AND recipient_id = ? AND status = 'pending'`,
            [requestId, req.userId]
        );
        
        if (!friendRequest) {
            return res.status(404).json(
                formatErrorResponse('Friend request not found or you do not have permission to reject it')
            );
        }
        
        // Update the friend request status to 'rejected'
        await db.run(
            `UPDATE friend_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
            [requestId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Friend request rejected',
                requestId: friendRequest.request_id
            })
        );
    } catch (err) {
        console.error('Error rejecting friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to reject friend request')
        );
    }
});

/**
 * @route DELETE /api/contacts/friend-requests/:id
 * @desc Cancel a friend request
 * @access Private
 */
router.delete('/friend-requests/:id', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    
    try {
        // Check if the friend request exists and the current user is the sender
        const friendRequest = await db.get(
            `SELECT request_id, requester_id 
             FROM friend_requests
             WHERE request_id = ? AND requester_id = ?`,
            [requestId, req.userId]
        );
        
        if (!friendRequest) {
            return res.status(404).json(
                formatErrorResponse('Friend request not found or you do not have permission to cancel it')
            );
        }
        
        // Delete the friend request
        await db.run(
            `DELETE FROM friend_requests WHERE request_id = ?`,
            [requestId]
        );
        
        res.status(200).json(
            formatSuccessResponse({
                message: 'Friend request cancelled successfully'
            })
        );
    } catch (err) {
        console.error('Error cancelling friend request:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to cancel friend request')
        );
    }
});

module.exports = router;
