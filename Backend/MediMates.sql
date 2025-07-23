-- MediMates Database Schema
-- A comprehensive SQL database for medication management application

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS medication_history;
DROP TABLE IF EXISTS reminder_medications;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS medication_times;
DROP TABLE IF EXISTS medication_schedules;
DROP TABLE IF EXISTS medication_inventory;
DROP TABLE IF EXISTS medication_sessions;
DROP TABLE IF EXISTS medications;
DROP TABLE IF EXISTS medication_shares;
DROP TABLE IF EXISTS message_read_status;
DROP TABLE IF EXISTS chat_attachments;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS authentication_tokens;
DROP TABLE IF EXISTS users;

-- ==========================================
-- Users and Authentication Tables
-- ==========================================

-- Users table - Core user information
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL
);

-- Authentication tokens table - For session management and API access
CREATE TABLE authentication_tokens (
    token_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(50) NOT NULL, -- 'access', 'refresh', etc.
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User profiles - Extended user information
CREATE TABLE user_profiles (
    profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    profile_picture_url TEXT NULL,
    phone_number VARCHAR(50) NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    emergency_contact_name VARCHAR(100) NULL,
    emergency_contact_phone VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User preferences - App settings and customization
CREATE TABLE user_preferences (
    preference_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    notification_enabled BOOLEAN DEFAULT TRUE,
    reminder_sound VARCHAR(50) DEFAULT 'default',
    reminder_vibration BOOLEAN DEFAULT TRUE,
    theme VARCHAR(20) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ==========================================
-- Medication Tables
-- ==========================================

-- Medications table - Base medication information
CREATE TABLE medications (
    medication_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    dosage VARCHAR(50) NOT NULL,
    medication_type VARCHAR(50) NULL, -- e.g., 'Antidepressant', 'Pain reliever', etc.
    active_ingredient VARCHAR(100) NULL,
    pill_type VARCHAR(50) NULL, -- e.g., 'purple-white', 'blue', 'white', etc. for UI
    icon_type VARCHAR(50) NULL, -- For UI icon display
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Medication inventory - Track remaining medications and refill info
CREATE TABLE medication_inventory (
    inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    unit VARCHAR(20) NOT NULL, -- e.g., 'tablets', 'capsules', 'ml', etc.
    refill_date DATE NULL,
    refill_reminder_enabled BOOLEAN DEFAULT TRUE,
    refill_threshold INTEGER DEFAULT 5,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication schedules - When to take medications
CREATE TABLE medication_schedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    frequency VARCHAR(50) NOT NULL, -- 'Daily', 'Weekly', 'Monthly', 'As needed'
    start_date DATE NOT NULL,
    end_date DATE NULL,
    notes TEXT NULL,
    when_to_take TEXT NULL, -- Special instructions, e.g., "After meals"
    side_effects TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication times - Specific times for each medication
CREATE TABLE medication_times (
    time_id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    time_of_day VARCHAR(20) NOT NULL, -- 'Morning', 'Afternoon', 'Evening', 'Night'
    specific_time TIME NULL,
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(schedule_id) ON DELETE CASCADE
);

-- ==========================================
-- Reminders & Scheduling Tables
-- ==========================================

-- Reminders table - Notifications to take medicine
CREATE TABLE reminders (
    reminder_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    time TIME NOT NULL,
    date DATE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50) NULL, -- e.g., 'daily', 'weekly', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Reminder-medication associations - Which medications belong to which reminders
CREATE TABLE reminder_medications (
    reminder_med_id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id INTEGER NOT NULL,
    medication_id INTEGER NOT NULL,
    dosage_override VARCHAR(50) NULL, -- Override default dosage if needed
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'taken', 'skipped'
    taken_at TIMESTAMP NULL,
    FOREIGN KEY (reminder_id) REFERENCES reminders(reminder_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication sessions - A grouping of medication schedules for filtering
CREATE TABLE medication_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    medication_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication history - Log of medication consumption
CREATE TABLE medication_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    medication_id INTEGER NOT NULL,
    taken_date DATE NOT NULL,
    taken_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'taken', 'skipped', 'missed'
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- ==========================================
-- Friend Management & Chat Tables
-- ==========================================

-- Contacts table - User connections and friends
CREATE TABLE contacts (
    contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    contact_user_id INTEGER NOT NULL,
    contact_type VARCHAR(50) NOT NULL, -- 'friend', 'family', 'caregiver', 'healthcare_provider'
    nickname VARCHAR(100) NULL,
    can_view_medications BOOLEAN DEFAULT FALSE,
    can_view_reminders BOOLEAN DEFAULT FALSE,
    can_view_history BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (contact_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, contact_user_id) -- Prevent duplicate contacts
);

-- Friend requests table - Pending friend connections
CREATE TABLE friend_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    request_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(requester_id, recipient_id) -- Prevent duplicate requests
);

-- Chat conversations table - Group or direct message conversations
CREATE TABLE chat_conversations (
    conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_name VARCHAR(100) NULL, -- NULL for direct messages, named for group chats
    is_group_chat BOOLEAN DEFAULT FALSE,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat conversation participants - Who belongs to each conversation
CREATE TABLE chat_participants (
    participant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    is_admin BOOLEAN DEFAULT FALSE, -- For group chats
    notifications_enabled BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(conversation_id, user_id) -- A user can only be added once to a conversation
);

-- Chat messages table - Individual messages
CREATE TABLE chat_messages (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP NULL,
    is_read BOOLEAN DEFAULT FALSE,
    has_attachments BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat attachments table - Files, images, and other media
CREATE TABLE chat_attachments (
    attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'image', 'document', 'audio', 'medication', etc.
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL, -- in bytes
    thumbnail_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE
);

-- Message read status table - Track which users have read which messages
CREATE TABLE message_read_status (
    status_id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id) -- Each user can only mark a message as read once
);

-- Medication share table - For sharing medication information in chats
CREATE TABLE medication_shares (
    share_id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    medication_id INTEGER NOT NULL,
    share_type VARCHAR(50) NOT NULL, -- 'medication_details', 'reminder', 'history'
    expires_at TIMESTAMP NULL, -- NULL for no expiration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- ==========================================
-- Indexes for Performance Optimization
-- ==========================================

-- User-related indexes
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_auth_tokens_user ON authentication_tokens (user_id);
CREATE INDEX idx_user_profiles_user ON user_profiles (user_id);

-- Medication-related indexes
CREATE INDEX idx_medications_user ON medications (user_id);
CREATE INDEX idx_medication_inventory_medication ON medication_inventory (medication_id);
CREATE INDEX idx_medication_schedules_medication ON medication_schedules (medication_id);
CREATE INDEX idx_medication_times_schedule ON medication_times (schedule_id);

-- Reminder-related indexes
CREATE INDEX idx_reminders_user ON reminders (user_id);
CREATE INDEX idx_reminders_date ON reminders (date);
CREATE INDEX idx_reminder_medications_reminder ON reminder_medications (reminder_id);
CREATE INDEX idx_reminder_medications_medication ON reminder_medications (medication_id);
CREATE INDEX idx_reminder_medications_status ON reminder_medications (status);

-- History-related indexes
CREATE INDEX idx_medication_history_user ON medication_history (user_id);
CREATE INDEX idx_medication_history_medication ON medication_history (medication_id);
CREATE INDEX idx_medication_history_date ON medication_history (taken_date);
CREATE INDEX idx_medication_sessions_user_med ON medication_sessions (user_id, medication_id);

-- Friend management indexes
CREATE INDEX idx_contacts_user ON contacts (user_id);
CREATE INDEX idx_contacts_contact_user ON contacts (contact_user_id);
CREATE INDEX idx_contacts_type ON contacts (contact_type);
CREATE INDEX idx_friend_requests_requester ON friend_requests (requester_id);
CREATE INDEX idx_friend_requests_recipient ON friend_requests (recipient_id);
CREATE INDEX idx_friend_requests_status ON friend_requests (status);

-- Chat indexes
CREATE INDEX idx_chat_conversations_created_by ON chat_conversations (created_by);
CREATE INDEX idx_chat_participants_conversation ON chat_participants (conversation_id);
CREATE INDEX idx_chat_participants_user ON chat_participants (user_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages (conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages (sender_id);
CREATE INDEX idx_chat_messages_sent_at ON chat_messages (sent_at);
CREATE INDEX idx_chat_attachments_message ON chat_attachments (message_id);
CREATE INDEX idx_chat_attachments_file_type ON chat_attachments (file_type);
CREATE INDEX idx_message_read_status_message ON message_read_status (message_id);
CREATE INDEX idx_message_read_status_user ON message_read_status (user_id);
CREATE INDEX idx_medication_shares_message ON medication_shares (message_id);
CREATE INDEX idx_medication_shares_medication ON medication_shares (medication_id);

-- ==========================================
-- Triggers for Automatic Updates
-- ==========================================

-- Update the updated_at timestamp when a user record is modified
CREATE TRIGGER update_user_timestamp 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = OLD.user_id;
END;

-- Update the updated_at timestamp when a user profile is modified
CREATE TRIGGER update_user_profile_timestamp 
AFTER UPDATE ON user_profiles
FOR EACH ROW
BEGIN
    UPDATE user_profiles SET updated_at = CURRENT_TIMESTAMP WHERE profile_id = OLD.profile_id;
END;

-- Update the updated_at timestamp when a medication is modified
CREATE TRIGGER update_medication_timestamp 
AFTER UPDATE ON medications
FOR EACH ROW
BEGIN
    UPDATE medications SET updated_at = CURRENT_TIMESTAMP WHERE medication_id = OLD.medication_id;
END;

-- Update the updated_at timestamp when a medication schedule is modified
CREATE TRIGGER update_schedule_timestamp 
AFTER UPDATE ON medication_schedules
FOR EACH ROW
BEGIN
    UPDATE medication_schedules SET updated_at = CURRENT_TIMESTAMP WHERE schedule_id = OLD.schedule_id;
END;

-- Update the last_updated timestamp when medication inventory is modified
CREATE TRIGGER update_inventory_timestamp 
AFTER UPDATE ON medication_inventory
FOR EACH ROW
BEGIN
    UPDATE medication_inventory SET last_updated = CURRENT_TIMESTAMP WHERE inventory_id = OLD.inventory_id;
END;

-- Update the updated_at timestamp when a reminder is modified
CREATE TRIGGER update_reminder_timestamp 
AFTER UPDATE ON reminders
FOR EACH ROW
BEGIN
    UPDATE reminders SET updated_at = CURRENT_TIMESTAMP WHERE reminder_id = OLD.reminder_id;
END;

-- Update the updated_at timestamp when a contact is modified
CREATE TRIGGER update_contact_timestamp 
AFTER UPDATE ON contacts
FOR EACH ROW
BEGIN
    UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE contact_id = OLD.contact_id;
END;

-- Update the updated_at timestamp when a friend request is modified
CREATE TRIGGER update_friend_request_timestamp 
AFTER UPDATE ON friend_requests
FOR EACH ROW
BEGIN
    UPDATE friend_requests SET updated_at = CURRENT_TIMESTAMP WHERE request_id = OLD.request_id;
END;

-- Update the updated_at timestamp when a chat conversation is modified
CREATE TRIGGER update_chat_conversation_timestamp 
AFTER UPDATE ON chat_conversations
FOR EACH ROW
BEGIN
    UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = OLD.conversation_id;
END;

-- Update the has_attachments flag when attachments are added
CREATE TRIGGER update_message_has_attachments 
AFTER INSERT ON chat_attachments
FOR EACH ROW
BEGIN
    UPDATE chat_messages SET has_attachments = TRUE WHERE message_id = NEW.message_id;
END;

-- Update the is_read flag when a message is read
CREATE TRIGGER update_message_read_status
AFTER INSERT ON message_read_status
FOR EACH ROW
BEGIN
    UPDATE chat_messages 
    SET is_read = (
        SELECT COUNT(*) = (
            SELECT COUNT(*)
            FROM chat_participants
            WHERE conversation_id = (SELECT conversation_id FROM chat_messages WHERE message_id = NEW.message_id)
            AND left_at IS NULL
            AND user_id != (SELECT sender_id FROM chat_messages WHERE message_id = NEW.message_id)
        )
        FROM message_read_status
        WHERE message_id = NEW.message_id
    )
    WHERE message_id = NEW.message_id;
END;

-- ==========================================
-- Sample SQL Queries for Common Operations
-- ==========================================

-- 1. Get all medications for a specific user
-- SELECT m.medication_id, m.name, m.dosage, m.pill_type, m.icon_type,
--        mi.remaining_quantity, mi.unit, mi.refill_date
-- FROM medications m
-- LEFT JOIN medication_inventory mi ON m.medication_id = mi.medication_id
-- WHERE m.user_id = ?
-- ORDER BY m.name;

-- 2. Get today's medication schedule for a user
-- SELECT m.name, m.dosage, ms.frequency, mt.time_of_day, mt.specific_time,
--        ms.notes, ms.when_to_take, rm.status
-- FROM medications m
-- JOIN medication_schedules ms ON m.medication_id = ms.medication_id
-- JOIN medication_times mt ON ms.schedule_id = mt.schedule_id
-- LEFT JOIN reminders r ON r.user_id = m.user_id AND r.date = CURRENT_DATE
-- LEFT JOIN reminder_medications rm ON r.reminder_id = rm.reminder_id AND rm.medication_id = m.medication_id
-- WHERE m.user_id = ?
-- AND (ms.end_date IS NULL OR ms.end_date >= CURRENT_DATE)
-- AND ms.start_date <= CURRENT_DATE
-- ORDER BY mt.specific_time;

-- 3. Mark a medication as taken
-- UPDATE reminder_medications
-- SET status = 'taken', taken_at = CURRENT_TIMESTAMP
-- WHERE reminder_id = ? AND medication_id = ?;

-- 4. Create medication history entry when medication is taken
-- INSERT INTO medication_history (user_id, medication_id, taken_date, taken_time, status)
-- VALUES (?, ?, CURRENT_DATE, CURRENT_TIME, 'taken');

-- 5. Get medication adherence stats for the current month
-- SELECT 
--     m.name,
--     COUNT(CASE WHEN mh.status = 'taken' THEN 1 END) as taken_count,
--     COUNT(CASE WHEN mh.status = 'skipped' THEN 1 END) as skipped_count,
--     COUNT(CASE WHEN mh.status = 'missed' THEN 1 END) as missed_count
-- FROM medications m
-- LEFT JOIN medication_history mh ON m.medication_id = mh.medication_id 
--     AND mh.taken_date >= date('now','start of month')
--     AND mh.taken_date <= date('now','start of month','+1 month','-1 day')
-- WHERE m.user_id = ?
-- GROUP BY m.medication_id;

-- ==========================================
-- Sample SQL Queries for Friend Management & Chat
-- ==========================================

-- 6. Get all friends/contacts for a user
-- SELECT c.contact_id, c.contact_type, c.nickname, 
--        u.user_id, up.name, up.profile_picture_url,
--        c.can_view_medications, c.can_view_reminders, c.can_view_history
-- FROM contacts c
-- JOIN users u ON c.contact_user_id = u.user_id
-- JOIN user_profiles up ON u.user_id = up.user_id
-- WHERE c.user_id = ?
-- ORDER BY up.name;

-- 7. Get all pending friend requests for a user
-- SELECT fr.request_id, fr.request_message, fr.created_at,
--        u.user_id as requester_id, up.name as requester_name, 
--        up.profile_picture_url as requester_picture
-- FROM friend_requests fr
-- JOIN users u ON fr.requester_id = u.user_id
-- JOIN user_profiles up ON u.user_id = up.user_id
-- WHERE fr.recipient_id = ?
-- AND fr.status = 'pending'
-- ORDER BY fr.created_at DESC;

-- 8. Accept a friend request and create bidirectional contact relationship
-- BEGIN TRANSACTION;
--   UPDATE friend_requests 
--   SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
--   WHERE request_id = ?;
--   
--   INSERT INTO contacts (user_id, contact_user_id, contact_type)
--   VALUES 
--   (
--     (SELECT recipient_id FROM friend_requests WHERE request_id = ?),
--     (SELECT requester_id FROM friend_requests WHERE request_id = ?),
--     'friend'
--   );
--   
--   INSERT INTO contacts (user_id, contact_user_id, contact_type)
--   VALUES 
--   (
--     (SELECT requester_id FROM friend_requests WHERE request_id = ?),
--     (SELECT recipient_id FROM friend_requests WHERE request_id = ?),
--     'friend'
--   );
-- COMMIT;

-- 9. Get all conversations for a user
-- SELECT cc.conversation_id, cc.conversation_name, cc.is_group_chat,
--        cc.updated_at, cp.notifications_enabled,
--        (SELECT COUNT(*) FROM chat_messages cm 
--         WHERE cm.conversation_id = cc.conversation_id 
--         AND cm.is_read = 0 
--         AND cm.sender_id != ?) as unread_count,
--        (SELECT cm.message_text FROM chat_messages cm 
--         WHERE cm.conversation_id = cc.conversation_id 
--         ORDER BY cm.sent_at DESC LIMIT 1) as last_message
-- FROM chat_conversations cc
-- JOIN chat_participants cp ON cc.conversation_id = cp.conversation_id
-- WHERE cp.user_id = ?
-- AND cp.left_at IS NULL
-- ORDER BY cc.updated_at DESC;

-- 10. Get messages for a specific conversation
-- SELECT cm.message_id, cm.message_text, cm.sent_at, cm.is_read, cm.has_attachments,
--        u.user_id as sender_id, up.name as sender_name, up.profile_picture_url
-- FROM chat_messages cm
-- JOIN users u ON cm.sender_id = u.user_id
-- JOIN user_profiles up ON u.user_id = up.user_id
-- WHERE cm.conversation_id = ?
-- ORDER BY cm.sent_at ASC
-- LIMIT 50 OFFSET ?;

-- 11. Send a new message in a conversation
-- INSERT INTO chat_messages (conversation_id, sender_id, message_text)
-- VALUES (?, ?, ?);

-- 12. Get all attachments for a message
-- SELECT ca.attachment_id, ca.file_type, ca.file_url, ca.file_name, 
--        ca.file_size, ca.thumbnail_url
-- FROM chat_attachments ca
-- WHERE ca.message_id = ?;

-- 13. Create a new direct message conversation between two users
-- BEGIN TRANSACTION;
--   INSERT INTO chat_conversations (is_group_chat, created_by)
--   VALUES (FALSE, ?);
--   
--   INSERT INTO chat_participants (conversation_id, user_id)
--   VALUES (last_insert_rowid(), ?); -- First user (creator)
--   
--   INSERT INTO chat_participants (conversation_id, user_id)
--   VALUES (last_insert_rowid(), ?); -- Second user
-- COMMIT;

-- 14. Mark all messages in a conversation as read by a user
-- INSERT OR IGNORE INTO message_read_status (message_id, user_id)
-- SELECT message_id, ?
-- FROM chat_messages
-- WHERE conversation_id = ?
-- AND sender_id != ?
-- AND message_id NOT IN (
--   SELECT message_id FROM message_read_status WHERE user_id = ?
-- );

-- 15. Share medication information in a chat
-- BEGIN TRANSACTION;
--   INSERT INTO chat_messages (conversation_id, sender_id, message_text)
--   VALUES (?, ?, 'Shared medication information');
--   
--   INSERT INTO medication_shares (message_id, medication_id, share_type)
--   VALUES (last_insert_rowid(), ?, 'medication_details');
-- COMMIT;

-- 16. Get shared medications in a conversation
-- SELECT ms.share_id, ms.share_type, ms.created_at,
--        m.name, m.description, m.dosage, m.medication_type,
--        u.user_id as shared_by_id, up.name as shared_by_name
-- FROM medication_shares ms
-- JOIN chat_messages cm ON ms.message_id = cm.message_id
-- JOIN medications m ON ms.medication_id = m.medication_id
-- JOIN users u ON cm.sender_id = u.user_id
-- JOIN user_profiles up ON u.user_id = up.user_id
-- WHERE cm.conversation_id = ?
-- ORDER BY ms.created_at DESC;