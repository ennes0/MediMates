/**
 * Seed Database Script
 * This script populates the database with sample users and data for testing
 */
const bcrypt = require('bcrypt');
const { db } = require('../config/database');
const path = require('path');
const fs = require('fs');

// Clear previous data
const clearDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log('Clearing previous data...');
    
    const tables = [
      'medication_history',
      'reminder_medications',
      'reminders',
      'medication_times',
      'medication_schedules',
      'medication_inventory',
      'medication_sessions',
      'medications',
      'medication_shares',
      'message_read_status',
      'chat_attachments',
      'chat_messages',
      'chat_participants',
      'chat_conversations',
      'friend_requests',
      'contacts',
      'user_preferences',
      'authentication_tokens',
      'user_profiles',
      'users'
    ];

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = OFF');
      
      tables.forEach(table => {
        db.run(`DELETE FROM ${table}`, (err) => {
          if (err) console.error(`Error clearing ${table}:`, err);
        });
      });
      
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('All tables cleared');
          resolve();
        }
      });
    });
  });
};

// Create test users
const createUsers = async () => {
  console.log('Creating test users...');
  
  // Sample user data
  const users = [
    {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      phone: '+905551234567',
      dob: '1990-01-15',
      gender: 'male'
    },
    {
      email: 'jane@example.com',
      password: 'password123',
      name: 'Jane Doe',
      phone: '+905552345678',
      dob: '1985-04-22',
      gender: 'female'
    },
    {
      email: 'doctor@example.com',
      password: 'password123',
      name: 'Dr. Smith',
      phone: '+905553456789',
      dob: '1975-09-10',
      gender: 'male'
    }
  ];
  
  const userIds = [];
  
  for (const user of users) {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    
    // Insert user
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          'INSERT INTO users (email, password_hash, created_at, updated_at, is_active, last_login) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)',
          [user.email, hashedPassword],
          function(err) {
            if (err) {
              console.error('Error creating user:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const userId = this.lastID;
            userIds.push(userId);
            
            // Insert user profile
            db.run(
              'INSERT INTO user_profiles (user_id, name, phone_number, date_of_birth, gender, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
              [userId, user.name, user.phone, user.dob, user.gender],
              function(err) {
                if (err) {
                  console.error('Error creating user profile:', err);
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                // Insert user preferences
                db.run(
                  `INSERT INTO user_preferences (user_id, notification_enabled, reminder_sound, reminder_vibration, 
                    theme, language, last_updated)
                   VALUES (?, 1, 'default', 1, 'light', 'tr', CURRENT_TIMESTAMP)`,
                  [userId],
                  function(err) {
                    if (err) {
                      console.error('Error creating user preferences:', err);
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }
                    
                    // Commit transaction
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err);
                        db.run('ROLLBACK');
                        reject(err);
                      } else {
                        console.log(`User created: ${user.email} (ID: ${userId})`);
                        resolve(userId);
                      }
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }
  
  return userIds;
};

// Create medications for the first user
const createMedications = async (userId) => {
  console.log(`Creating medications for user ${userId}...`);
  
  const medications = [
    {
      name: 'Aspirin',
      dosage: '100mg',
      pillType: 'tablet',
      description: 'For pain relief and reducing inflammation',
      iconType: 'medicine',
      notes: 'Take with food to avoid stomach upset',
      inventory: {
        remainingQuantity: 28,
        unit: 'tablet',
        refillDate: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0], // 14 days from now
        refillReminder: true
      },
      schedules: [
        {
          frequency: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], // 30 days from now
          whenToTake: 'after_meal',
          notes: 'Take after breakfast',
          times: [
            {
              timeOfDay: 'morning',
              specificTime: '08:00:00'
            },
            {
              timeOfDay: 'evening',
              specificTime: '20:00:00'
            }
          ]
        }
      ]
    },
    {
      name: 'Atorvastatin',
      dosage: '20mg',
      pillType: 'tablet',
      description: 'Cholesterol medication',
      iconType: 'medicine',
      notes: 'Take at night before bed',
      inventory: {
        remainingQuantity: 25,
        unit: 'tablet',
        refillDate: new Date(new Date().setDate(new Date().getDate() + 25)).toISOString().split('T')[0], // 25 days from now
        refillReminder: true
      },
      schedules: [
        {
          frequency: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(new Date().setDate(new Date().getDate() + 90)).toISOString().split('T')[0], // 90 days from now
          whenToTake: 'before_sleep',
          notes: 'Take at bedtime',
          times: [
            {
              timeOfDay: 'night',
              specificTime: '22:00:00'
            }
          ]
        }
      ]
    },
    {
      name: 'Ventolin',
      dosage: '100mcg',
      pillType: 'inhaler',
      description: 'For asthma relief',
      iconType: 'spray',
      notes: 'Use as needed for shortness of breath',
      inventory: {
        remainingQuantity: 180,
        unit: 'puff',
        refillDate: new Date(new Date().setDate(new Date().getDate() + 45)).toISOString().split('T')[0], // 45 days from now
        refillReminder: true
      },
      schedules: [
        {
          frequency: 'as_needed',
          startDate: new Date().toISOString().split('T')[0],
          whenToTake: 'as_needed',
          notes: 'Use when experiencing breathing difficulty',
          times: [
            {
              timeOfDay: 'as_needed',
              specificTime: null
            }
          ]
        }
      ]
    },
    {
      name: 'Vitamin D',
      dosage: '1000 IU',
      pillType: 'capsule',
      description: 'Vitamin D supplement',
      iconType: 'medicine',
      notes: 'Take with food',
      inventory: {
        remainingQuantity: 55,
        unit: 'capsule',
        refillDate: new Date(new Date().setDate(new Date().getDate() + 55)).toISOString().split('T')[0], // 55 days from now
        refillReminder: false
      },
      schedules: [
        {
          frequency: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          whenToTake: 'with_meal',
          notes: 'Take with breakfast',
          times: [
            {
              timeOfDay: 'morning',
              specificTime: '08:30:00'
            }
          ]
        }
      ]
    }
  ];
  
  const medicationIds = [];
  
  for (const med of medications) {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Insert medication
        db.run(
          `INSERT INTO medications (user_id, name, dosage, pill_type, description, icon_type, 
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userId, med.name, med.dosage, med.pillType, med.description, med.iconType],
          function(err) {
            if (err) {
              console.error('Error creating medication:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const medicationId = this.lastID;
            medicationIds.push(medicationId);
            
            // Insert inventory
            if (med.inventory) {
              db.run(
                `INSERT INTO medication_inventory (medication_id, remaining_quantity, 
                  unit, refill_date, refill_reminder_enabled, last_updated)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                  medicationId,
                  med.inventory.remainingQuantity, 
                  med.inventory.unit,
                  med.inventory.refillDate,
                  med.inventory.refillReminder ? 1 : 0
                ],
                function(err) {
                  if (err) {
                    console.error('Error creating inventory:', err);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  // Insert schedules
                  if (med.schedules && med.schedules.length > 0) {
                    let completedSchedules = 0;
                    
                    med.schedules.forEach(schedule => {
                      db.run(
                        `INSERT INTO medication_schedules (medication_id, frequency, start_date, end_date,
                          notes, when_to_take, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [
                          medicationId,
                          schedule.frequency,
                          schedule.startDate,
                          schedule.endDate,
                          schedule.notes,
                          schedule.whenToTake
                        ],
                        function(err) {
                          if (err) {
                            console.error('Error creating schedule:', err);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                          }
                          
                          const scheduleId = this.lastID;
                          
                          // Insert times
                          if (schedule.times && schedule.times.length > 0) {
                            let completedTimes = 0;
                            
                            schedule.times.forEach(time => {
                              db.run(
                                'INSERT INTO medication_times (schedule_id, time_of_day, specific_time) VALUES (?, ?, ?)',
                                [scheduleId, time.timeOfDay, time.specificTime],
                                function(err) {
                                  if (err) {
                                    console.error('Error creating time:', err);
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                  }
                                  
                                  completedTimes++;
                                  
                                  // If all times are completed for this schedule
                                  if (completedTimes === schedule.times.length) {
                                    completedSchedules++;
                                    
                                    // If all schedules are completed
                                    if (completedSchedules === med.schedules.length) {
                                      // Commit transaction
                                      db.run('COMMIT', (err) => {
                                        if (err) {
                                          console.error('Error committing transaction:', err);
                                          db.run('ROLLBACK');
                                          reject(err);
                                        } else {
                                          console.log(`Medication created: ${med.name} (ID: ${medicationId})`);
                                          resolve(medicationId);
                                        }
                                      });
                                    }
                                  }
                                }
                              );
                            });
                          } else {
                            completedSchedules++;
                            
                            // If all schedules are completed
                            if (completedSchedules === med.schedules.length) {
                              // Commit transaction
                              db.run('COMMIT', (err) => {
                                if (err) {
                                  console.error('Error committing transaction:', err);
                                  db.run('ROLLBACK');
                                  reject(err);
                                } else {
                                  console.log(`Medication created: ${med.name} (ID: ${medicationId})`);
                                  resolve(medicationId);
                                }
                              });
                            }
                          }
                        }
                      );
                    });
                  } else {
                    // No schedules, commit transaction
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err);
                        db.run('ROLLBACK');
                        reject(err);
                      } else {
                        console.log(`Medication created: ${med.name} (ID: ${medicationId})`);
                        resolve(medicationId);
                      }
                    });
                  }
                }
              );
            } else {
              // No inventory
              // No schedules, commit transaction
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  db.run('ROLLBACK');
                  reject(err);
                } else {
                  console.log(`Medication created: ${med.name} (ID: ${medicationId})`);
                  resolve(medicationId);
                }
              });
            }
          }
        );
      });
    });
  }
  
  return medicationIds;
};

// Create reminders for multiple days (past, present, future)
const createReminders = async (userId, medicationIds) => {
  console.log(`Creating reminders for user ${userId}...`);

  const today = new Date();
  
  // Create dates for 5 days ago, 2 days ago, yesterday, today, tomorrow, 2 days from now, and 4 days from now
  const dates = [];
  for (let i = -5; i <= 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  console.log(`Creating reminders for dates: ${dates.join(', ')}`);
  
  const reminders = [
    // Yesterday
    {
      date: dates[4], // Yesterday
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'taken'
        },
        {
          medicationId: medicationIds[3], // Vitamin D
          status: 'taken'
        }
      ]
    },
    {
      date: dates[4], // Yesterday
      time: '14:00:00',
      title: 'Afternoon Medications',
      medications: [
        {
          medicationId: medicationIds[2], // Ventolin
          status: 'taken'
        }
      ]
    },
    {
      date: dates[4], // Yesterday
      time: '22:00:00',
      title: 'Night Medications',
      medications: [
        {
          medicationId: medicationIds[1], // Atorvastatin
          status: 'skipped'
        }
      ]
    },
    
    // Today
    {
      date: dates[5], // Today
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'taken'
        },
        {
          medicationId: medicationIds[3], // Vitamin D
          status: 'taken'
        }
      ]
    },
    {
      date: dates[5], // Today
      time: '14:00:00',
      title: 'Afternoon Medications',
      medications: [
        {
          medicationId: medicationIds[2], // Ventolin
          status: 'pending'
        }
      ]
    },
    {
      date: dates[5], // Today
      time: '20:00:00',
      title: 'Evening Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'pending'
        }
      ]
    },
    {
      date: dates[5], // Today
      time: '22:00:00',
      title: 'Night Medications',
      medications: [
        {
          medicationId: medicationIds[1], // Atorvastatin
          status: 'pending'
        }
      ]
    },
    
    // Tomorrow
    {
      date: dates[6], // Tomorrow
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'pending'
        },
        {
          medicationId: medicationIds[3], // Vitamin D
          status: 'pending'
        }
      ]
    },
    {
      date: dates[6], // Tomorrow
      time: '14:00:00',
      title: 'Afternoon Medications',
      medications: [
        {
          medicationId: medicationIds[2], // Ventolin
          status: 'pending'
        }
      ]
    },
    {
      date: dates[6], // Tomorrow
      time: '20:00:00',
      title: 'Evening Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'pending'
        }
      ]
    },
    
    // Days from past
    {
      date: dates[0], // 5 days ago
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'taken'
        },
        {
          medicationId: medicationIds[3], // Vitamin D
          status: 'skipped'
        }
      ]
    },
    {
      date: dates[2], // 3 days ago
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'taken'
        }
      ]
    },
    
    // Days in future
    {
      date: dates[8], // 3 days from now
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'pending'
        },
        {
          medicationId: medicationIds[3], // Vitamin D
          status: 'pending'
        }
      ]
    },
    {
      date: dates[10], // 5 days from now
      time: '08:00:00',
      title: 'Morning Medications',
      medications: [
        {
          medicationId: medicationIds[0], // Aspirin
          status: 'pending'
        }
      ]
    }
  ];
  
  for (const reminder of reminders) {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Insert reminder
        db.run(
          `INSERT INTO reminders (user_id, date, time, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userId, reminder.date, reminder.time, reminder.title],
          function(err) {
            if (err) {
              console.error('Error creating reminder:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const reminderId = this.lastID;
            
            // Insert reminder medications - fixed to match schema
            let completedMeds = 0;
            
            reminder.medications.forEach(med => {
              db.run(
                `INSERT INTO reminder_medications (reminder_id, medication_id, status)
                 VALUES (?, ?, ?)`,
                [reminderId, med.medicationId, med.status],
                function(err) {
                  if (err) {
                    console.error('Error creating reminder medication:', err);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  completedMeds++;
                  
                  // If all medications are completed for this reminder
                  if (completedMeds === reminder.medications.length) {
                    // Create history entry for taken medications
                    const takenMeds = reminder.medications.filter(m => m.status === 'taken');
                    
                    if (takenMeds.length > 0) {
                      let historiesCompleted = 0;
                      
                      takenMeds.forEach(med => {
                        db.run(
                          `INSERT INTO medication_history (user_id, medication_id, taken_date, taken_time, status,
                            notes, created_at)
                           VALUES (?, ?, ?, ?, 'taken', NULL, CURRENT_TIMESTAMP)`,
                          [userId, med.medicationId, reminder.date, reminder.time],
                          function(err) {
                            if (err) {
                              console.error('Error creating medication history:', err);
                              db.run('ROLLBACK');
                              reject(err);
                              return;
                            }
                            
                            historiesCompleted++;
                            
                            // If all histories are completed
                            if (historiesCompleted === takenMeds.length) {
                              // Commit transaction
                              db.run('COMMIT', (err) => {
                                if (err) {
                                  console.error('Error committing transaction:', err);
                                  db.run('ROLLBACK');
                                  reject(err);
                                } else {
                                  console.log(`Reminder created: ${reminder.date} ${reminder.time}`);
                                  resolve(reminderId);
                                }
                              });
                            }
                          }
                        );
                      });
                    } else {
                      // No taken medications, commit transaction
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('Error committing transaction:', err);
                          db.run('ROLLBACK');
                          reject(err);
                        } else {
                          console.log(`Reminder created: ${reminder.date} ${reminder.time}`);
                          resolve(reminderId);
                        }
                      });
                    }
                  }
                }
              );
            });
          }
        );
      });
    });
  }
};

// Create contacts between users
const createContacts = async (userIds) => {
  console.log('Creating contacts between users...');
  
  // Add user1 and user2 as friends
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO contacts (user_id, contact_user_id, contact_type, created_at, updated_at)
       VALUES (?, ?, 'friend', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userIds[0], userIds[1]],
      function(err) {
        if (err) {
          console.error('Error creating contact:', err);
          reject(err);
          return;
        }
        
        // Mirror relationship
        db.run(
          `INSERT INTO contacts (user_id, contact_user_id, contact_type, created_at, updated_at)
           VALUES (?, ?, 'friend', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userIds[1], userIds[0]],
          function(err) {
            if (err) {
              console.error('Error creating reciprocal contact:', err);
              reject(err);
              return;
            }
            
            console.log(`Contact established between users ${userIds[0]} and ${userIds[1]}`);
            resolve();
          }
        );
      }
    );
  });
  
  // Add user1 and doctor as friends
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO contacts (user_id, contact_user_id, contact_type, created_at, updated_at)
       VALUES (?, ?, 'doctor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userIds[0], userIds[2]],
      function(err) {
        if (err) {
          console.error('Error creating contact:', err);
          reject(err);
          return;
        }
        
        // Mirror relationship
        db.run(
          `INSERT INTO contacts (user_id, contact_user_id, contact_type, created_at, updated_at)
           VALUES (?, ?, 'patient', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userIds[2], userIds[0]],
          function(err) {
            if (err) {
              console.error('Error creating reciprocal contact:', err);
              reject(err);
              return;
            }
            
            console.log(`Doctor-patient relationship established between users ${userIds[2]} and ${userIds[0]}`);
            resolve();
          }
        );
      }
    );
  });
  
  // Create a pending friend request from user3 to user2
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO friend_requests (requester_id, recipient_id, status, created_at, updated_at)
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userIds[2], userIds[1]],
      function(err) {
        if (err) {
          console.error('Error creating friend request:', err);
          reject(err);
          return;
        }
        
        console.log(`Friend request created from user ${userIds[2]} to ${userIds[1]}`);
        resolve();
      }
    );
  });
};

