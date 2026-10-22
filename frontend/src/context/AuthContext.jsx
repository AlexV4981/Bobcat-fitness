import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import * as authService from '../services/authService'

/**
 * AuthContext
 * ---------------------------------------------------------------------------
 * Single source of truth for "who is using the app". Replaces the in-memory
 * registeredUsers / plaintext-password logic that used to live in App.jsx.
 *
 * Wrap the app once (main.jsx):
 *     <AuthProvider><App /></AuthProvider>
 * then anywhere:
 *     const { session, profile, isGuest, signIn, signUp, signOut } = useAuth()
 *
 * Exposed value:
 *   loading          true until the stored session has been checked (render a splash, not Login)
 *   session          Supabase session or null
 *   user             session.user or null (user.id is what RLS compares against)
 *   profile          row from public.profiles, or null while loading / if it failed to load
 *   profileLoading   true while the profile for the current user is being fetched
 *   isGuest          true after continueAsGuest(); guests have no session and no DB access
 *   isLoggedIn       Boolean(session) || isGuest
 *   signIn(identifier, password)   username or linked email; throws AuthError
 *   signUp(username, password)     creates account and signs in; throws AuthError
 *   signOut()                      also ends guest mode
 *   continueAsGuest()
 *   refreshProfile()               re-fetch the profile after an update
 */

const AuthContext = createContext(null)

// TODO(profile branch): move into services/profileService.js
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [guestMode, setGuestMode] = useState(false)
  // Tagged with the user id it belongs to, so a stale profile is never shown for a different user.
  const [profileState, setProfileState] = useState({ userId: null, data: null })

  // Restore the stored session on load, then follow changes.
  // The listener callback only stores the session; no Supabase calls inside it
  // (awaiting one there can deadlock supabase-js).
  useEffect(() => {
    let active = true

    authService
      .getSession()
      .then((s) => {
        if (active) setSession(s)
      })
      .catch((err) => console.error('Could not restore session:', err))
      .finally(() => {
        if (active) setInitializing(false)
      })

    const unsubscribe = authService.onAuthChange((s) => {
      if (active) setSession(s)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Load the profile whenever the signed-in user changes.
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!userId) return
    let active = true

    fetchProfile(userId)
      .then((data) => {
        if (active) setProfileState({ userId, data })
      })
      .catch((err) => {
        console.error('Could not load profile:', err)
        if (active) setProfileState({ userId, data: null })
      })

    return () => {
      active = false
    }
  }, [userId])

  const profile = profileState.userId === userId ? profileState.data : null
  const profileLoading = userId !== null && profileState.userId !== userId

  const refreshProfile = useCallback(async () => {
    if (!userId) return null
    const data = await fetchProfile(userId)
    setProfileState({ userId, data })
    return data
  }, [userId])

  const signIn = useCallback(async (identifier, password) => {
    await authService.signIn({ identifier, password })
    setGuestMode(false)
  }, [])

  const signUp = useCallback(async (username, password) => {
    await authService.signUp({ username, password })
    setGuestMode(false)
  }, [])

  const linkEmail = useCallback(async (email) => {
    await authService.linkEmail(email)
    const s = await authService.getSession() // picks up the pending new_email
    setSession(s)
  }, [])

  const signOut = useCallback(async () => {
    setGuestMode(false)
    if (session) await authService.signOut()
  }, [session])

  const continueAsGuest = useCallback(() => setGuestMode(true), [])

  const value = useMemo(() => {
    const isGuest = guestMode && !session
    return {
      loading: initializing,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      isGuest,
      isLoggedIn: Boolean(session) || isGuest,
      signIn,
      linkEmail,
      signUp,
      signOut,
      continueAsGuest,
      refreshProfile,
    }
  }, [
    initializing,
    session,
    profile,
    profileLoading,
    guestMode,
    signIn,
    linkEmail,
    signUp,
    signOut,
    continueAsGuest,
    refreshProfile,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
