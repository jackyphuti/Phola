'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useTranslation } from 'react-i18next'

interface PrivacyConsentProps {
  onAccept: () => void
}

export function PrivacyConsent({ onAccept }: PrivacyConsentProps) {
  const { t } = useTranslation()
  const [accepted, setAccepted] = useState(false)

  return (
    <Card className="border-border/70 bg-card/95 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">POPIA consent</CardTitle>
        <CardDescription>
          We only collect what we need to create your account and keep you safe. You can delete your data from Settings at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(value: boolean | 'indeterminate') => setAccepted(value === true)} />
          <span>
            I consent to Phola processing my account details, safety reports, and emergency contact information for safety and support purposes.
          </span>
        </label>
        <Button className="w-full" onClick={onAccept} disabled={!accepted}>
          {t('getStarted')}
        </Button>
      </CardContent>
    </Card>
  )
}
