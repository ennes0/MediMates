/**
 * Chat Routes
 */
const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { db } = require('../config/database');
const { upload } = require('../middleware/upload.middleware');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/chats
 * @desc Get all chat conversations for a user
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const conversations = await db.all(
            `SELECT cc.conversation_id, cc.title, cc.is_group_chat, cc.created_at, cc.updated_at,
                    cc.created_by
             FROM chat_conversations cc
             JOIN chat_participants cp ON cc.conversation_id = cp.conversation_id
             WHERE cp.user_id = ? AND cp.left_at IS NULL
             ORDER BY cc.updated_at DESC`,
            [req.userId]
        );

        // For each conversation, get the last message and unread count
        const enhancedConversations = [];
        
        for (const conv of conversations) {            // Get last message
            const lastMessage = await db.get(
                `SELECT cm.message_id, cm.content, cm.sent_at, cm.has_attachments,
                        u.user_id as sender_id, up.name as sender_name
                 FROM chat_messages cm
                 JOIN users u ON cm.sender_id = u.user_id
                 JOIN user_profiles up ON u.user_id = up.user_id
                 WHERE cm.conversation_id = ?
                 ORDER BY cm.sent_at DESC
                 LIMIT 1`,
                [conv.conversation_id]
            );            // Get unread count
            const unreadCount = await db.get(
                `SELECT COUNT(*) as count
                 FROM chat_messages cm
                 LEFT JOIN message_read_status mrs ON cm.message_id = mrs.message_id AND mrs.user_id = ?
                 WHERE cm.conversation_id = ?
                 AND cm.sender_id != ?
                 AND mrs.message_id IS NULL`,
                [req.userId, conv.conversation_id, req.userId]
            );
            
            // Get participants info for contact name if not a group chat
            let participantInfo = null;
            if (!conv.is_group_chat) {                participantInfo = await db.get(
                    `SELECT u.user_id, up.name, up.profile_picture
                     FROM chat_participants cp
                     JOIN users u ON cp.user_id = u.user_id
                     JOIN user_profiles up ON u.user_id = up.user_id
                     WHERE cp.conversation_id = ? AND cp.user_id != ?
                     LIMIT 1`,
                    [conv.conversation_id, req.userId]
                );
            }
            
            enhancedConversations.push({
                id: conv.conversation_id,
                name: conv.is_group_chat ? conv.title : (participantInfo ? participantInfo.name : 'Unknown'),
                isGroupChat: conv.is_group_chat === 1,
                profilePicture: (!conv.is_group_chat && participantInfo) ? participantInfo.profile_picture : null,
                participantId: (!conv.is_group_chat && participantInfo) ? participantInfo.user_id : null,                lastMessage: lastMessage ? {
                    text: lastMessage.content,
                    sentAt: lastMessage.sent_at,
                    hasAttachments: lastMessage.has_attachments === 1,
                    sender: {
                        id: lastMessage.sender_id,
                        name: lastMessage.sender_name
                    }
                } : null,
                unreadCount: unreadCount ? unreadCount.count : 0,
                createdAt: conv.created_at,
                updatedAt: conv.updated_at
            });
        }
        
        res.status(200).json(
            formatSuccessResponse(enhancedConversations)
        );
    } catch (err) {
        console.error('Error fetching conversations:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch conversations')
        );
    }
});

/**
 * @route GET /api/chats/:id/messages
 * @desc Get messages for a specific conversation
 * @access Private
 */
