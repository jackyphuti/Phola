'use client'

import dynamic from 'next/dynamic'
import { AppLoadingState } from '@/components/app-loading-state'

const SOSMap = dynamic(() => import('@/components/sos-map').then((mod) => mod.SOSMap), {
  ssr: false,
  loading: () => <AppLoadingState message="Connecting to Phola Emergency SOS..." timeoutSeconds={3} />,
})

export default function SOSPage() {
  return (
    <main className="min-h-screen bg-background">
      <SOSMap />
    </main>
  )
}
