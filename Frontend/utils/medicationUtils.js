/**
 * Utility functions for medication handling
 */

// Import the medication icons
import { MEDICATION_ICONS } from '../constants/medicationIcons';

/**
 * Gets an appropriate icon for a medication based on the iconType
 * @param {string} iconType - The icon type from the medication data
 * @returns {Object} - The icon image source
 */
export const getMedicationIcon = (iconType) => {
  // If the iconType exists in our MEDICATION_ICONS, return it
  if (iconType && MEDICATION_ICONS[iconType]) {
    return MEDICATION_ICONS[iconType];
  }
  
  // Otherwise, return a deterministic icon based on the string
  // This ensures the same medication always gets the same icon
  if (iconType) {
    // Use the string to generate a consistent index
    const charSum = Array.from(iconType).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const iconKeys = Object.keys(MEDICATION_ICONS);
    const index = charSum % iconKeys.length;
    return MEDICATION_ICONS[iconKeys[index]];
  }
  
  // If no iconType, return a random icon
  const iconKeys = Object.keys(MEDICATION_ICONS);
  const randomIcon = iconKeys[Math.floor(Math.random() * iconKeys.length)];
  return MEDICATION_ICONS[randomIcon];
};

/**
 * Maps raw backend medication data to frontend format
 * @param {Object} med - Raw medication data from backend
 * @param {Object} reminder - Reminder data the medication belongs to
 * @returns {Object} - Formatted medication data for frontend use
 */
export const mapMedicationData = (med, reminder) => {
  return {
    id: med.medication_id || `temp-${Math.random().toString(36).substring(2, 9)}`,
    name: med.name || 'Unknown Medication',
    dosage: med.dosage || 'No dosage info',
    frequency: reminder?.title || 'As needed',
    time: reminder?.time || 'Anytime',
    remainingCount: med.remainingQuantity 
      ? `${med.remainingQuantity} ${med.unit || 'units'} remain` 
      : 'Quantity unknown',
    iconType: med.icon_type || 'medicine',
    status: med.status || 'pending',
    reminderMedId: med.reminder_med_id,
    color: med.color || '#4B70FE'
  };
};
