import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Creative Intelligence — Appodeal Accelerator',
  description: 'Competitor creative analysis powered by SensorTower + Claude',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
