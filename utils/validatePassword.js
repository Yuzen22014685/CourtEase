/**
 * Validates password strength:
 * - At least 8 characters
 * - At least one letter
 * - At least one number
 *
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters and include a letter and a number.',
    };
  }

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasMinLength || !hasLetter || !hasNumber) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters and include a letter and a number.',
    };
  }

  return { isValid: true };
};

module.exports = { validatePassword };
