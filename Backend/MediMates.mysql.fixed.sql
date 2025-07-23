-- MediMates MySQL Database Schema
-- A comprehensive MySQL database for medication management application

-- First, drop tables with foreign key constraints in the correct order
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS medication_history;
DROP TABLE IF EXISTS reminder_medications;
DROP TABLE IF EXISTS medication_sessions;
DROP TABLE IF EXISTS medication_times;
DROP TABLE IF EXISTS medication_schedules;
DROP TABLE IF EXISTS medication_inventory;
DROP TABLE IF EXISTS medication_shares;
DROP TABLE IF EXISTS medications;
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

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

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
    name VARCHAR(255) NOT NULL,
    bio TEXT NULL,
    profile_picture VARCHAR(255) NULL,
    date_of_birth DATE NULL,
    phone_number VARCHAR(20) NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User preferences
CREATE TABLE user_preferences (
    pref_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    reminder_sound VARCHAR(50) DEFAULT 'default',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ==========================================
-- Medication Management Tables
-- ==========================================

-- Medications table - Core medication information
CREATE TABLE medications (
    medication_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    medication_type VARCHAR(50) NULL,
    dosage VARCHAR(50) NULL,
    dosage_unit VARCHAR(20) NULL,
    medication_form VARCHAR(50) NULL, -- pill, liquid, injection, etc.
    icon VARCHAR(255) NULL,
    color VARCHAR(20) NULL,
    instructions TEXT NULL,
    warnings TEXT NULL,
    is_prescription BOOLEAN DEFAULT FALSE,
    prescription_details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Medication inventory tracking
CREATE TABLE medication_inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    initial_quantity FLOAT NOT NULL,
    current_quantity FLOAT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    refill_reminder_threshold FLOAT NULL,
    expiration_date DATE NULL,
    last_refill_date DATE NULL,
    next_refill_date DATE NULL,
    pharmacy_info TEXT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication schedules
CREATE TABLE medication_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly, as-needed
    days_of_week VARCHAR(20) NULL, -- For weekly: 1,2,3,4,5,6,7 (Monday to Sunday)
    days_of_month VARCHAR(100) NULL, -- For monthly: 1,2,3,...31
    repeat_every INT DEFAULT 1, -- every X days/weeks/months
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Specific times for medication
CREATE TABLE medication_times (
    time_id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    time_of_day TIME NOT NULL,
    dosage FLOAT NOT NULL,
    with_food BOOLEAN DEFAULT FALSE,
    with_water BOOLEAN DEFAULT TRUE,
    special_instructions TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(schedule_id) ON DELETE CASCADE
);

-- Record of medication sessions
CREATE TABLE medication_sessions (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    scheduled_datetime DATETIME NOT NULL,
    taken_datetime DATETIME NULL,
    skipped BOOLEAN DEFAULT FALSE,
    skip_reason TEXT NULL,
    dosage_taken FLOAT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- ==========================================
-- Reminder System Tables
-- ==========================================

-- Reminders table
CREATE TABLE reminders (
    reminder_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50) NULL, -- daily, weekly, monthly
    recurrence_interval INT DEFAULT 1, -- every X days/weeks/months
    end_recurrence DATE NULL,
    notification_time INT DEFAULT 15, -- minutes before to notify
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Junction table for reminders and medications
CREATE TABLE reminder_medications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reminder_id INT NOT NULL,
    medication_id INT NOT NULL,
    dosage FLOAT NULL,
    schedule_time TIME NULL,
    status VARCHAR(20) DEFAULT 'pending',
    taken_at DATETIME NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reminder_id) REFERENCES reminders(reminder_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication history and changes
CREATE TABLE medication_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- added, modified, discontinued
    change_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_by_user_id INT NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    notes TEXT NULL,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ==========================================
-- Contact and Social Tables
-- ==========================================

-- Contacts (healthcare providers, emergency contacts, caregivers)
CREATE TABLE contacts (
    contact_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) NULL,
    contact_type VARCHAR(50) NOT NULL, -- doctor, family, emergency, pharmacy, etc.
    phone VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    notes TEXT NULL,
    is_emergency_contact BOOLEAN DEFAULT FALSE,
    is_healthcare_provider BOOLEAN DEFAULT FALSE,
    specialty VARCHAR(100) NULL, -- for healthcare providers
    organization VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Friend Requests
CREATE TABLE friend_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Medication sharing (with caregivers, family members, etc.)
CREATE TABLE medication_shares (
    share_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    user_id INT NOT NULL, -- owner
    shared_with_user_id INT NOT NULL, -- recipient
    permission_level VARCHAR(20) DEFAULT 'view', -- view, edit, administer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ==========================================
-- Messaging System Tables
-- ==========================================

-- Chat conversations
CREATE TABLE chat_conversations (
    conversation_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NULL,
    created_by INT NOT NULL,
    is_group_chat BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat participants
CREATE TABLE chat_participants (
    participant_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    muted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat messages
CREATE TABLE chat_messages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP NULL,
    has_attachments BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, medication_share
    reference_id INT NULL, -- for replies or forwarded messages
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reference_id) REFERENCES chat_messages(message_id) ON DELETE SET NULL
);

-- Message read status tracking
CREATE TABLE message_read_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat attachments
CREATE TABLE chat_attachments (
    attachment_id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE
);

-- ==========================================
-- Indexes for Performance Optimization
-- ==========================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Medication-related indexes
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications (user_id);

-- Reminder-related indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders (date);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by ON chat_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at ON chat_messages (sent_at);

-- ==========================================
-- Triggers for Automatic Updates
-- ==========================================

-- Update the updated_at timestamp when a user record is modified
CREATE TRIGGER update_user_timestamp 
BEFORE UPDATE ON users
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a user profile is modified
CREATE TRIGGER update_user_profile_timestamp 
BEFORE UPDATE ON user_profiles
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a medication is modified
CREATE TRIGGER update_medication_timestamp 
BEFORE UPDATE ON medications
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a medication schedule is modified
CREATE TRIGGER update_schedule_timestamp 
BEFORE UPDATE ON medication_schedules
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the last_updated timestamp when medication inventory is modified
CREATE TRIGGER update_inventory_timestamp 
BEFORE UPDATE ON medication_inventory
FOR EACH ROW
SET NEW.last_updated = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a reminder is modified
CREATE TRIGGER update_reminder_timestamp 
BEFORE UPDATE ON reminders
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a contact is modified
CREATE TRIGGER update_contact_timestamp 
BEFORE UPDATE ON contacts
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a friend request is modified
CREATE TRIGGER update_friend_request_timestamp 
BEFORE UPDATE ON friend_requests
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the updated_at timestamp when a chat conversation is modified
CREATE TRIGGER update_chat_conversation_timestamp 
BEFORE UPDATE ON chat_conversations
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

-- Update the has_attachments flag when attachments are added
CREATE TRIGGER update_message_has_attachments 
AFTER INSERT ON chat_attachments
FOR EACH ROW
UPDATE chat_messages SET has_attachments = TRUE WHERE message_id = NEW.message_id;
