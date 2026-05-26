'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/language-options'
import { loadLanguagePreference, saveLanguagePreference } from '@/lib/locale-storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LanguageSelectorProps {
  compact?: boolean
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
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
