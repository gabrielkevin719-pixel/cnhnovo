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
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta property="creator.productor" content="http://estruturaorganizacional.dados.gov.br/id/unidade-organizacional/2981" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
        <link rel="stylesheet" href="/cdn.jsdelivr.net/npm/%40fortawesome/fontawesome-free%406/css/all.min.css" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap" />
        <link rel="stylesheet" href="/assets/index-Nk5hQ9Fp.css" />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --background: 0 0% 100%;
            --foreground: 20 14.3% 4.1%;
            --muted: 60 4.8% 95.9%;
            --muted-foreground: 25 5.3% 44.7%;
            --popover: 0 0% 100%;
            --popover-foreground: 20 14.3% 4.1%;
            --card: 0 0% 100%;
            --card-foreground: 20 14.3% 4.1%;
            --border: 20 5.9% 90%;
            --input: 20 5.9% 90%;
            --primary: 222 47% 11%;
            --primary-foreground: 221 8% 97%;
            --secondary: 60 4.8% 95.9%;
            --secondary-foreground: 24 9.8% 10%;
            --accent: 60 4.8% 95.9%;
            --accent-foreground: 24 9.8% 10%;
            --destructive: 0 84.2% 60.2%;
            --destructive-foreground: 60 9.1% 97.8%;
            --ring: 20 14.3% 4.1%;
            --radius: 0.5rem;
          }
          .dark {
            --background: 240 10% 3.9%;
            --foreground: 0 0% 98%;
            --muted: 240 3.7% 15.9%;
            --muted-foreground: 240 5% 64.9%;
            --popover: 240 10% 3.9%;
            --popover-foreground: 0 0% 98%;
            --card: 240 10% 3.9%;
            --card-foreground: 0 0% 98%;
            --border: 240 3.7% 15.9%;
            --input: 240 3.7% 15.9%;
            --primary: 222 47% 11%;
            --primary-foreground: 221 8% 97%;
            --secondary: 240 3.7% 15.9%;
            --secondary-foreground: 0 0% 98%;
            --accent: 240 3.7% 15.9%;
            --accent-foreground: 0 0% 98%;
            --destructive: 0 62.8% 30.6%;
            --destructive-foreground: 0 0% 98%;
            --ring: 240 4.9% 83.9%;
            --radius: 0.5rem;
          }
          .sticky-nav {
            position: sticky;
            top: 0;
            z-index: 1000;
          }
        `}} />
      </head>
      <body>
        {children}
        <script defer src="/assets/index-f8rMPGcv.js"></script>
      </body>
    </html>
  )
}
