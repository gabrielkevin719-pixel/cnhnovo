import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'gov.br',
  description: 'Portal gov.br',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
