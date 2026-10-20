import { supabase } from '../lib/supabase'

/**
 * authService
 * ---------------------------------------------------------------------------
 * Username + password auth on top of Supabase Auth.
 *
 * Supabase Auth needs an email, so each username is mapped to a synthetic one:
 *     alex  ->  alex@<VITE_AUTH_EMAIL_DOMAIN>
 * Users never see this address. Later, a user can attach a real email with
 * linkEmail(); after that they can sign in with either their username or that
 * email (signIn treats any identifier containing "@" as an email).
 *
 * Every function either resolves with data or throws an AuthError whose
 * `message` is safe to show directly in the UI.
 *
 * Required Supabase dashboard settings (Authentication):
 *   - Email provider: "Confirm email" OFF (synthetic addresses can't confirm)
 *   - Email provider: "Secure email change" OFF (needed for linkEmail later)
 *   - Minimum password length: 8
 */

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/ // mirrors the profiles.username CHECK
export const MIN_PASSWORD_LENGTH = 8

const EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN

export class AuthError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthError'
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function validateUsername(username) {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-24 characters: letters, numbers, and underscores only.'
  }
  return null
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

function usernameToEmail(username) {
  if (!EMAIL_DOMAIN) {
    throw new AuthError('Login is not configured (missing VITE_AUTH_EMAIL_DOMAIN).')
  }
  return `${username.toLowerCase()}@${EMAIL_DOMAIN}`
}

/** True if this email is one of our generated ones (i.e. the user hasn't linked a real email). */
export function isSyntheticEmail(email) {
  return Boolean(EMAIL_DOMAIN && email?.toLowerCase().endsWith(`@${EMAIL_DOMAIN.toLowerCase()}`))
}

function toAuthError(error) {
  const code = error?.code
  const message = error?.message ?? ''

  if (code === 'invalid_credentials' || message === 'Invalid login credentials') {
    return new AuthError('Incorrect username or password.')
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return new AuthError('That username is already taken.')
  }
  if (code === 'weak_password') {
    return new AuthError(`Password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  // The signup trigger failed, almost always a username collision that slipped past the pre-check.
  if (/database error saving new user/i.test(message)) {
    return new AuthError('That username is unavailable. Please try another.')
  }
  if (error?.status === 429 || code === 'over_request_rate_limit') {
    return new AuthError('Too many attempts. Please wait a moment and try again.')
  }
  if (code === 'email_exists') {
    return new AuthError('That email is already linked to another account.')
  }
  console.error('Unhandled auth error:', error)
  return new AuthError('Something went wrong. Please try again.')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Create an account and sign in. Resolves with the new session. */
export async function signUp({ username, password }) {
  const name = (username ?? '').trim()
  const problem = validateUsername(name) ?? validatePassword(password)
  if (problem) throw new AuthError(problem)

  // Friendlier than the generic DB error. If the check itself fails we still try the signup;
  // the database constraints are the real enforcement.
  const { data: available, error: rpcError } = await supabase.rpc('username_available', {
    p_username: name,
  })
  if (!rpcError && available === false) throw new AuthError('That username is already taken.')

  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(name),
    password,
    // Read by the handle_new_user trigger to create the profile row.
    options: { data: { username: name } },
  })
  if (error) throw toAuthError(error)

  // No session means "Confirm email" is still enabled in the dashboard.
  if (!data.session) {
    throw new AuthError('Account created, but sign-in did not complete. Please try signing in.')
  }
  return data.session
}

/**
 * Sign in with a username, or with a linked real email.
 * Resolves with the session.
 */
export async function signIn({ identifier, password }) {
  const id = (identifier ?? '').trim()
  if (!id) throw new AuthError('Enter your username or email.')

  let email
  if (id.includes('@')) {
    email = id.toLowerCase()
  } else {
    // Accounts with a linked email sign in under that address; others use the synthetic one.
    const { data: linked } = await supabase.rpc('login_email_for_username', { p_username: id })
    email = linked ?? usernameToEmail(id)
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toAuthError(error)
  return data.session
}

/** Sign out this browser only (other devices stay signed in). */
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw toAuthError(error)
}

/** The persisted session, or null. Used once on app start. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toAuthError(error)
  return data.session
}

/**
 * Subscribe to session changes (sign in, sign out, token refresh).
 * Callback receives the new session or null. Returns an unsubscribe function.
 */
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

/**
 * Attach a real email to the account (the "link your email later" flow).
 * Supabase sends a confirmation link to the new address. Once it's clicked, the user can
 * sign in with either their username or that email. The old username-based login keeps working only if the
 * change was never confirmed, so call this from an explicit "Link email" action and
 * tell the user they'll sign in with the email afterwards.
 */
export async function linkEmail(email) {
  const clean = (email ?? '').trim().toLowerCase()
  if (!clean.includes('@')) throw new AuthError('Enter a valid email address.')

  const { error } = await supabase.auth.updateUser(
    { email: clean },
    { emailRedirectTo: window.location.origin }
  )
  if (error) throw toAuthError(error)
}