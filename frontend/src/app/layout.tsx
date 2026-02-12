import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wien Öffi Tracker - Pünktlichkeitsanalyse',
  description: 'Real-time punctuality tracking and analysis for Vienna public transport (Wiener Linien + ÖBB S-Bahn)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
