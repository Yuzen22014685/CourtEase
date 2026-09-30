/**
 * Validates password strength:
 * - At least 8 characters
 * - At least one letter
 * - At least one number
 * - At least one symbol
 *
 * Keep in sync with client/src/components/ui/PasswordChecklist.jsx
 *
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters and include a letter, a number and a symbol.',
    };
  }

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);

  if (!hasMinLength || !hasLetter || !hasNumber || !hasSymbol) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters and include a letter, a number and a symbol.',
    };
  }

  return { isValid: true };
};

module.exports = { validatePassword };
