// API Services for MediMates App

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeEventEmitter, NativeModules, Platform, DeviceEventEmitter } from 'react-native';

// Custom event emitter for React Native
if (!global.EventEmitter) {
  // Simple EventEmitter implementation compatible with React Native
  class SimpleEventEmitter {
    constructor() {
      this.listeners = {};
    }
    
    addListener(eventName, callback) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }
      this.listeners[eventName].push(callback);
      // Return an object that mimics the EventEmitter subscription
      return {
        remove: () => {
          this.removeListener(eventName, callback);
        }
      };
    }
    
    removeListener(eventName, callback) {
      if (this.listeners[eventName]) {
        this.listeners[eventName] = this.listeners[eventName]
          .filter(listener => listener !== callback);
      }
    }
    
    emit(eventName, data) {
      if (this.listeners[eventName]) {
        this.listeners[eventName].forEach(callback => {
          callback(data);
        });
      }
    }
  }
  
  global.EventEmitter = new SimpleEventEmitter();
}

// API URL Configuration
// Change this if your backend server address has changed
// For Android emulator, use 10.0.2.2:3000
// For iOS simulator, use localhost:3000
// For physical devices, use your computer's actual LAN IP address on the network
//const API_URL = 'http://localhost:3000/api';  // Try this first
// const API_URL = 'http://10.0.2.2:3000/api';  // Uncomment for Android emulator
const API_URL = 'http://192.168.1.199:3000/api';  // Uncomment and set your PC's IP

console.log(`Using API URL: ${API_URL}`);

// Export API_URL for use in other files
export { API_URL };

/**
 * Test if the API server is reachable
 * @returns {Promise<boolean>} True if server is reachable
 */
