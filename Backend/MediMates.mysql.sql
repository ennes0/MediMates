-- MediMates MySQL Database Schema
-- A comprehensive MySQL database for medication management application

-- Drop existing tables if they exist
DROP TABLE IF EXISTS medication_history;
DROP TABLE IF EXISTS reminder_medications;
DROP TABLE IF EXISTS medication_sessions;
DROP TABLE IF EXISTS medication_times;
DROP TABLE IF EXISTS medication_schedules;
DROP TABLE IF EXISTS medication_inventory;
DROP TABLE IF EXISTS medications;
DROP TABLE IF EXISTS chat_attachments;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS message_read_status;
DROP TABLE IF EXISTS medication_shares;
DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS authentication_tokens;
DROP TABLE IF EXISTS users;

-- ==========================================
-- Users and Authentication Tables
-- ==========================================

-- Users table - Core user data
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Authentication tokens table - For session management
CREATE TABLE authentication_tokens (
    token_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_info TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User profiles table - Extended user information
CREATE TABLE user_profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    name VARCHAR(100) NULL,
    profile_picture_url TEXT NULL,
    phone_number VARCHAR(20) NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    emergency_contact_name VARCHAR(100) NULL,
    emergency_contact_phone VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User preferences table - App settings and preferences
CREATE TABLE user_preferences (
    preference_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    preference_key VARCHAR(50) NOT NULL,
    preference_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, preference_key)
);

-- ==========================================
-- Medication Management Tables
-- ==========================================

-- Medications table - Base information about medications
CREATE TABLE medications (
    medication_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    dosage VARCHAR(50) NULL,
    pill_type VARCHAR(50) NULL,
    medication_type VARCHAR(50) NULL,
    icon_type VARCHAR(50) NULL,
    manufacturer VARCHAR(100) NULL,
    prescriber VARCHAR(100) NULL,
    prescription_date DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Medication inventory table - Tracking medication supplies
CREATE TABLE medication_inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    remaining_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    initial_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'pills',
    refill_date DATE NULL,
    low_quantity_threshold DECIMAL(10,2) NULL,
    refill_reminder_days INT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication schedules table - When medications should be taken
CREATE TABLE medication_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly, as needed
    days_of_week VARCHAR(50) NULL,  -- for weekly: "1,3,5" (Mon,Wed,Fri)
    day_of_month INT NULL,          -- for monthly
    start_date DATE NOT NULL,
    end_date DATE NULL,
    when_to_take VARCHAR(50) NULL,  -- before meal, with meal, after meal, etc.
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication times table - Specific times for each schedule
CREATE TABLE medication_times (
    time_id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    time_of_day VARCHAR(20) NULL, -- morning, afternoon, evening, night
    specific_time TIME NULL,      -- actual time like 08:00
    dosage VARCHAR(50) NULL,      -- amount to take at this time
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(schedule_id) ON DELETE CASCADE
);

-- Reminders table - Daily generated reminders
CREATE TABLE reminders (
    reminder_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Reminder-medication associations - Which medications belong to which reminders
CREATE TABLE reminder_medications (
    reminder_med_id INT PRIMARY KEY AUTO_INCREMENT,
    reminder_id INT NOT NULL,
    medication_id INT NOT NULL,
    schedule_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, taken, skipped, missed
    taken_at TIMESTAMP NULL,
    notes TEXT NULL,
    FOREIGN KEY (reminder_id) REFERENCES reminders(reminder_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication sessions - A grouping of medication schedules for filtering
CREATE TABLE medication_sessions (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    medication_id INT NOT NULL,
    session_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication history - Log of medication consumption
CREATE TABLE medication_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    medication_id INT NOT NULL,
    taken_date DATE NOT NULL,
    taken_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL, -- taken, skipped, missed
    dosage_taken VARCHAR(50) NULL,
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
    contact_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    contact_user_id INT NOT NULL,
    contact_type VARCHAR(20) DEFAULT 'friend', -- friend, family, caregiver, doctor
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
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    requester_id INT NOT NULL,
    recipient_id INT NOT NULL,
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
    conversation_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_name VARCHAR(100) NULL, -- NULL for direct messages, named for group chats
    is_group_chat BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat conversation participants - Who belongs to each conversation
CREATE TABLE chat_participants (
    participant_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
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
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
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
    attachment_id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'image', 'document', 'audio', 'medication', etc.
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL, -- in bytes
    thumbnail_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE
);

-- Message read status table - Track which users have read which messages
CREATE TABLE message_read_status (
    status_id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id) -- Each user can only mark a message as read once
);

-- Medication share table - For sharing medication information in chats
CREATE TABLE medication_shares (
    share_id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    medication_id INT NOT NULL,
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
DELIMITER //
CREATE TRIGGER update_user_timestamp 
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a user profile is modified
DELIMITER //
CREATE TRIGGER update_user_profile_timestamp 
BEFORE UPDATE ON user_profiles
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a medication is modified
DELIMITER //
CREATE TRIGGER update_medication_timestamp 
BEFORE UPDATE ON medications
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a medication schedule is modified
DELIMITER //
CREATE TRIGGER update_schedule_timestamp 
BEFORE UPDATE ON medication_schedules
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the last_updated timestamp when medication inventory is modified
DELIMITER //
CREATE TRIGGER update_inventory_timestamp 
BEFORE UPDATE ON medication_inventory
FOR EACH ROW
BEGIN
    SET NEW.last_updated = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a reminder is modified
DELIMITER //
CREATE TRIGGER update_reminder_timestamp 
BEFORE UPDATE ON reminders
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a contact is modified
DELIMITER //
CREATE TRIGGER update_contact_timestamp 
BEFORE UPDATE ON contacts
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a friend request is modified
DELIMITER //
CREATE TRIGGER update_friend_request_timestamp 
BEFORE UPDATE ON friend_requests
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the updated_at timestamp when a chat conversation is modified
DELIMITER //
CREATE TRIGGER update_chat_conversation_timestamp 
BEFORE UPDATE ON chat_conversations
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- Update the has_attachments flag when attachments are added
DELIMITER //
CREATE TRIGGER update_message_has_attachments 
AFTER INSERT ON chat_attachments
FOR EACH ROW
BEGIN
    UPDATE chat_messages SET has_attachments = TRUE WHERE message_id = NEW.message_id;
END//
DELIMITER ;
