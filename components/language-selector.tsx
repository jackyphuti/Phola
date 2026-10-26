'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/language-options'
import { loadLanguagePreference, saveLanguagePreference } from '@/lib/locale-storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Globe, ChevronDown } from 'lucide-react'

interface LanguageSelectorProps {
  compact?: boolean
  dropdown?: boolean
  minimal?: boolean
}

export function LanguageSelector({ compact = false, dropdown = false, minimal = false }: LanguageSelectorProps) {
  const { t } = useTranslation()
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>('en')

  useEffect(() => {
    void loadLanguagePreference().then((language) => {
      setActiveLanguage(language)
      void i18n.changeLanguage(language)
      document.documentElement.lang = language
    })
  }, [])

  const handleChange = async (language: SupportedLanguage) => {
    setActiveLanguage(language)
    await i18n.changeLanguage(language)
    await saveLanguagePreference(language)
    document.documentElement.lang = language
  }

  // 1. Minimal Header Dropdown (Top corner, clean pill)
  if (minimal) {
    return (
      <div className="relative inline-flex items-center">
        <label htmlFor="minimal-lang-select" className="sr-only">Choose Language</label>
        <div className="pointer-events-none absolute left-2.5 z-10 flex items-center">
          <Globe className="h-3.5 w-3.5 text-primary" />
        </div>
        <select
          id="minimal-lang-select"
          className="h-8 rounded-full border border-emerald-200 bg-white/95 pl-7 pr-7 text-xs font-semibold text-emerald-950 shadow-2xs hover:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur cursor-pointer appearance-none"
          value={activeLanguage}
          onChange={(event) => void handleChange(event.target.value as SupportedLanguage)}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeName} ({language.englishName})
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 z-10 flex items-center">
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    )
  }

  // 2. Full Dropdown (e.g. in Settings)
  if (dropdown) {
    return (
      <div className="space-y-2">
        <label htmlFor="language-select" className="text-sm font-medium text-foreground">
          {t('languageTitle')}
        </label>
        <select
          id="language-select"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={activeLanguage}
          onChange={(event) => void handleChange(event.target.value as SupportedLanguage)}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeName} ({language.englishName})
            </option>
          ))}
        </select>
      </div>
    )
  }

  // 3. Compact Pills
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_LANGUAGES.map((language) => (
          <Button
            key={language.code}
            type="button"
            variant={activeLanguage === language.code ? 'default' : 'outline'}
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => void handleChange(language.code)}
          >
            <span aria-hidden>{language.flag}</span>
            <span>{language.nativeName}</span>
          </Button>
        ))}
      </div>
    )
  }

  // 4. Default Grid Cards
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t('languageTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('selectLanguage')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SUPPORTED_LANGUAGES.map((language) => (
          <Card
            key={language.code}
            className={`cursor-pointer border p-3 transition-colors ${activeLanguage === language.code ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
            onClick={() => void handleChange(language.code)}
          >
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-xl">{language.flag}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{language.nativeName}</p>
                <p className="text-xs text-muted-foreground">{language.englishName}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
