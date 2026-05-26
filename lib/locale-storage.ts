import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isSupportedLanguage, type SupportedLanguage } from '@/lib/language-options'

function readFallbackLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isSupportedLanguage(saved) ? saved : DEFAULT_LANGUAGE
}

export async function loadLanguagePreference(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isSupportedLanguage(stored)) {
      return stored
    }
  } catch {
    return readFallbackLanguage()
  }

  return readFallbackLanguage()
}

export async function saveLanguagePreference(language: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }
  }
}
