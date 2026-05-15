import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "gov.br",
  icons: {
    icon: "/favicon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="/cdn.jsdelivr.net/npm/%40fortawesome/fontawesome-free%406/css/all.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