export const isServerReachable = async () => {
  try {
    console.log(`Testing server reachability at ${API_URL}`);
    
    // First try direct ping to check basic network connectivity
    const hostReachable = await pingServerHost();
    if (!hostReachable) {
      console.log('Host ping failed - likely network connectivity issue');
      return false;
    }
    
    console.log('Host ping succeeded, checking API endpoints');
    console.log('Chat route fixed, the error with cc.conversation_name has been resolved');
      // Use a timeout to avoid hanging for too long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Increase timeout to 8 seconds
    
    // Since we need to determine if the server is running, even if
    // API endpoints return 404, we'll try multiple approaches    // Try several potential endpoints that might exist on the backend
    // Looking for any non-404 response, or a 200 response from the root
    const endpoints = [
      '/chats', 
      '/conversations', 
      '/auth/status', 
      '/health', 
      '/users', 
      '/medications',
      '/'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await fetch(`${API_URL}${endpoint}`, { 
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store', // Don't use cached results
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        console.log(`Endpoint ${endpoint} response status: ${response.status}`);
        
        // Any response (even 401 Unauthorized) means server is up
        // Only 404 would mean endpoint doesn't exist
        if (response.status !== 404) {
          console.log(`Server is up! Found working endpoint: ${endpoint}`);
          return true;
        }
      } catch (endpointError) {
        console.log(`Endpoint ${endpoint} check failed: ${endpointError.message}`);
        // Continue to the next endpoint
      }
    }
      // If API endpoints all return 404, check if we can reach the root server
    // Since we know from logs that the server itself is up
    console.log('All API endpoints failed with 404, checking server root path');
    
    // Extract the base URL without the /api path
    const urlObj = new URL(API_URL);
    const serverRoot = urlObj.origin; // Just protocol + hostname + port
    
    try {
      // Try the server root path
      const rootResponse = await fetch(`${serverRoot}/`, { 
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store', // Don't use cached results
      });
      
      clearTimeout(timeoutId);
      console.log(`Server root response status: ${rootResponse.status}`);
      
      // If the server root responds with a 200 OK status, the server is running
      if (rootResponse.status === 200) {
        console.log('Server is up, but API paths return 404 - likely API path misconfiguration');
        // Return true because server is reachable, even though API paths may be misconfigured
        return true;
      }
      
      // Even if not 200 but not 404, server is still running something
      if (rootResponse.status !== 404) {
        console.log('Server is responding, but with unexpected status:', rootResponse.status);
        return true;
      }
    } catch (rootError) {
      console.log(`Server root check failed: ${rootError.message}`);
    }
    
    // If we got here, none of the endpoints worked
    console.log('All endpoints failed, but host was reachable - likely API path issue');
    return false;
    
  } catch (error) {
    console.error('Server reachability check completely failed:', error.message);
    // Log more detailed error information
    if (error.name === 'AbortError') {
      console.error('Request timed out after 5 seconds');
    } else if (error.message.includes('Network request failed')) {
      console.error('Network connectivity issues detected');
    }
    return false;
  }
};

/**
 * Directly ping the server hostname (without path) to check network connectivity
 * @returns {Promise<boolean>}
 */
export const pingServerHost = async () => {
  try {
    console.log('Pinging server host directly');
    
    // Extract hostname from API_URL
    const urlObj = new URL(API_URL);
    const hostname = urlObj.origin; // Just protocol + hostname + port
    
    console.log(`Extracted hostname: ${hostname}`);
    
    // Use a timeout to avoid hanging
    const controller = new AbortController();    const timeoutId = setTimeout(() => controller.abort(), 8000); // Increase timeout to 8 seconds
    
    try {
      // This is just a connection test, we're not interested in the response data
      const response = await fetch(hostname, { 
        method: 'HEAD', // Just request headers, not content
        signal: controller.signal,
        cache: 'no-store', // Don't use cached results
        mode: 'no-cors' // This allows connections even if CORS is not configured
      });
      clearTimeout(timeoutId);
      
      // With no-cors mode, we can't actually read the status
      // but reaching this point means network connectivity exists
      console.log('Server host ping successful, network path exists');
      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Server host ping failed:', error.message);
      return false;
    }
  } catch (error) {
    console.error('Error during server ping:', error.message);
    return false;
  }
};

/**
 * Base API Request function
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object} data - Request body
 * @param {string} token - Auth token
 * @returns {Promise} - Response from the API
 */
export const apiRequest = async (endpoint, method = 'GET', data = null, token = null) => {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };    // Check if token is malformed and endpoint is not auth-related
    if (token) {
      // Basic validation for JWT format (3 parts separated by dots)
      const parts = token.split('.');
      if (parts.length !== 3 && !endpoint.includes('/auth/')) {
        console.warn('JWT token appears malformed. Attempting to refresh...');
        
        try {
          // Try to get a fresh token from storage
          const storedToken = await AsyncStorage.getItem('userToken');
          if (storedToken && storedToken !== token) {
            console.log('Using stored token instead');
            token = storedToken;
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          // Continue with the original token as a fallback
        }
      }
      
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,      headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    console.log(`Making API request to: ${API_URL}${endpoint}`);
    
  // Add timeout to fetch - increased to 20 seconds for better reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased timeout
    config.signal = controller.signal;
    
    const response = await fetch(`${API_URL}${endpoint}`, config);
    clearTimeout(timeoutId); // Clear timeout if successful
      // Handle unauthorized (token expired) responses
    if (response.status === 401 && token && !endpoint.includes('/auth/refresh-token')) {
      console.log('Token expired, attempting refresh...');      try {
        // We need to be careful here to avoid circular references
        // Get the current token from storage
        const currentToken = await AsyncStorage.getItem('userToken');
        
        if (!currentToken) {
          throw new Error('No token available to refresh');
        }
        
        // Call refresh token endpoint directly to avoid circular reference
        const refreshResponse = await fetch(`${API_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          }
        });
        
        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh token');
        }
        
        const refreshData = await refreshResponse.json();
        if (!refreshData.details || !refreshData.details.token) {
          throw new Error('Invalid refresh response');
        }
        
        const newToken = refreshData.details.token;
        await AsyncStorage.setItem('userToken', newToken);
        
        if (newToken) {
          // Retry the request with the new token
          console.log('Retrying request with new token');
          headers['Authorization'] = `Bearer ${newToken}`;
          config.headers = headers;
          
          const retryResponse = await fetch(`${API_URL}${endpoint}`, config);
          
          // Handle retry response
          const retryContentType = retryResponse.headers.get('content-type');
          if (retryContentType && retryContentType.includes('application/json')) {
            const retryResult = await retryResponse.json();
            if (!retryResponse.ok) {
              console.error('API Error after token refresh:', retryResult);
              throw new Error(retryResult.message || 'Request failed after token refresh');
            }
            return retryResult;
          } else if (!retryResponse.ok) {
            const text = await retryResponse.text();
            console.error('Non-JSON API Error after token refresh:', text);
            throw new Error(text || 'Request failed after token refresh');
          }
          return { success: true };
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        throw new Error('Session expired. Please login again.');
      }
    }
    
    // Handle regular responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', result);
        throw new Error(result.message || 'Something went wrong');
      }
      
      return result;
    } else {
      // Handle non-JSON response (e.g., plain text error)
      if (!response.ok) {
        const text = await response.text();
        console.error('Non-JSON API Error:', text);
        throw new Error(text || 'Something went wrong with the request');
      }
      
      return { success: true };
    }} catch (error) {
    console.error('API Error:', error);
    
    // Different error handling based on error type
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    } else if (error.message === 'Network request failed') {
      throw new Error('Network connection failed. Please check your internet connection.');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('Unable to reach the server. Please verify that the server is running.');
    }
    
    // Default error
    throw error;
  }
};

/**
 * Authentication Services
 */
export const AuthService = {
  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} - User data and token
   */
  login: async (email, password) => {
    try {
      const response = await apiRequest('/auth/login', 'POST', { email, password });
      
      // Save tokens in AsyncStorage for future use
      if (response && response.token) {
        await AsyncStorage.setItem('userToken', response.token);
        if (response.refreshToken) {
          await AsyncStorage.setItem('refreshToken', response.refreshToken);
        }
        
        // Validate token structure
        const parts = response.token.split('.');
        if (parts.length !== 3) {
          console.warn('Received malformed JWT token from server');
        }
      }
      
      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  /**
   * Register new user
   * @param {string} name - User name
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} - User data
   */
  register: async (name, email, password) => {
    try {
      const response = await apiRequest('/auth/register', 'POST', { name, email, password });
      
      // Save tokens in AsyncStorage for future use if registration includes auto-login
      if (response && response.token) {
        await AsyncStorage.setItem('userToken', response.token);
        if (response.refreshToken) {
          await AsyncStorage.setItem('refreshToken', response.refreshToken);
        }
      }
      
      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  /**
   * Logout user
   * @param {string} token - Auth token
   * @returns {Promise}
   */
  logout: async (token) => {
    try {
      // Call logout endpoint
      const response = await apiRequest('/auth/logout', 'POST', {}, token);
      
      // Clear stored tokens regardless of API response
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('refreshToken');
      
      return response;
    } catch (error) {
      // Still clear tokens on error
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('refreshToken');
      
      console.error('Logout error:', error);
      return { success: true, message: 'Logged out locally' }; // Return success anyway
    }
  },
  
  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} - Whether user has valid auth
   */
  isAuthenticated: async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return false;
      
      // Check if token is valid JWT format
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Optional: Verify token hasn't expired (if token contains expiry)
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          console.log('Token expired');
          return false;
        }
      } catch (e) {
        console.warn('Could not parse token payload:', e);
      }
      
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  },
  
  /**
   * Get stored token
   * @returns {Promise<string|null>} - Stored auth token or null
   */
  getToken: async () => {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }
};

/**
 * User Services
 */
export const UserService = {
  /**
   * Get user profile
   * @param {string} token - Auth token
   * @returns {Promise} - User profile data
   */
  getProfile: (token) => {
    return apiRequest('/users/profile', 'GET', null, token);
  },

  /**
   * Update user profile
   * @param {string} token - Auth token
   * @param {object} profileData - Updated profile data
   * @returns {Promise} - Updated profile data
   */
  updateProfile: (token, profileData) => {
    return apiRequest('/users/profile', 'PUT', profileData, token);
  },

  /**
   * Upload profile picture
   * @param {string} token - Auth token
   * @param {object} formData - FormData with profile picture
   * @returns {Promise} - Response with updated profile picture URL
   */
  uploadProfilePicture: async (token, imageUri) => {
    try {
      // Create form data for image upload
      const formData = new FormData();

      // Get filename from uri
      const uriParts = imageUri.split('/');
      const fileName = uriParts[uriParts.length - 1];

      formData.append('profilePicture', {
        uri: imageUri,
        name: fileName,
        type: 'image/jpeg'  // Adjust based on your image type
      });

      const headers = {
        'Authorization': `Bearer ${token}`
      };

      // Don't set Content-Type, let fetch set it with the boundary
      const response = await fetch(`${API_URL}/users/upload-profile-picture`, {
        method: 'POST',
        headers,
        body: formData
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', result);
        throw new Error(result.message || 'Failed to upload profile picture');
      }
      
      return result;
    } catch (error) {
      console.error('Profile picture upload error:', error);
      throw error;
    }
  },

  /**
   * Check if a username is available
   * @param {string} token - Auth token
   * @param {string} username - Username to check
   * @returns {Promise} - Response with availability status
   */  checkUsername: (token, username) => {
    // Fall back to query parameter style if needed
    return apiRequest(`/users/check-username?username=${encodeURIComponent(username)}`, 'GET', null, token)
      .then(response => {
        // Handle successful response
        if (response && response.success) {
          return {
            success: true,
            isAvailable: response.details.available,
            message: response.details.message
          };
        } else {
          console.warn('Unexpected response format:', response);
          return { 
            success: false, 
            error: 'Invalid response format',
            isAvailable: false
          };
        }
      })
      .catch(error => {
        console.error('Error checking username availability:', error);
        
        // Special handling for "User not found" - this might be returned when checking availability
        // In this context, it could mean the username is available
        if (error.message === 'User not found') {
          return { 
            success: true, 
            isAvailable: true,
            message: 'Username is available'
          };
        }
        
        return { 
          success: false, 
          error: error.message || 'Failed to check username availability',
          isAvailable: false
        };
      });
  },

  /**
   * Update user username
   * @param {string} token - Auth token
   * @param {string} username - New username
   * @returns {Promise} - Updated user data
   */
  updateUsername: (token, username) => {
    return apiRequest('/users/update-username', 'PUT', { username }, token)
      .catch(error => {
        console.error('Error updating username:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to update username'
        };
      });
  }
};

/**
 * Medication Services
 */
export const MedicationService = {
  /**
   * Get all medications for current user
   * @param {string} token - Auth token
   * @returns {Promise} - List of medications
   */  getMedications: (token) => {
    return apiRequest('/medications', 'GET', null, token)
      .catch(error => {
        console.error('Error in getMedications:', error);
        // Return a structured error response for better handling
        return { 
          success: false, 
          error: error.message || 'Failed to fetch medications', 
          data: { medications: [] } 
        };
      });
  },
  
  /**
   * Get a specific medication by ID
   * @param {string} token - Auth token
   * @param {string} medicationId - Medication ID
   * @returns {Promise} - Medication details
   */
  getMedicationById: (token, medicationId) => {
    return apiRequest(`/medications/${medicationId}`, 'GET', null, token);
  },
    /**
   * Add a new medication
   * @param {string} token - Auth token
   * @param {object} medicationData - Medication data
   * @returns {Promise} - New medication
   */
  addMedication: (token, medicationData) => {
    return apiRequest('/medications', 'POST', medicationData, token)
      .catch(error => {
        console.error('Error in addMedication:', error);
        // Return a structured error response for better handling
        return { 
          success: false, 
          error: error.message || 'Failed to add medication', 
          data: null 
        };
      });
  },
  
  /**
   * Add a simplified medication with minimal fields (fallback for compatibility)
   * @param {string} token - Auth token
   * @param {object} medicationData - Basic medication data (at minimum just name)
   * @returns {Promise} - New medication
   */
  addSimpleMedication: (token, medicationData) => {
    return apiRequest('/medications/simple', 'POST', medicationData, token)
      .catch(error => {
        console.error('Error in addSimpleMedication:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to add simple medication', 
          data: null 
        };
      });
  },
  
  /**
   * Update a medication
   * @param {string} token - Auth token
   * @param {string} medicationId - Medication ID
   * @param {object} medicationData - Updated medication data
   * @returns {Promise} - Updated medication
   */  updateMedication: (token, medicationId, medicationData) => {
    console.log(`Updating medication ${medicationId} with data:`, JSON.stringify(medicationData));
    
    // Create a clean copy to avoid modifying the original
    const formattedData = { ...medicationData };
    
    // Ensure date fields are properly formatted as strings
    if (formattedData.start_date) {
      try {
        // If it's already a string in the right format, keep it
        if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedData.start_date)) {
          const date = new Date(formattedData.start_date);
          formattedData.start_date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        console.log(`API formatted start_date: ${formattedData.start_date}`);
      } catch (e) {
        console.error('Error formatting start_date:', e);
      }
    }
    
    if (formattedData.end_date) {
      try {
        // If it's already a string in the right format, keep it
        if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedData.end_date)) {
          const date = new Date(formattedData.end_date);
          formattedData.end_date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        console.log(`API formatted end_date: ${formattedData.end_date}`);
      } catch (e) {
        console.error('Error formatting end_date:', e);
      }
    }
    
    return apiRequest(`/medications/${medicationId}`, 'PUT', formattedData, token)
      .then(response => {
        console.log('Update medication successful response:', JSON.stringify(response));
        // If the response doesn't have an explicit success field but has data, consider it successful
        if (response && !response.success && !response.error) {
          return { 
            ...response,
            success: true 
          };
        }
        return response;
      })
      .catch(error => {
        console.error('Error in updateMedication:', error);
        // Return a structured error response for better handling
        return { 
          success: false, 
          error: error.message || 'Failed to update medication', 
          data: null 
        };
      });
  },
  
  /**
   * Delete a medication
   * @param {string} token - Auth token
   * @param {string} medicationId - Medication ID
   * @returns {Promise}
   */
  deleteMedication: (token, medicationId) => {
    return apiRequest(`/medications/${medicationId}`, 'DELETE', null, token);
  }
};

/**
 * Reminder Services
 */
export const ReminderService = {
  /**
   * Create a reminder for medication
   * @param {string} token - Auth token
   * @param {object} reminderData - Reminder data object
   * @returns {Promise} - Created reminder
   */
  createReminder: (token, reminderData) => {
    console.log(`Creating reminder with data:`, JSON.stringify(reminderData));
    return apiRequest('/reminders', 'POST', reminderData, token)
      .catch(error => {
        console.error('Error creating reminder:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to create reminder', 
          data: null 
        };
      });
  },

  /**
   * Get all reminders
   * @param {string} token - Auth token
   * @param {string} date - Optional date filter (YYYY-MM-DD)
   * @param {string} status - Optional status filter (pending, taken, skipped)
   * @returns {Promise} - List of reminders
   */
  getReminders: (token, date = null, status = null) => {
    let endpoint = '/reminders';
    
    // Add query parameters if provided
    const params = [];
    if (date) params.push(`date=${date}`);
    if (status) params.push(`status=${status}`);
    
    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }
    
    console.log(`Fetching reminders from endpoint: ${endpoint}`);
    return apiRequest(endpoint, 'GET', null, token)
      .catch(error => {
        console.error('Error in getReminders:', error);
        // Return a structured error response for better handling
        return { 
          success: false, 
          error: error.message || 'Failed to fetch reminders', 
          data: { reminders: [] } 
        };
      });
  },
    /**
   * Get reminders by date
   * @param {string} token - Auth token
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise} - List of reminders for the specified date with linked medications
   */
  getRemindersByDate: (token, date) => {
    console.log(`Fetching reminders for date: ${date}`);
    // Endpoint güncellendi - Veritabanındaki reminder_medications tablosunu da içerecek şekilde
    return apiRequest(`/reminders?date=${date}&include_medications=true`, 'GET', null, token)
      .catch(error => {
        console.error(`Error fetching reminders for date ${date}:`, error);
        // Return a structured error response for better handling
        return { 
          success: false, 
          error: error.message || 'Failed to fetch reminders', 
          data: { reminders: [] } 
        };
      });
  },
    /**
   * Mark a reminder as taken
   * @param {string} token - Auth token
   * @param {string} reminderMedId - Reminder medication ID
   * @returns {Promise} - Updated reminder
   */  markAsTaken: (token, reminderMedId) => {
    if (reminderMedId === null || reminderMedId === undefined) {
      console.error('Missing reminderMedId in markAsTaken');
      return Promise.resolve({
        success: false,
        error: 'Missing medication identifier'
      });
    }
    
    // Convert to string if it's a number
    const reminderMedIdStr = reminderMedId.toString();
    
    console.log(`Marking medication ${reminderMedIdStr} as taken`);
    return apiRequest(`/reminders/medications/${reminderMedIdStr}/taken`, 'PUT', null, token)
      .catch(error => {
        console.error(`Error marking medication ${reminderMedIdStr} as taken:`, error);
        return { 
          success: false, 
          error: error.message || 'Failed to mark medication as taken' 
        };
      });
  },
  
  /**
   * Mark a reminder as skipped
   * @param {string} token - Auth token
   * @param {string} reminderMedId - Reminder medication ID
   * @returns {Promise} - Updated reminder
   */  markAsSkipped: (token, reminderMedId) => {
    if (reminderMedId === null || reminderMedId === undefined) {
      console.error('Missing reminderMedId in markAsSkipped');
      return Promise.resolve({
        success: false,
        error: 'Missing medication identifier'
      });
    }
    
    // Convert to string if it's a number
    const reminderMedIdStr = reminderMedId.toString();
    
    console.log(`Marking medication ${reminderMedIdStr} as skipped`);
    return apiRequest(`/reminders/medications/${reminderMedIdStr}/skipped`, 'PUT', null, token)
      .catch(error => {
        console.error(`Error marking medication ${reminderMedIdStr} as skipped:`, error);
        return { 
          success: false, 
          error: error.message || 'Failed to mark medication as skipped' 
        };
      });
  },
    /**
   * Reset a medication status to pending
   * @param {string} token - Auth token
   * @param {string} reminderMedId - Reminder medication ID
   * @returns {Promise} - Updated reminder
   */  resetMedicationStatus: (token, reminderMedId) => {
    if (reminderMedId === null || reminderMedId === undefined) {
      console.error('Missing reminderMedId in resetMedicationStatus');
      return Promise.resolve({
        success: false,
        error: 'Missing medication identifier'
      });
    }
    
    // Convert to string if it's a number
    const reminderMedIdStr = reminderMedId.toString();
    
    console.log(`Resetting medication ${reminderMedIdStr} status to pending`);
    return apiRequest(`/reminders/medications/${reminderMedIdStr}/reset`, 'PUT', null, token)
      .catch(error => {
        console.error(`Error resetting medication ${reminderMedIdStr} status:`, error);
        return { 
          success: false, 
          error: error.message || 'Failed to reset medication status' 
        };
      });
  },
  
  /**
   * Debug reminders - get debug information about reminders
   * @param {string} token - Auth token
   * @returns {Promise} - Debug information
   */
  debugReminders: (token) => {
    console.log('Getting reminder debug information');
    return apiRequest('/reminders/debug', 'GET', null, token)
      .catch(error => {
        console.error('Error in debugReminders:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to debug reminders', 
          data: null
        };
      });
  },
};

/**
 * Contact Services
 */
export const ContactService = {
  /**
   * Get all contacts for the current user
   * @param {string} token - Auth token
   * @returns {Promise} - List of contacts
   */
  getContacts: (token) => {
    return apiRequest('/contacts', 'GET', null, token)
      .catch(error => {
        console.error('Error fetching contacts:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to fetch contacts', 
          data: [] 
        };
      });
  },

  /**
   * Get friend requests for the current user
   * @param {string} token - Auth token
   * @returns {Promise} - List of sent and received friend requests
   */
  getFriendRequests: (token) => {
    return apiRequest('/contacts/friend-requests', 'GET', null, token)
      .catch(error => {
        console.error('Error fetching friend requests:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to fetch friend requests', 
          data: { sent: [], received: [] } 
        };
      });
  },

  /**
   * Accept a friend request
   * @param {string} token - Auth token
   * @param {string} requestId - Friend request ID
   * @returns {Promise} - Success message
   */
  acceptFriendRequest: (token, requestId) => {
    return apiRequest(`/contacts/friend-requests/${requestId}/accept`, 'PUT', null, token)
      .catch(error => {
        console.error('Error accepting friend request:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to accept friend request' 
        };
      });
  },

  /**
   * Reject a friend request
   * @param {string} token - Auth token
   * @param {string} requestId - Friend request ID
   * @returns {Promise} - Success message
   */
  rejectFriendRequest: (token, requestId) => {
    return apiRequest(`/contacts/friend-requests/${requestId}/reject`, 'PUT', null, token)
      .catch(error => {
        console.error('Error rejecting friend request:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to reject friend request' 
        };
      });
  },

  /**
   * Cancel a sent friend request
   * @param {string} token - Auth token
   * @param {string} requestId - Friend request ID
   * @returns {Promise} - Success message
   */
  cancelFriendRequest: (token, requestId) => {
    return apiRequest(`/contacts/friend-requests/${requestId}`, 'DELETE', null, token)
      .catch(error => {
        console.error('Error cancelling friend request:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to cancel friend request' 
        };
      });
  },
  /**
   * Search for users by name, email, or username
   * @param {string} token - Auth token
   * @param {string} query - Search query
   * @param {string} searchType - Type of search (name, email, username, medication)
   * @returns {Promise} - List of users
   */
  searchUsers: (token, query, searchType = 'username') => {
    // Map the search type to the correct parameter name
    const paramName = ['email', 'name', 'username', 'medication'].includes(searchType) ? searchType : 'username';
    
    // Build the URL with the correct parameter format
    const url = `/users/search?${paramName}=${encodeURIComponent(query)}`;
    
    return apiRequest(url, 'GET', null, token)
      .catch(error => {
        console.error('Error searching users:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to search users', 
          data: [] 
        };
      });
  },

  /**
   * Add a user as a contact (send friend request)
   * @param {string} token - Auth token
   * @param {string} userId - User ID to add as contact
   * @param {string} type - Type of contact (default: 'friend')
   * @returns {Promise} - Added contact or friend request info
   */
  addContact: (token, userId, type = 'friend') => {
    return apiRequest('/contacts', 'POST', { userId, type }, token)
      .catch(error => {
        console.error('Error adding contact:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to add contact' 
        };
      });
  },

  /**
   * Delete a contact
   * @param {string} token - Auth token
   * @param {string} contactId - Contact ID
   * @returns {Promise} - Success message
   */
  deleteContact: (token, contactId) => {
    return apiRequest(`/contacts/${contactId}`, 'DELETE', null, token)
      .catch(error => {
        console.error('Error deleting contact:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to delete contact' 
        };
      });
  }
};

/**
 * Chat Services
 */
export const ChatService = {  /**
   * Check and refresh token if needed before making chat requests
   * @param {string} token - Auth token
   * @returns {Promise<string>} - Valid token or throws error
   */
  _validateToken: async (token) => {
    if (!token) {
      console.error('Missing auth token');
      throw new Error('Authentication required');
    }
    
    // Basic validation for JWT format (3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Token format is invalid (malformed JWT). Attempting to auto-login...');
      
      try {
        // Try to get a valid token from storage
        const storedToken = await AsyncStorage.getItem('userToken');
        
        if (storedToken && storedToken !== token && storedToken.split('.').length === 3) {
          console.log('Using valid stored token instead of provided malformed token');
          return storedToken;
        }

        // If we can't find a valid token, try to refresh
        try {
          const refreshedToken = await ChatService.refreshToken();
          if (refreshedToken) {
            console.log('Successfully refreshed token');
            return refreshedToken;
          }
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError);
        }
        
        // Redirect to auth screen for re-authentication
        console.warn('Auto-login failed, user must re-authenticate');
        
        // Publish event to notify app about authentication failure
        if (global.EventEmitter) {
          global.EventEmitter.emit('authError', { 
            message: 'Your session has expired. Please login again.' 
          });
        }
        
        throw new Error('Authentication expired');
      } catch (error) {
        console.error('Auto-login failed:', error);
        throw new Error('Authentication expired. Please log in again.');
      }
    }
    
    return token;
  },
    /**
   * Get all conversations for current user
   * @param {string} token - Auth token
   * @param {boolean} useFallback - Whether to use fallback data when API fails
   * @returns {Promise} - List of conversations
   */  getConversations: async (token, useFallback = false) => {
    try {
      // Check if token exists
      if (!token) {
        const storedToken = await AsyncStorage.getItem('userToken');
        if (!storedToken) {
          throw new Error('Authentication required');
        }
        token = storedToken;
      }
      
      // Try to validate/refresh token
      try {
        token = await ChatService._validateToken(token);
      } catch (tokenError) {
        console.warn('Token validation failed:', tokenError.message);
        throw tokenError;
      }
      
      try {
        // Make API request with valid token with a specific timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await apiRequest('/chats', 'GET', null, token);
        clearTimeout(timeoutId);
        
        // If API response is successful but empty, might be new user with no chats
        if (response && response.success && (!response.conversations && !response.data)) {
          console.log('API returned empty conversations list');
        }
        
        return response;
      } catch (apiError) {
        console.error('API request failed:', apiError.message);
        
        // Check if it's a connection error
        if (apiError.message.includes('Unable to reach') || 
            apiError.message.includes('Network request failed') ||
            apiError.message.includes('timed out')) {
          return { 
            success: false, 
            error: 'Cannot connect to the server. Please check your network connection or try again later.',
            conversations: []
          };
        }
        
        // Re-throw for other errors
        throw apiError;
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      
      return { 
        success: false, 
        error: error.message || 'Failed to fetch conversations', 
        conversations: [] 
      };
    }
  },/**
   * Get messages for a conversation
   * @param {string} token - Auth token
   * @param {string} conversationId - Conversation ID
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of messages per page
   * @returns {Promise} - List of messages
   */  getMessages: async (token, conversationId, page = 1, limit = 20) => {
    try {
      console.log(`🔍 API: Fetching messages for conversation ${conversationId}, page=${page}, limit=${limit}`);
      // Try to validate/refresh token first
      const validToken = await ChatService._validateToken(token);
      
      const response = await apiRequest(`/chats/${conversationId}/messages?page=${page}&limit=${limit}`, 'GET', null, validToken);
      console.log(`📥 API: Got response for conversation ${conversationId}, success=${response.success}, data length=${response.data ? response.data.length : 0}`);
      return response;
    } catch (error) {
      console.error(`Error fetching messages for conversation ${conversationId}:`, error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch messages',
        messages: [] 
      };
    }
  },

  /**
   * Send a message to a conversation
   * @param {string} token - Auth token
   * @param {string} conversationId - Conversation ID
   * @param {string} content - Message content
   * @param {string} messageType - Type of message (text, image, etc.)
   * @returns {Promise} - Sent message
   */  sendMessage: async (token, conversationId, content, messageType = 'text') => {
    try {
      // Try to validate/refresh token first
      const validToken = await ChatService._validateToken(token);
      
      // If conversationId starts with 'new_', this is a temporary ID and we need to create a real conversation first
      if (conversationId.toString().startsWith('new_')) {
        console.log('Handling temporary chat ID, creating real conversation...');
          // Extract the friend ID from the currentChat object
        // This assumes the currentChat.friend object contains the friend's user ID
        const extractedFriendId = conversationId.split('_')[1];
        if (!extractedFriendId) {
          return { success: false, error: 'Invalid temporary conversation ID' };
        }
        
        // Try to convert to integer for database compatibility
        const numericFriendId = !isNaN(parseInt(extractedFriendId, 10)) 
          ? parseInt(extractedFriendId, 10) 
          : extractedFriendId;
        
        console.log(`Creating real conversation with friend ID: ${numericFriendId}`);
        
        // Create a real conversation
        const createResult = await ChatService.createConversation(validToken, [numericFriendId]);
        if (!createResult.success) {
          return createResult; // Return error from conversation creation
        }
        
        // Use the new conversation ID
        conversationId = createResult.conversation.id;
      }
      
      // The backend expects 'text', not 'content'
      return apiRequest(`/chats/${conversationId}/messages`, 'POST', { text: content }, validToken);
    } catch (error) {
      console.error(`Error sending message to conversation ${conversationId}:`, error);
      return { 
        success: false, 
        error: error.message || 'Failed to send message' 
      };
    }
  },

  /**
   * Create a new conversation
   * @param {string} token - Auth token
   * @param {array} participants - Array of user IDs
   * @param {string} name - Name for group conversations
   * @param {boolean} isGroup - Whether this is a group conversation
   * @returns {Promise} - New conversation
   */  createConversation: async (token, participants, name = '', isGroup = false) => {
    try {
      // Try to validate/refresh token first
      const validToken = await ChatService._validateToken(token);
      
      return apiRequest('/chats/create', 'POST', { 
        participantIds: participants, 
        name, 
        is_group: isGroup 
      }, validToken);
    } catch (error) {
      console.error('Error creating conversation:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create conversation' 
      };
    }
  },
    /**
   * Refresh authentication token 
   * @returns {Promise<string>} New valid token
   */  refreshToken: async () => {
    try {
      // Get the current token from storage
      const currentToken = await AsyncStorage.getItem('userToken');
      
      if (!currentToken) {
        throw new Error('No token available to refresh');
      }
      
      // Call refresh token endpoint with the current token
      const response = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        }
      });
      
      if (!response.ok) {
        // Check if we need to handle the response differently
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          throw new Error(result.message || 'Token refresh failed');
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }
        const result = await response.json();
      
      if (!result.details || !result.details.token) {
        throw new Error('No token returned from refresh endpoint');
      }
      
      // Save the new token
      await AsyncStorage.setItem('userToken', result.details.token);
        // Validate token structure
      const newToken = result.details.token;
      const parts = newToken.split('.');
      if (parts.length !== 3) {
        console.warn('Received malformed JWT token from refresh endpoint');
      }
      
      console.log('Token refreshed successfully');
      return newToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
        // Only clear token on refresh failure
      await AsyncStorage.removeItem('userToken');
      
      // Notify app about authentication failure
      if (global.EventEmitter) {
        global.EventEmitter.emit('authError', {
          message: 'Your session has expired. Please login again.'
        });
      }
      
      throw new Error('Authentication expired. Please log in again.');
    }
  },
    /**
   * Handle authentication error with proper user feedback
   * @returns {Object} - Error response
   */
  handleAuthError: () => {
    // Notify app about authentication failure
    if (global.EventEmitter) {
      global.EventEmitter.emit('authError', {
        message: 'Your session has expired. Please login again.'
      });
    }
    
    return {
      success: false,
      error: 'Authentication expired. Please log in again.',
      conversations: []
    };
  },
    /**
   * Start or get a direct chat with another user
   * @param {string} token - Auth token
   * @param {object} friend - User to chat with (must include id)
   * @returns {Promise} - Conversation object
   */  startDirectChat: async (token, friend) => {
    try {
      if (!friend || (!friend.id && !friend.userId)) {
        console.error('Invalid friend object', friend);
        return { success: false, error: 'Invalid friend data' };
      }
        // Extract the friend's ID properly and convert to number if needed
      let friendId = friend.id || friend.userId;
      
      // Try to convert to integer if possible (for database compatibility)
      if (friendId && !isNaN(parseInt(friendId, 10))) {
        friendId = parseInt(friendId, 10);
      }
      
      console.log(`Starting direct chat with friend ID: ${friendId}`);
      
      // Validate/refresh token
      const validToken = await ChatService._validateToken(token);
      
      // First try to get existing conversation with this user
      const allConversations = await ChatService.getConversations(validToken);
      
      // Handle different response formats
      const conversations = 
        (allConversations.success && allConversations.conversations) ? allConversations.conversations :
        (allConversations.success && allConversations.data) ? allConversations.data : 
        [];
      
      if (conversations.length > 0) {
        // Look for a direct chat with just these two users
        const existingChat = conversations.find(chat => {
          // Only check direct chats (not group chats)
          if ((!chat.is_group_chat && !chat.is_group) && chat.participants && chat.participants.length === 2) {
            // If one of the participants is this friend
            return chat.participants.some(p => {
              const participantId = p.user_id || p.userId;
              return participantId == friendId; // Using == to handle string/number comparison
            });
          }
          return false;
        });
          
        if (existingChat) {
          console.log('Found existing chat with this friend');
          
          // Normalize the chat object to ensure consistent properties
          const normalizedChat = {
            ...existingChat,
            id: existingChat.id || existingChat.conversation_id,
            name: existingChat.title || existingChat.name || `Chat with ${friend.name}`,
            isGroup: existingChat.is_group_chat === true || existingChat.is_group === true || false,
            lastMessage: existingChat.lastMessage || '',
            lastMessageTime: existingChat.lastMessageTime || 'No messages',
            avatar: existingChat.avatar || friend.profilePicture
          };
          
          return {
            success: true,
            conversation: normalizedChat
          };
        }
      }
        
      // No existing chat found, create a new one
      console.log('Creating new chat conversation with friend');
      const result = await ChatService.createConversation(token, [friendId]);
      
      // If successful, normalize the returned conversation object
      if (result.success && (result.conversation || result.data)) {
        const newChat = result.conversation || result.data;
        
        // Normalize the chat object
        const normalizedChat = {
          ...newChat,
          id: newChat.id || newChat.conversation_id,
          name: newChat.name || newChat.title || `Chat with ${friend.name}`,
          isGroup: newChat.isGroupChat === true || newChat.is_group_chat === true || newChat.is_group === true || false,
          lastMessage: '',
          lastMessageTime: 'No messages yet',
          avatar: friend.profilePicture
        };
        
        return {
          success: true,
          conversation: normalizedChat
        };
      } else {
        // Create a temporary chat object for UI
        console.log('Creating temporary chat object for UI');
        const tempChat = {
          id: `new_${friendId}`,
          name: friend.name,
          isGroup: false,
          lastMessage: '',
          lastMessageTime: 'Start a conversation',
          avatar: friend.profilePicture,
          participants: [
            { userId: 'current_user' }, // Will be replaced when actually sending a message
            { userId: friendId, name: friend.name }
          ],
          friend: friend // Keep reference to friend for later use
        };
        
        return {
          success: true,
          conversation: tempChat
        };
      }
    } catch (error) {
      console.error('Error starting direct chat:', error);
      return {
        success: false,        error: error.message || 'Failed to start chat conversation'
      };
    }
  },
};

export default {
  AuthService,
  UserService,
  MedicationService,
  ReminderService,
  ContactService,
  ChatService
};