// Create chat conversation and messages
const createChats = async (userIds) => {
  console.log('Creating chat conversations...');
  
  // Create a direct message conversation between user1 and user2
  let conv1Id;
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Insert conversation
      db.run(
        `INSERT INTO chat_conversations (is_group_chat, conversation_name, created_by, created_at, updated_at)
         VALUES (0, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userIds[0]],
        function(err) {
          if (err) {
            console.error('Error creating conversation:', err);
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          conv1Id = this.lastID;
          
          // Add participants
          db.run(
            `INSERT INTO chat_participants (conversation_id, user_id, joined_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [conv1Id, userIds[0]],
            function(err) {
              if (err) {
                console.error('Error adding participant:', err);
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              db.run(
                `INSERT INTO chat_participants (conversation_id, user_id, joined_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [conv1Id, userIds[1]],
                function(err) {
                  if (err) {
                    console.error('Error adding participant:', err);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Error committing transaction:', err);
                      db.run('ROLLBACK');
                      reject(err);
                    } else {
                      console.log(`Chat conversation ${conv1Id} created between users ${userIds[0]} and ${userIds[1]}`);
                      resolve(conv1Id);
                    }
                  });
                }
              );
            }
          );
        }
      );
    });
  });
  
  // Add some messages to the conversation
  const messages = [
    {
      sender: userIds[0],
      text: 'Merhaba! Nasılsın?',
      sentAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    },
    {
      sender: userIds[1],
      text: 'İyiyim, teşekkürler! Sen nasılsın?',
      sentAt: new Date(Date.now() - 86300000).toISOString() // 23 hours, 58 minutes ago
    },
    {
      sender: userIds[0],
      text: 'Ben de iyiyim. Yeni ilaçlarımı kullanmaya başladım, şimdilik bir yan etki görmedim.',
      sentAt: new Date(Date.now() - 86000000).toISOString() // 23 hours, 53 minutes ago
    },
    {
      sender: userIds[1],
      text: 'Harika! Hatırlatıcıları ayarladın mı?',
      sentAt: new Date(Date.now() - 85700000).toISOString() // 23 hours, 48 minutes ago
    },
    {
      sender: userIds[0],
      text: 'Evet, ayarladım. Bu uygulama gerçekten çok kullanışlı!',
      sentAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    }
  ];
  
  for (const message of messages) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO chat_messages (conversation_id, sender_id, message_text, sent_at, has_attachments)
         VALUES (?, ?, ?, ?, 0)`,
        [conv1Id, message.sender, message.text, message.sentAt],
        function(err) {
          if (err) {
            console.error('Error creating message:', err);
            reject(err);
            return;
          }
          
          const messageId = this.lastID;
          
          // Mark as read by sender
          db.run(
            `INSERT INTO message_read_status (message_id, user_id, read_at)
             VALUES (?, ?, ?)`,
            [messageId, message.sender, message.sentAt],
            function(err) {
              if (err) {
                console.error('Error marking message as read:', err);
                reject(err);
                return;
              }
              
              // For the last message, don't mark as read by recipient
              if (message === messages[messages.length - 1] && message.sender === userIds[0]) {
                console.log(`Message ${messageId} created (unread by recipient)`);
                resolve(messageId);
                return;
              }
              
              // Mark as read by recipient
              const recipientId = message.sender === userIds[0] ? userIds[1] : userIds[0];
              db.run(
                `INSERT INTO message_read_status (message_id, user_id, read_at)
                 VALUES (?, ?, ?)`,
                [messageId, recipientId, new Date(new Date(message.sentAt).getTime() + 60000).toISOString()], // Read 1 minute later
                function(err) {
                  if (err) {
                    console.error('Error marking message as read by recipient:', err);
                    reject(err);
                    return;
                  }
                  
                  console.log(`Message ${messageId} created and marked as read`);
                  resolve(messageId);
                }
              );
            }
          );
        }
      );
    });
  }
  
  // Create a direct message conversation between user1 and doctor
  let conv2Id;
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Insert conversation
      db.run(
        `INSERT INTO chat_conversations (is_group_chat, conversation_name, created_by, created_at, updated_at)
         VALUES (0, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userIds[0]],
        function(err) {
          if (err) {
            console.error('Error creating conversation:', err);
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          conv2Id = this.lastID;
          
          // Add participants
          db.run(
            `INSERT INTO chat_participants (conversation_id, user_id, joined_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [conv2Id, userIds[0]],
            function(err) {
              if (err) {
                console.error('Error adding participant:', err);
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              db.run(
                `INSERT INTO chat_participants (conversation_id, user_id, joined_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [conv2Id, userIds[2]],
                function(err) {
                  if (err) {
                    console.error('Error adding participant:', err);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Error committing transaction:', err);
                      db.run('ROLLBACK');
                      reject(err);
                    } else {
                      console.log(`Chat conversation ${conv2Id} created between user ${userIds[0]} and doctor ${userIds[2]}`);
                      resolve(conv2Id);
                    }
                  });
                }
              );
            }
          );
        }
      );
    });
  });
  
  // Add some messages to the doctor conversation
  const doctorMessages = [
    {
      sender: userIds[0],
      text: 'Merhaba Doktor Bey, son kontrol sonuçlarım hakkında konuşabilir miyiz?',
      sentAt: new Date(Date.now() - 259200000).toISOString() // 3 days ago
    },
    {
      sender: userIds[2],
      text: 'Merhaba, tabii ki. Kolesterol değerleriniz normal seviyede görünüyor. İlaçlarınızı düzenli kullanmaya devam edin.',
      sentAt: new Date(Date.now() - 258000000).toISOString() // ~2 days, 23 hours ago
    },
    {
      sender: userIds[0],
      text: 'Teşekkür ederim. Aspirin dozumu azaltabilir miyim?',
      sentAt: new Date(Date.now() - 257000000).toISOString() // ~2 days, 23 hours ago
    },
    {
      sender: userIds[2],
      text: 'Şimdilik mevcut dozda devam etmenizi öneririm. Bir sonraki kontrolde tekrar değerlendireceğiz.',
      sentAt: new Date(Date.now() - 256000000).toISOString() // ~2 days, 23 hours ago
    }
  ];
  
  for (const message of doctorMessages) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO chat_messages (conversation_id, sender_id, message_text, sent_at, has_attachments)
         VALUES (?, ?, ?, ?, 0)`,
        [conv2Id, message.sender, message.text, message.sentAt],
        function(err) {
          if (err) {
            console.error('Error creating message:', err);
            reject(err);
            return;
          }
          
          const messageId = this.lastID;
          
          // Mark as read by sender
          db.run(
            `INSERT INTO message_read_status (message_id, user_id, read_at)
             VALUES (?, ?, ?)`,
            [messageId, message.sender, message.sentAt],
            function(err) {
              if (err) {
                console.error('Error marking message as read:', err);
                reject(err);
                return;
              }
              
              // Mark as read by recipient
              const recipientId = message.sender === userIds[0] ? userIds[2] : userIds[0];
              db.run(
                `INSERT INTO message_read_status (message_id, user_id, read_at)
                 VALUES (?, ?, ?)`,
                [messageId, recipientId, new Date(new Date(message.sentAt).getTime() + 120000).toISOString()], // Read 2 minutes later
                function(err) {
                  if (err) {
                    console.error('Error marking message as read by recipient:', err);
                    reject(err);
                    return;
                  }
                  
                  console.log(`Doctor message ${messageId} created and marked as read`);
                  resolve(messageId);
                }
              );
            }
          );
        }
      );
    });
  }
};

// Main function to seed the database
const seedDatabase = async () => {
  try {
    // Clear existing data
    await clearDatabase();
    
    // Create users
    const userIds = await createUsers();
    
    // Create medications for the first user
    const medicationIds = await createMedications(userIds[0]);
    
    // Create reminders for the first user
    await createReminders(userIds[0], medicationIds);
    
    // Create contacts
    await createContacts(userIds);
    
    // Create chats
    await createChats(userIds);
    
    console.log('Database seeding completed successfully!');
    console.log('Sample Users:');
    console.log('- test@example.com / password123 (main test user)');
    console.log('- jane@example.com / password123');
    console.log('- doctor@example.com / password123');
    
    // Close database connection
    db.close();
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Execute the seed function
seedDatabase();