router.get('/:id/messages', verifyToken, async (req, res) => {
    const conversationId = req.params.id;
    const { page = 1, limit = 20 } = req.query;
    // Adjust for 1-based page indexing (frontend sends page=1 for first page)
    const offset = (page - 1) * limit;
    
    console.log(`Fetching messages for conversation ${conversationId}, page ${page}, limit ${limit}, offset ${offset}`);
    
    try {
        // Verify user is a participant in this conversation
        const isParticipant = await db.get(
            `SELECT 1 FROM chat_participants
             WHERE conversation_id = ? AND user_id = ?`,
            [conversationId, req.userId]
        );
        
        if (!isParticipant) {
            return res.status(403).json(
                formatErrorResponse('Not authorized to access this conversation')
            );
        }        // Log conversation ID for debugging
        console.log(`Retrieving messages for conversation ID: ${conversationId}`);

        // Check if messages exist for this conversation
        const messageCount = await db.get(
            `SELECT COUNT(*) as count FROM chat_messages 
             WHERE conversation_id = ?`,
            [conversationId]
        );

        console.log(`Found ${messageCount.count} messages for conversation ID ${conversationId}`);

        const messages = await db.all(
            `SELECT cm.message_id, cm.content, cm.sent_at, cm.edited_at,
                    cm.is_edited, cm.has_attachments,
                    u.user_id as sender_id, up.name as sender_name, up.profile_picture
             FROM chat_messages cm
             JOIN users u ON cm.sender_id = u.user_id
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE cm.conversation_id = ?
             ORDER BY cm.sent_at ASC
             LIMIT ? OFFSET ?`,
            [conversationId, parseInt(limit), parseInt(offset)]
        );
        
        console.log(`Retrieved ${messages.length} messages from database`);
        if (messages.length > 0) {
            console.log(`First message: ${messages[0].content}, Last message: ${messages[messages.length-1].content}`);
        }
          // Get attachments for messages with attachments
        const messagesWithAttachments = [];
        for (const message of messages) {
            const messageObj = {
                id: message.message_id,
                text: message.content,
                content: message.content, // Ensure both fields are present
                sentAt: message.sent_at,
                sent_at: message.sent_at, // Ensure both formats are available
                editedAt: message.edited_at,
                isEdited: message.is_edited === 1,
                sender: {
                    id: message.sender_id,
                    name: message.sender_name,
                    profilePicture: message.profile_picture
                },
                sender_id: message.sender_id, // Add direct fields for compatibility
                sender_name: message.sender_name,
                attachments: []
            };
            
            if (message.has_attachments) {
                const attachments = await db.all(
                    `SELECT attachment_id, file_type, file_url, file_name, file_size, thumbnail_url
                     FROM chat_attachments
                     WHERE message_id = ?`,
                    [message.message_id]
                );
                
                messageObj.attachments = attachments.map(att => ({
                    id: att.attachment_id,
                    type: att.file_type,
                    url: att.file_url,
                    name: att.file_name,
                    size: att.file_size,
                    thumbnailUrl: att.thumbnail_url
                }));
            }
            
            messagesWithAttachments.push(messageObj);
        }
          // Mark messages as read by this user
        for (const message of messages) {
            if (message.sender_id !== req.userId) {
                try {
                    // Using MySQL syntax for insert-if-not-exists
                    await db.run(
                        `INSERT INTO message_read_status (message_id, user_id)
                         SELECT ?, ?
                         FROM DUAL
                         WHERE NOT EXISTS (
                             SELECT 1 FROM message_read_status 
                             WHERE message_id = ? AND user_id = ?
                         )`,
                        [message.message_id, req.userId, message.message_id, req.userId]
                    );
                    console.log(`Marked message ${message.message_id} as read by user ${req.userId}`);
                } catch (err) {
                    console.error(`Error marking message ${message.message_id} as read:`, err);
                    // Continue with other messages even if one fails
                }
            }
        }
        
        res.status(200).json(
            formatSuccessResponse(messagesWithAttachments)
        );
    } catch (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to fetch messages')
        );
    }
});

/**
 * @route POST /api/chats/create
 * @desc Create a new conversation
 * @access Private
 */
