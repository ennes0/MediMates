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
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User profile information
CREATE TABLE user_profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    date_of_birth DATE NULL,
    phone VARCHAR(20) NULL,
    profile_picture VARCHAR(255) NULL,
    gender VARCHAR(20) NULL,
    emergency_contact_name VARCHAR(100) NULL,
    emergency_contact_phone VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- User preferences
CREATE TABLE user_preferences (
    preference_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'light',
    notification_enabled BOOLEAN DEFAULT TRUE,
    medication_reminders BOOLEAN DEFAULT TRUE,
    refill_reminders BOOLEAN DEFAULT TRUE,
    reminder_sound VARCHAR(50) DEFAULT 'default',
    reminder_vibration BOOLEAN DEFAULT TRUE,
    reminder_advance_notice INT DEFAULT 15, -- minutes before reminder notification
    language VARCHAR(10) DEFAULT 'en',
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
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    medication_type VARCHAR(50) NULL,
    strength VARCHAR(50) NULL, -- e.g., "10mg", "500mg"
    manufacturer VARCHAR(100) NULL,
    rx_number VARCHAR(50) NULL,
    prescribed_by VARCHAR(100) NULL,
    pharmacy VARCHAR(100) NULL,
    prescription_date DATE NULL,
    instructions TEXT NULL,
    side_effects TEXT NULL,
    warnings TEXT NULL,
    is_prescription BOOLEAN DEFAULT FALSE,
    icon VARCHAR(50) DEFAULT 'pill',
    color VARCHAR(20) DEFAULT 'blue',
    barcode VARCHAR(100) NULL, -- For scanning medication
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Medication inventory tracking
CREATE TABLE medication_inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pills', -- pills, mL, mg, etc.
    refill_reminder_threshold INT DEFAULT 5,
    last_refill_date DATE NULL,
    last_refill_quantity DECIMAL(10,2) NULL,
    expiration_date DATE NULL,
    storage_location VARCHAR(100) NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Medication schedules
CREATE TABLE medication_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    medication_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly, as-needed
    times_per_day INT NULL,
    days_of_week VARCHAR(20) NULL, -- For weekly schedules (e.g., "1,3,5" for Mon,Wed,Fri)
    days_of_month VARCHAR(100) NULL, -- For monthly schedules
    as_needed BOOLEAN DEFAULT FALSE,
    special_instructions TEXT NULL,
    dosage DECIMAL(10,2) NOT NULL DEFAULT 1,
    dosage_unit VARCHAR(20) DEFAULT 'pill', -- pill, mL, mg, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- Specific medication times
CREATE TABLE medication_times (
    time_id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    time_of_day TIME NOT NULL, -- e.g., "08:00", "20:00"
    dosage DECIMAL(10,2) NULL, -- Override of schedule dosage if needed
    with_food BOOLEAN DEFAULT FALSE,
    with_water BOOLEAN DEFAULT TRUE,
    notes TEXT NULL,
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(schedule_id) ON DELETE CASCADE
);

-- ==========================================
-- Reminder System Tables
-- ==========================================

-- Reminders table - For various health-related reminders
CREATE TABLE reminders (
    reminder_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    repeat_type VARCHAR(20) NULL, -- none, daily, weekly, monthly
    repeat_interval INT NULL, -- every X days, weeks, months
    repeat_days VARCHAR(20) NULL, -- days of week for weekly repeats
    repeat_end_date DATE NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, missed, snoozed
    snooze_until TIMESTAMP NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_time INT DEFAULT 15, -- minutes before
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Link between reminders and medications
CREATE TABLE reminder_medications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reminder_id INT NOT NULL,
    medication_id INT NOT NULL,
    dosage DECIMAL(10,2) NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, taken, skipped
    notes TEXT NULL,
    taken_at TIMESTAMP NULL,
    FOREIGN KEY (reminder_id) REFERENCES reminders(reminder_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- ==========================================
-- Medication History and Tracking
-- ==========================================

-- Medication history - Track when medications were taken
CREATE TABLE medication_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    medication_id INT NOT NULL,
    dosage_taken DECIMAL(10,2) NOT NULL,
    scheduled_time TIMESTAMP NULL,
    taken_date DATE NOT NULL,
    taken_time TIME NOT NULL,
    taken_timestamp TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL, -- taken, skipped, missed
    notes TEXT NULL,
    mood VARCHAR(50) NULL, -- How patient felt after taking medication
    side_effects TEXT NULL, -- Any side effects experienced
    effectiveness INT NULL, -- Scale 1-10
    reminder_id INT NULL, -- Link to reminder if applicable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE,
    FOREIGN KEY (reminder_id) REFERENCES reminders(reminder_id) ON DELETE SET NULL
);

-- Medication sessions for tracking adherence
CREATE TABLE medication_sessions (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    medication_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    adherence_rate DECIMAL(5,2) NULL, -- Percentage of doses taken correctly
    missed_doses INT DEFAULT 0,
    notes TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- ==========================================
-- Contact Management Tables
-- ==========================================

-- Contacts table - For healthcare providers, pharmacies, emergency contacts
CREATE TABLE contacts (
    contact_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    contact_type VARCHAR(50) NOT NULL, -- caregiver, doctor, pharmacy, emergency, friend
    phone VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    notes TEXT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    contact_user_id INT NULL, -- For internal app users as contacts
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (contact_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Friend requests table
CREATE TABLE friend_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    requester_id INT NOT NULL,
    recipient_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ==========================================
-- Medication Sharing Tables
-- ==========================================

-- Medication sharing with contacts
CREATE TABLE medication_shares (
    share_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    contact_id INT NOT NULL,
    medication_id INT NOT NULL,
    permission_level VARCHAR(20) DEFAULT 'read', -- read, remind, manage
    can_view_history BOOLEAN DEFAULT FALSE,
    can_send_reminders BOOLEAN DEFAULT FALSE,
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE
);

-- ==========================================
-- Chat System Tables
-- ==========================================

-- Chat conversations
CREATE TABLE chat_conversations (
    conversation_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_group_chat BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Chat participants
CREATE TABLE chat_participants (
    participant_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    muted_until TIMESTAMP NULL,
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
CREATE INDEX idx_users_email ON users (email);

-- Medication-related indexes
CREATE INDEX idx_medications_user ON medications (user_id);

-- Reminder-related indexes
CREATE INDEX idx_reminders_user ON reminders (user_id);
CREATE INDEX idx_reminders_date ON reminders (date);

-- Chat indexes
CREATE INDEX idx_chat_conversations_created_by ON chat_conversations (created_by);
CREATE INDEX idx_chat_messages_conversation ON chat_messages (conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages (sender_id);
CREATE INDEX idx_chat_messages_sent_at ON chat_messages (sent_at);

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
