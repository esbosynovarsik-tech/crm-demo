/**
 * Utility functions for Uzbek phone number formatting and real-time input masking.
 * Standard format: +998 XX XXX XX XX (e.g. +998 90 880 56 56)
 */

/**
 * Strips all non-digit characters.
 */
export const cleanDigits = (value: string): string => {
  return (value || '').replace(/\D/g, '');
};

/**
 * Extracts 9 subscriber digits from phone string, handling leading 998 or 8.
 */
export const extractUzbekSubscriberDigits = (value: string): string => {
  let digits = cleanDigits(value);
  if (digits.startsWith('998')) {
    digits = digits.slice(3);
  }
  return digits.slice(0, 9);
};

/**
 * Real-time input formatter for Uzbekistan phone numbers.
 * Auto-inserts spaces as user types: +998 XX XXX XX XX
 *
 * @param value raw input string
 * @param isOptional if true, allows completely clearing the field to empty string
 */
export const formatUzbekPhoneInput = (value: string, isOptional: boolean = false): string => {
  if (!value || value.trim() === '') {
    return isOptional ? '' : '+998 ';
  }

  // If user is clearing out or backspacing past +998
  const trimmed = value.trim();
  if (trimmed === '+' || trimmed === '+9' || trimmed === '+99' || trimmed === '+998' || trimmed === '+998 ') {
    return isOptional ? '' : '+998 ';
  }

  let digits = cleanDigits(value);

  // If user pasted/typed with country code
  if (digits.startsWith('998')) {
    digits = digits.slice(3);
  }

  // Limit to 9 subscriber digits
  digits = digits.slice(0, 9);

  if (digits.length === 0) {
    return isOptional ? '' : '+998 ';
  }

  // Format progressively: +998 XX XXX XX XX
  let formatted = '+998 ';

  if (digits.length <= 2) {
    formatted += digits;
  } else if (digits.length <= 5) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2)}`;
  } else if (digits.length <= 7) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  } else {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }

  return formatted;
};

/**
 * Formats any stored phone number for display throughout the app:
 * +998 XX XXX XX XX
 */
export const formatDisplayPhone = (phone?: string | null, fallback: string = '—'): string => {
  if (!phone || phone.trim() === '') return fallback;
  const digits = cleanDigits(phone);
  
  let subDigits = digits;
  if (digits.startsWith('998')) {
    subDigits = digits.slice(3);
  }

  if (subDigits.length === 9) {
    return `+998 ${subDigits.slice(0, 2)} ${subDigits.slice(2, 5)} ${subDigits.slice(5, 7)} ${subDigits.slice(7, 9)}`;
  }

  // If partially entered or custom
  if (subDigits.length > 0 && subDigits.length < 9) {
    return formatUzbekPhoneInput(subDigits, false);
  }

  return phone;
};
