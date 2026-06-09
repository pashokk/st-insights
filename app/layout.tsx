import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ST Insights',
  description: 'Competitor creative analysis powered by SensorTower + Claude',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
