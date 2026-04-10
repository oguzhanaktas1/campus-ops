import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://campusops.app'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'CampusOps – Smart Campus Operations Platform',
    template: '%s | CampusOps',
  },
  description:
    'CampusOps is the all-in-one operations platform built for universities. Manage student requests, faculty approvals, IT tickets, room reservations, and procurement workflows — all in one place.',
  keywords: [
    'campus operations platform',
    'university management software',
    'student portal',
    'faculty portal',
    'staff portal',
    'higher education SaaS',
    'campus workflow automation',
    'university request management',
    'room reservation system',
    'internship management',
  ],
  authors: [{ name: 'CampusOps' }],
  creator: 'CampusOps',
  publisher: 'CampusOps',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: 'CampusOps',
    title: 'CampusOps – Smart Campus Operations Platform',
    description:
      'All-in-one operations platform for universities. Automate approvals, manage requests, and streamline campus workflows.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CampusOps – Smart Campus Operations Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@campusops',
    creator: '@campusops',
    title: 'CampusOps – Smart Campus Operations Platform',
    description:
      'All-in-one operations platform for universities. Automate approvals, manage requests, and streamline campus workflows.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  alternates: {
    canonical: APP_URL,
  },
  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1b2e' },
  ],
  width: 'device-width',
  initialScale: 1,
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${APP_URL}/#organization`,
      name: 'CampusOps',
      url: APP_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${APP_URL}/icon.svg`,
      },
      description:
        'CampusOps is an all-in-one campus operations platform for universities and higher education institutions.',
      sameAs: ['https://twitter.com/campusops'],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${APP_URL}/#software`,
      name: 'CampusOps',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: APP_URL,
      description:
        'A unified platform for university campus operations — student requests, faculty approvals, IT ticketing, room reservations, and workflow automation.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free trial available',
      },
      publisher: {
        '@id': `${APP_URL}/#organization`,
      },
      featureList: [
        'Student request management',
        'Faculty approval workflows',
        'IT ticket system',
        'Room reservation management',
        'Internship application tracking',
        'Procurement request management',
        'Role-based access control',
        'Real-time analytics dashboard',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${APP_URL}/#website`,
      url: APP_URL,
      name: 'CampusOps',
      publisher: {
        '@id': `${APP_URL}/#organization`,
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
