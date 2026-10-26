'use client'

import { Suspense } from 'react'
import { AuthScreen } from '@/components/auth-screen'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthScreen initialMode="login" />
    </Suspense>
  )
}
