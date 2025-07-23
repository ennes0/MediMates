/**
 * Chat Routes
 */
const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { db } = require('../config/database');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/chats
 * @desc Get all conversations for a user
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        // Get all conversations where the current user is a participant
        const conversations = await db.all(
            `SELECT cc.conversation_id, cc.title, cc.is_group_chat, cc.created_at, cc.updated_at,
                    cp.is_admin, cp.muted_until
             FROM chat_conversations cc
             JOIN chat_participants cp ON cc.conversation_id = cp.conversation_id
             WHERE cp.user_id = ? AND cp.left_at IS NULL
             ORDER BY cc.updated_at DESC`,
            [req.userId]
        );

        const result = [];

        // For each conversation, get participants and last message
        for (const conv of conversations) {
            // Get participants for each conversation
            const participants = await db.all(
                `SELECT cp.user_id, cp.is_admin, u.email, up.name, up.profile_picture, up.username
                 FROM chat_participants cp
                 JOIN users u ON cp.user_id = u.user_id
                 JOIN user_profiles up ON u.user_id = up.user_id
                 WHERE cp.conversation_id = ? AND cp.left_at IS NULL
                 ORDER BY cp.joined_at`,
                [conv.conversation_id]
            );

            // Get the last message for each conversation
            const lastMessage = await db.get(
                `SELECT cm.message_id, cm.sender_id, cm.content, cm.sent_at, cm.message_type,
                        u.email, up.name as sender_name, up.profile_picture as sender_avatar
                 FROM chat_messages cm
                 JOIN users u ON cm.sender_id = u.user_id
                 JOIN user_profiles up ON u.user_id = up.user_id
                 WHERE cm.conversation_id = ?
                 ORDER BY cm.sent_at DESC
                 LIMIT 1`,
                [conv.conversation_id]
            );

            // Get unread messages count for this conversation
            const unreadCount = await db.get(
                `SELECT COUNT(*) as count
                 FROM chat_messages cm
                 LEFT JOIN message_read_status mrs ON cm.message_id = mrs.message_id AND mrs.user_id = ?
                 WHERE cm.conversation_id = ? AND cm.sender_id != ? AND mrs.read_at IS NULL`,
                [req.userId, conv.conversation_id, req.userId]
            );

            // Format conversation data to match frontend expected structure
            let title = conv.title;
            let avatar = '';
            
            // For 1-on-1 conversations, set the title and avatar to the other participant
            if (!conv.is_group_chat && participants.length === 2) {
                const otherParticipant = participants.find(p => p.user_id !== req.userId);
                if (otherParticipant) {
                    title = otherParticipant.name;
                    avatar = otherParticipant.profile_picture;
                }
            }
            // For group chats, use the first 3 participants' avatars or set a default
            else if (conv.is_group_chat) {
                // You can implement a group avatar logic here
                // For now, just use the first participant other than the current user
                const otherParticipant = participants.find(p => p.user_id !== req.userId);
                if (otherParticipant) {
                    avatar = otherParticipant.profile_picture;
                }
            }

            result.push({
                id: conv.conversation_id.toString(),
                name: title,
                avatar: avatar,
                isGroup: conv.is_group_chat === 1,
                lastMessage: lastMessage ? lastMessage.content : '',
                time: lastMessage ? formatChatTime(new Date(lastMessage.sent_at)) : formatChatTime(new Date(conv.created_at)),
                messageType: lastMessage ? lastMessage.message_type : 'text',
                unreadCount: unreadCount ? unreadCount.count : 0,
                participants: participants.map(p => ({
                    userId: p.user_id,
                    name: p.name,
                    email: p.email,
                    profilePicture: p.profile_picture,
                    username: p.username,
                    isAdmin: p.is_admin === 1,
                })),
                isOnline: false, // You would need a separate mechanism to track online status
                isTyping: false // You would need WebSockets to implement this feature
            });
        }

        res.status(200).json(formatSuccessResponse(result));
    } catch (err) {
        console.error('Error fetching conversations:', err);
        return res.status(500).json(formatErrorResponse('Failed to fetch conversations'));
    }
});

/**
 * @route GET /api/chats/:conversationId/messages
 * @desc Get messages for a specific conversation
 * @access Private
 */
router.get('/:conversationId/messages', verifyToken, async (req, res) => {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        // Check if the user is a participant in this conversation
        const isParticipant = await db.get(
            `SELECT participant_id FROM chat_participants
             WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`,
            [conversationId, req.userId]
        );

        if (!isParticipant) {
            return res.status(403).json(formatErrorResponse('You are not a participant in this conversation'));
        }

        // Get messages for this conversation with pagination
        const messages = await db.all(
            `SELECT cm.message_id, cm.sender_id, cm.content, cm.sent_at, cm.is_edited, 
                    cm.edited_at, cm.has_attachments, cm.message_type, cm.reference_id,
                    u.email, up.name as sender_name, up.profile_picture as sender_avatar
             FROM chat_messages cm
             JOIN users u ON cm.sender_id = u.user_id
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE cm.conversation_id = ?
             ORDER BY cm.sent_at DESC
             LIMIT ? OFFSET ?`,
            [conversationId, parseInt(limit), parseInt(offset)]
        );

        // Mark messages as read
        await db.run(
            `INSERT INTO message_read_status (message_id, user_id)
             SELECT cm.message_id, ? FROM chat_messages cm
             LEFT JOIN message_read_status mrs ON cm.message_id = mrs.message_id AND mrs.user_id = ?
             WHERE cm.conversation_id = ? AND cm.sender_id != ? AND mrs.id IS NULL`,
            [req.userId, req.userId, conversationId, req.userId]
        );

        // Format messages to match frontend expected structure
        const formattedMessages = messages.map(message => ({
            id: message.message_id.toString(),
            text: message.content,
            sender: message.sender_id === req.userId ? 'me' : 'other',
            senderInfo: {
                id: message.sender_id,
                name: message.sender_name,
                avatar: message.sender_avatar
            },
            time: formatMessageTime(new Date(message.sent_at)),
            isEdited: message.is_edited === 1,
            messageType: message.message_type,
            hasAttachments: message.has_attachments === 1,
            referenceId: message.reference_id
        }));

        res.status(200).json(formatSuccessResponse(formattedMessages.reverse())); // Reverse to get oldest first
    } catch (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json(formatErrorResponse('Failed to fetch messages'));
    }
});

