export type SupportedLanguage =
  | 'en'
  | 'zu'
  | 'xh'
  | 'af'
  | 'nso'
  | 'tn'
  | 'st'
  | 'ts'
  | 'ss'
  | 've'
  | 'nr'

export const LANGUAGE_STORAGE_KEY = 'phola-language'

export const SUPPORTED_LANGUAGES: Array<{
  code: SupportedLanguage
  nativeName: string
  englishName: string
  flag: string
}> = [
  { code: 'zu', nativeName: 'isiZulu', englishName: 'Zulu', flag: '🇿🇦' },
  { code: 'xh', nativeName: 'isiXhosa', englishName: 'Xhosa', flag: '🇿🇦' },
  { code: 'af', nativeName: 'Afrikaans', englishName: 'Afrikaans', flag: '🇿🇦' },
  { code: 'nso', nativeName: 'Sepedi', englishName: 'Northern Sotho', flag: '🇿🇦' },
  { code: 'tn', nativeName: 'Setswana', englishName: 'Tswana', flag: '🇿🇦' },
  { code: 'st', nativeName: 'Sesotho', englishName: 'Sotho', flag: '🇿🇦' },
  { code: 'ts', nativeName: 'Xitsonga', englishName: 'Tsonga', flag: '🇿🇦' },
  { code: 'ss', nativeName: 'siSwati', englishName: 'Swati', flag: '🇿🇦' },
  { code: 've', nativeName: 'Tshivenda', englishName: 'Venda', flag: '🇿🇦' },
  { code: 'nr', nativeName: 'isiNdebele', englishName: 'Ndebele', flag: '🇿🇦' },
  { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇿🇦' },
]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return Boolean(value && SUPPORTED_LANGUAGES.some((language) => language.code === value))
}
