import type { Metadata } from 'next'
import './globals.css'
import 'leaflet/dist/leaflet.css'

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
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