router.post('/create', verifyToken, async (req, res) => {
    const { participantIds, name, isGroup = false } = req.body;
    
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json(
            formatErrorResponse('At least one participant ID is required')
        );
    }
    
    // For group chats, name is required
    if (isGroup && !name) {
        return res.status(400).json(
            formatErrorResponse('Group conversation name is required')
        );
    }
    
    try {
        // For direct messages, check if conversation already exists
        if (!isGroup && participantIds.length === 1) {
            const existingConversation = await db.get(
                `SELECT cc.conversation_id
                 FROM chat_conversations cc
                 JOIN chat_participants cp1 ON cc.conversation_id = cp1.conversation_id
                 JOIN chat_participants cp2 ON cc.conversation_id = cp2.conversation_id
                 WHERE cc.is_group_chat = 0
                 AND cp1.user_id = ?
                 AND cp2.user_id = ?
                 AND cp1.left_at IS NULL
                 AND cp2.left_at IS NULL
                 LIMIT 1`,
                [req.userId, participantIds[0]]
            );
            
            if (existingConversation) {
                return res.status(409).json(
                    formatErrorResponse('Conversation already exists', {
                        conversationId: existingConversation.conversation_id
                    })
                );
            }
        }
        
        // Create the conversation
        const conversationResult = await db.run(
            `INSERT INTO chat_conversations (title, is_group_chat, created_by)
             VALUES (?, ?, ?)`,
            [isGroup ? name : null, isGroup ? 1 : 0, req.userId]
        );
        
        const conversationId = conversationResult.lastID;
          // Add the current user as a participant
        try {
            // Convert user ID to integer to avoid "Out of range" errors
            const userIdInt = parseInt(req.userId, 10);
            if (isNaN(userIdInt)) {
                throw new Error(`Invalid user ID: ${req.userId}`);
            }
            
            await db.run(
                `INSERT INTO chat_participants (conversation_id, user_id, is_admin)
                 VALUES (?, ?, ?)`,
                [conversationId, userIdInt, 1] // Creator is admin
            );
        } catch (error) {
            console.error('Error adding current user as participant:', error);
            throw error;
        }
        
        // Add other participants
        for (const participantId of participantIds) {
            try {
                // Convert participant ID to integer to avoid "Out of range" errors
                const participantIdInt = parseInt(participantId, 10);
                if (isNaN(participantIdInt)) {
                    console.error(`Invalid participant ID: ${participantId}, skipping`);
                    continue;
                }
                
                await db.run(
                    `INSERT INTO chat_participants (conversation_id, user_id, is_admin)
                     VALUES (?, ?, ?)`,
                    [conversationId, participantIdInt, isGroup ? 0 : 1] // In direct messages, both are admins
                );
            } catch (error) {
                console.error(`Error adding participant ${participantId}:`, error);
                // Continue with other participants instead of failing completely
            }
        }
        
        // Get conversation details
        const conversation = await db.get(
            `SELECT cc.conversation_id, cc.title, cc.is_group_chat, cc.created_at
             FROM chat_conversations cc
             WHERE cc.conversation_id = ?`,
            [conversationId]
        );        // Get participants info - use proper fields from user_profiles
        const participants = await db.all(
            `SELECT u.user_id, up.name, up.profile_picture, cp.is_admin
             FROM chat_participants cp
             JOIN users u ON cp.user_id = u.user_id
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE cp.conversation_id = ?`,
            [conversationId]
        );
        
        res.status(201).json(
            formatSuccessResponse({
                id: conversation.conversation_id,
                name: conversation.title,
                isGroupChat: conversation.is_group_chat === 1,
                createdAt: conversation.created_at,
                participants: participants.map(p => ({
                    id: p.user_id,
                    name: p.name,
                    profilePicture: p.profile_picture,
                    isAdmin: p.is_admin === 1
                }))
            })
        );
    } catch (err) {
        console.error('Error creating conversation:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to create conversation')
        );
    }
});

/**
 * @route POST /api/chats/:id/messages
 * @desc Send a message in a conversation
 * @access Private
 */
