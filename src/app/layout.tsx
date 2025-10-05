import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { RefineProvider } from '@/components/providers/RefineProvider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tri-Logis Landlord Portal',
  description: 'Admin portal for Tri-Logis landlords',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <RefineProvider>
            {children}
          </RefineProvider>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  )
}
