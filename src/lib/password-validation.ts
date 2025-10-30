/**
 * MODULE: Password Validation Utility
 * PURPOSE: Strong password policy enforcement
 * DEPENDS_ON: None
 * USED_BY: Authentication forms
 *
 * Password Requirements:
 * - Minimum 10 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
}

export interface PasswordRequirement {
  regex: RegExp
  message: string
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    regex: /.{10,}/,
    message: 'Password must be at least 10 characters long',
  },
  {
    regex: /[A-Z]/,
    message: 'Password must contain at least one uppercase letter',
  },
  {
    regex: /[a-z]/,
    message: 'Password must contain at least one lowercase letter',
  },
  {
    regex: /[0-9]/,
    message: 'Password must contain at least one number',
  },
  {
    regex: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/,
    message: 'Password must contain at least one special character',
  },
]

/**
 * Validate a password against all requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  // Check each requirement
  for (const requirement of PASSWORD_REQUIREMENTS) {
    if (!requirement.regex.test(password)) {
      errors.push(requirement.message)
    }
  }

  // Calculate password strength
  const strength = calculatePasswordStrength(password)

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  }
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(
  password: string
): 'weak' | 'medium' | 'strong' | 'very-strong' {
  let score = 0

  // Length scoring
  if (password.length >= 10) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1

  // Character type scoring
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) score += 1

  // Multiple character types
  if (/[A-Z].*[A-Z]/.test(password)) score += 0.5
  if (/[0-9].*[0-9]/.test(password)) score += 0.5
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?].*[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) score += 0.5

  // Determine strength level
  if (score >= 8) return 'very-strong'
  if (score >= 6) return 'strong'
  if (score >= 4) return 'medium'
  return 'weak'
}

/**
 * Get password strength color for UI display
 */
export function getPasswordStrengthColor(
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
): string {
  switch (strength) {
    case 'weak':
      return 'text-red-600'
    case 'medium':
      return 'text-yellow-600'
    case 'strong':
      return 'text-green-600'
    case 'very-strong':
      return 'text-emerald-600'
  }
}

/**
 * Get password strength label for UI display
 */
export function getPasswordStrengthLabel(
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
): string {
  switch (strength) {
    case 'weak':
      return 'Weak'
    case 'medium':
      return 'Medium'
    case 'strong':
      return 'Strong'
    case 'very-strong':
      return 'Very Strong'
  }
}

/**
 * Check if passwords match (for confirmation field)
 */
export function checkPasswordsMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword && password.length > 0
}

// Example usage:
//
// const result = validatePassword('MyP@ssw0rd123')
// if (!result.isValid) {
//   console.error('Password validation failed:', result.errors)
// }
// console.log('Password strength:', result.strength)
