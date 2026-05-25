const PHOTO_BUCKET = 'profile-photos'

export function getProfilePhotoUrl(photoPath?: string | null): string | null {
  if (!photoPath) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  return `${supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${photoPath}`
}
