'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ArrowLeft, 
  Phone, 
  MessageCircle, 
  Globe, 
  Shield,
  Heart,
  Users,
  Clock,
  ExternalLink,
  X
} from 'lucide-react'
import { useState } from 'react'

// South African GBV resources
const EMERGENCY_CONTACTS = [
  {
    name: 'GBV Command Centre',
    number: '0800 428 428',
    description: '24/7 toll-free helpline for gender-based violence',
    icon: Shield,
    highlight: true,
  },
  {
    name: 'SAPS Emergency',
    number: '10111',
    description: 'South African Police Service emergency line',
    icon: Phone,
  },
  {
    name: 'Childline SA',
    number: '0800 055 555',
    description: '24/7 support for children in crisis',
    icon: Heart,
  },
  {
    name: 'Lifeline SA',
    number: '0861 322 322',
    description: 'Counselling and crisis intervention',
    icon: MessageCircle,
  },
  {
    name: 'POWA',
    number: '011 642 4345',
    description: 'People Opposing Women Abuse',
    icon: Users,
  },
  {
    name: 'Rape Crisis Cape Town',
    number: '021 447 9762',
    description: 'Support for sexual assault survivors',
    icon: Heart,
  },
]

const RESOURCES = [
  {
    title: 'Know Your Rights',
    description: 'Understanding protection orders and legal options',
    items: [
      'You can apply for a Protection Order at any Magistrate Court',
      'Protection Orders are free of charge',
      'You do not need a lawyer to apply',
      'The order can be granted the same day in urgent cases',
    ],
  },
  {
    title: 'Safety Planning',
    description: 'Tips to stay safe',
    items: [
      'Keep important documents in a safe place or with a trusted person',
      'Memorize emergency numbers',
      'Identify safe places to go in an emergency',
      'Tell a trusted person about your situation',
      'Pack an emergency bag with essentials',
    ],
  },
  {
    title: 'Types of Abuse',
    description: 'Abuse takes many forms',
    items: [
      'Physical - hitting, pushing, restraining',
      'Emotional - threats, insults, isolation, control',
      'Sexual - any unwanted sexual contact or coercion',
      'Financial - controlling money, preventing work',
      'Digital - harassment online, monitoring devices',
    ],
  },
]

const ONLINE_RESOURCES = [
  {
    name: 'Commission for Gender Equality',
    url: 'https://cge.org.za',
    description: 'Report discrimination and get legal assistance',
  },
  {
    name: 'Thuthuzela Care Centres',
    url: 'https://www.npa.gov.za/content/thuthuzela-care-centres',
    description: 'One-stop facilities for survivors of sexual offences',
  },
  {
    name: 'Soul City',
    url: 'https://www.soulcity.org.za',
    description: 'Health and development resources',
  },
]

export function ResourcesPage() {
  const router = useRouter()
  const [showSafeExit, setShowSafeExit] = useState(false)

  const handleSafeExit = () => {
    window.location.href = 'https://www.google.com'
  }

  const handleCall = (number: string) => {
    window.location.href = `tel:${number.replace(/\s/g, '')}`
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Safe Exit Overlay */}
      {showSafeExit && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-lg text-foreground">Leave this page quickly?</p>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowSafeExit(false)}
              >
                Stay
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSafeExit}
              >
                Exit Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Reference</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSafeExit(true)}
            className="text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-6 pb-8">
        {/* Emergency Banner */}
        <Card className="bg-primary/5 border-primary/20" id="emergency">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Need help right now?</p>
                <p className="text-sm text-muted-foreground mb-3">
                  These services are available 24/7 and are free to call.
                </p>
                <Button
                  size="sm"
                  onClick={() => handleCall('0800 428 428')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call GBV Helpline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Quick Contacts</h2>
          <div className="space-y-2">
            {EMERGENCY_CONTACTS.map((contact) => (
              <Card 
                key={contact.number}
                className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                  contact.highlight ? 'border-primary/30' : ''
                }`}
                onClick={() => handleCall(contact.number)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    contact.highlight ? 'bg-primary/10' : 'bg-secondary'
                  }`}>
                    <contact.icon className={`w-5 h-5 ${
                      contact.highlight ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm text-primary">{contact.number}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Information Sections */}
        {RESOURCES.map((section, index) => (
          <section key={index} className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{section.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        ))}

        {/* Online Resources */}
        <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Online Resources</h2>
          <div className="space-y-2">
            {ONLINE_RESOURCES.map((resource) => (
              <Card 
                key={resource.url}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{resource.name}</p>
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SMS Option */}
        <Card className="bg-accent/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Cannot make a call?</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Please Call Me to 0800 428 428. The GBV Command Centre will call you back.
                </p>
                <p className="text-xs text-muted-foreground">
                  If you are in immediate danger, try to get to a safe place and call 10111.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
