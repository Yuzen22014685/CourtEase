export const checkPasswordValidity = (password = '') => {
  const hasMinLength = password.length >= 8
  const hasLetter    = /[a-zA-Z]/.test(password)
  const hasNumber    = /[0-9]/.test(password)
  return {
    hasMinLength,
    hasLetter,
    hasNumber,
    isValid: hasMinLength && hasLetter && hasNumber,
  }
}

export default function PasswordChecklist({ password = '', className = '' }) {
  const { hasMinLength, hasLetter, hasNumber } = checkPasswordValidity(password)

  const rules = [
    { label: 'At least 8 characters', met: hasMinLength },
    { label: 'Contains a letter', met: hasLetter },
    { label: 'Contains a number', met: hasNumber },
  ]

  return (
    <ul className={`mt-2 space-y-1 text-xs ${className}`}>
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 transition-colors duration-150 ${
            rule.met ? 'text-emerald-600 font-medium' : 'text-gray-400'
          }`}
        >
          <span className="font-bold text-xs">{rule.met ? '✓' : '•'}</span>
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  )
}