router.post('/:id/messages', verifyToken, async (req, res) => {
    let conversationId = req.params.id;
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json(
            formatErrorResponse('Message text is required')
        );
    }
    
    // Check if this is a temporary conversation ID (starts with 'new_')
    const isTemporaryChat = conversationId.toString().startsWith('new_');
    if (isTemporaryChat) {
        console.log('Handling temporary chat ID, extracting friend ID...');
        // Extract the friend ID from the temporary ID
        // Format is expected to be 'new_[friendId]'
        const parts = conversationId.split('_');
        if (parts.length < 2) {
            return res.status(400).json(
                formatErrorResponse('Invalid temporary conversation ID')
            );
        }
        
        const friendId = parts[1];
        if (!friendId) {
            return res.status(400).json(
                formatErrorResponse('Friend ID not found in temporary conversation ID')
            );
        }
          // Convert IDs to integers
        const userIdInt = parseInt(req.userId, 10);
        const friendIdInt = parseInt(friendId, 10);
        
        if (isNaN(userIdInt) || isNaN(friendIdInt)) {
            return res.status(400).json(
                formatErrorResponse(`Invalid user ID or friend ID: ${req.userId}, ${friendId}`)
            );
        }
        
        // Check if a conversation already exists with this friend
        const existingConversation = await db.get(
            `SELECT cc.conversation_id
             FROM chat_conversations cc
             JOIN chat_participants cp1 ON cc.conversation_id = cp1.conversation_id
             JOIN chat_participants cp2 ON cc.conversation_id = cp2.conversation_id
             WHERE cc.is_group_chat = 0
             AND cp1.user_id = ?
             AND cp2.user_id = ?
             AND cp1.left_at IS NULL
             AND cp2.left_at IS NULL
             LIMIT 1`,
            [userIdInt, friendIdInt]
        );
        
        if (existingConversation) {
            // Use existing conversation
            conversationId = existingConversation.conversation_id;
        } else {
            // Create a new conversation
            const conversationResult = await db.run(
                `INSERT INTO chat_conversations (title, is_group_chat, created_by)
                 VALUES (NULL, 0, ?)`,
                [req.userId]
            );
            
            conversationId = conversationResult.lastID;
              // Add current user as participant
            try {
                await db.run(
                    `INSERT INTO chat_participants (conversation_id, user_id, is_admin)
                     VALUES (?, ?, 1)`,
                    [conversationId, userIdInt] // Using previously converted userIdInt
                );
            } catch (error) {
                console.error('Error adding current user as participant:', error);
                return res.status(500).json(
                    formatErrorResponse(`Failed to add current user to conversation: ${error.message}`)
                );
            }
            
            // Add friend as participant
            try {
                await db.run(
                    `INSERT INTO chat_participants (conversation_id, user_id, is_admin)
                     VALUES (?, ?, 1)`,
                    [conversationId, friendIdInt] // Using previously converted friendIdInt
                );
            } catch (error) {
                console.error('Error adding friend as participant:', error);                return res.status(500).json(
                    formatErrorResponse(`Failed to add friend to conversation: ${error.message}`)
                );
            }
        }
        
        console.log(`Mapped temporary chat ID to real conversation ID: ${conversationId}`);
    }
    
    try {        // Verify user is a participant - ensure ID is an integer
        const userIdForCheck = parseInt(req.userId, 10);
        const convoIdForCheck = parseInt(conversationId, 10);
        
        if (isNaN(userIdForCheck) || isNaN(convoIdForCheck)) {
            return res.status(400).json(
                formatErrorResponse(`Invalid user ID or conversation ID: ${req.userId}, ${conversationId}`)
            );
        }
        
        const isParticipant = await db.get(
            `SELECT 1 FROM chat_participants
             WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`,
            [convoIdForCheck, userIdForCheck]
        );
        
        if (!isParticipant) {
            return res.status(403).json(
                formatErrorResponse('Not authorized to send messages in this conversation')
            );
        }
          // Send message
        const messageResult = await db.run(
            `INSERT INTO chat_messages (conversation_id, sender_id, content)
             VALUES (?, ?, ?)`,
            [conversationId, req.userId, text]
        );
        
        const messageId = messageResult.lastID;
        
        // Update conversation last activity
        await db.run(
            `UPDATE chat_conversations
             SET updated_at = CURRENT_TIMESTAMP
             WHERE conversation_id = ?`,
            [conversationId]        );
          
        // Get message with sender info
        const message = await db.get(
            `SELECT cm.message_id, cm.content, cm.sent_at,
                    u.user_id as sender_id, up.name as sender_name, up.profile_picture
             FROM chat_messages cm
             JOIN users u ON cm.sender_id = u.user_id
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE cm.message_id = ?`,
            [messageId]
        );
          res.status(201).json(
            formatSuccessResponse({
                id: message.message_id,
                text: message.content,
                content: message.content, // Add both formats
                sentAt: message.sent_at,
                sent_at: message.sent_at, // Add both formats
                sender: {
                    id: message.sender_id,
                    name: message.sender_name,
                    profilePicture: message.profile_picture
                },
                sender_id: message.sender_id, // Add direct fields for compatibility
                sender_name: message.sender_name
            })
        );
    } catch (err) {
        console.error('Error sending message:', err);
        return res.status(500).json(
            formatErrorResponse('Failed to send message')
        );
    }
});

module.exports = router;
