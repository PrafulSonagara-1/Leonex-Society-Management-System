/**
 * Leonex SSMS - Central Configuration & Startup Environment Validator
 * Enforces production security invariants and fail-fast startup checks.
 */

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Startup Validator: Fail fast if required variables are missing
const requiredInProduction = [
  'JWT_SECRET',
  'CLERK_SECRET_KEY',
  'SUPER_ADMIN_CLERK_USER_ID'
];

if (isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key] || !process.env[key].trim());
  if (missing.length > 0) {
    throw new Error(
      `[SECURITY FATAL] Missing required production environment variable(s): ${missing.join(', ')}. Server cannot start.`
    );
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error(
      `[SECURITY FATAL] JWT_SECRET must be at least 32 characters long in production (current length: ${process.env.JWT_SECRET.length}).`
    );
  }
} else {
  // In development, require JWT_SECRET and enforce minimum length to avoid weak keys
  if (!process.env.JWT_SECRET) {
    throw new Error(
      '[SECURITY FATAL] JWT_SECRET is not set in your .env file. Please generate a random secret of at least 32 characters.'
    );
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      `[SECURITY FATAL] JWT_SECRET must be at least 32 characters long (current length: ${process.env.JWT_SECRET.length}).`
    );
  }
}

// Parse Allowed Origins for CORS
function getAllowedOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  // Default to common development origins if not specified in non-production
  if (!isProduction) {
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }
  return [];
}

module.exports = {
  isProduction,
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET,
  clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  superAdminClerkUserId: (process.env.SUPER_ADMIN_CLERK_USER_ID || '').trim(),
  superAdminPasswordHash: process.env.SUPER_ADMIN_PASSWORD_HASH || '',
  allowedOrigins: getAllowedOrigins()
};
