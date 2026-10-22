import { supabase } from '../lib/supabase'
import { validateUsername } from './authService'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export async function updateProfile(userId, fields) {
  if ('username' in fields) {
    const problem = validateUsername(fields.username)
    if (problem) throw new Error(problem)
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('That username is already taken.')
    console.error('Profile update failed:', error)
    throw new Error('Could not save your changes. Please try again.')
  }
  return data
}

/** Uploads to avatars/<userId>/avatar and returns a public URL. */
export async function uploadAvatar(userId, file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('Image must be under 2 MB.')

  const path = `${userId}/avatar`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    console.error('Avatar upload failed:', error)
    throw new Error('Could not upload your picture. Please try again.')
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}` // cache-bust, since the path never changes
}

export function parseHeight(input) {
  const s = String(input ?? '').trim().replace(/["”]$/, '')
  const m = s.match(/^(\d)\s*['’-]\s*(\d{1,2})$/)
  let inches
  if (m && Number(m[2]) < 12) inches = Number(m[1]) * 12 + Number(m[2])
  else if (/^\d{2,3}$/.test(s)) inches = Number(s) // plain number = inches
  else throw new Error("Enter height like 5'10.")
  if (inches < 36 || inches > 96) throw new Error('Height looks out of range.')
  return inches
}

export function formatHeight(inches) {
  return `${Math.floor(inches / 12)}'${inches % 12}`
}

export function parseWeight(input) {
  const n = Number(String(input ?? '').trim())
  if (!Number.isFinite(n) || n < 20 || n > 1000) {
    throw new Error('Enter weight in pounds, like 165.')
  }
  return n
}