/**
 * @route POST /api/chats
 * @desc Create a new conversation
 * @access Private
 */
router.post('/', verifyToken, async (req, res) => {
    const { title, participants, isGroup = false } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json(formatErrorResponse('Participants are required'));
    }

    try {
        // Start a transaction
        await db.run('BEGIN TRANSACTION');

        // Check if all participants exist
        for (const participantId of participants) {
            const user = await db.get('SELECT user_id FROM users WHERE user_id = ?', [participantId]);
            if (!user) {
                await db.run('ROLLBACK');
                return res.status(404).json(formatErrorResponse(`User with ID ${participantId} not found`));
            }
        }

        // For direct (1-on-1) chats, check if conversation already exists
        if (!isGroup && participants.length === 1) {
            const existingConversation = await db.get(
                `SELECT cc.conversation_id
                 FROM chat_conversations cc
                 JOIN chat_participants cp1 ON cc.conversation_id = cp1.conversation_id
                 JOIN chat_participants cp2 ON cc.conversation_id = cp2.conversation_id
                 WHERE cc.is_group_chat = 0
                 AND cp1.user_id = ? AND cp2.user_id = ?
                 AND cp1.left_at IS NULL AND cp2.left_at IS NULL`,
                [req.userId, participants[0]]
            );

            if (existingConversation) {
                // Return the existing conversation
                await db.run('ROLLBACK');
                return res.status(200).json(formatSuccessResponse({
                    conversationId: existingConversation.conversation_id,
                    message: 'Conversation already exists'
                }));
            }
        }

        // Create a new conversation
        const result = await db.run(
            `INSERT INTO chat_conversations (title, created_by, is_group_chat)
             VALUES (?, ?, ?)`,
            [title || null, req.userId, isGroup ? 1 : 0]
        );
        
        const conversationId = result.lastID;

        // Add the current user as a participant and admin
        await db.run(
            `INSERT INTO chat_participants (conversation_id, user_id, is_admin)
             VALUES (?, ?, ?)`,
            [conversationId, req.userId, 1]
        );

        // Add other participants
        for (const participantId of participants) {
            await db.run(
                `INSERT INTO chat_participants (conversation_id, user_id)
                 VALUES (?, ?)`,
                [conversationId, participantId]
            );
        }

        await db.run('COMMIT');

        res.status(201).json(formatSuccessResponse({
            conversationId,
            message: 'Conversation created successfully'
        }));
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Error creating conversation:', err);
        return res.status(500).json(formatErrorResponse('Failed to create conversation'));
    }
});

/**
 * @route POST /api/chats/:conversationId/messages
 * @desc Send a message to a conversation
 * @access Private
 */
router.post('/:conversationId/messages', verifyToken, async (req, res) => {
    const { conversationId } = req.params;
    const { content, messageType = 'text', referenceId = null } = req.body;

    if (!content) {
        return res.status(400).json(formatErrorResponse('Message content is required'));
    }

    try {
        // Check if the user is a participant in this conversation
        const isParticipant = await db.get(
            `SELECT participant_id FROM chat_participants
             WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`,
            [conversationId, req.userId]
        );

        if (!isParticipant) {
            return res.status(403).json(formatErrorResponse('You are not a participant in this conversation'));
        }

        // Send the message
        const result = await db.run(
            `INSERT INTO chat_messages (conversation_id, sender_id, content, message_type, reference_id)
             VALUES (?, ?, ?, ?, ?)`,
            [conversationId, req.userId, content, messageType, referenceId]
        );

        // Update conversation's updated_at timestamp
        await db.run(
            `UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP
             WHERE conversation_id = ?`,
            [conversationId]
        );

        // Get the sender info
        const sender = await db.get(
            `SELECT u.user_id, u.email, up.name, up.profile_picture
             FROM users u
             JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.user_id = ?`,
            [req.userId]
        );

        // Format the response
        const messageId = result.lastID;
        const sentAt = new Date();

        res.status(201).json(formatSuccessResponse({
            id: messageId.toString(),
            text: content,
            sender: 'me',
            senderInfo: {
                id: req.userId,
                name: sender.name,
                avatar: sender.profile_picture
            },
            time: formatMessageTime(sentAt),
            isEdited: false,
            messageType,
            hasAttachments: false,
            referenceId
        }));
    } catch (err) {
        console.error('Error sending message:', err);
        return res.status(500).json(formatErrorResponse('Failed to send message'));
    }
});

// Utility function to format chat time for display in the chat list
function formatChatTime(dateObj) {
    const now = new Date();
    const diffMs = now - dateObj;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Same day: show time
    if (diffDays === 0) {
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Yesterday
    else if (diffDays === 1) {
        return 'Yesterday';
    }
    // Within a week
    else if (diffDays < 7) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[dateObj.getDay()];
    }
    // More than a week
    else {
        return dateObj.toLocaleDateString();
    }
}

// Utility function to format message time
function formatMessageTime(dateObj) {
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

module.exports = router;
