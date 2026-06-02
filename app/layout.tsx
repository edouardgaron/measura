import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import PwaRegister from "@/components/pwa/PwaRegister"
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Measura - Gestion construction",
  description: "Plateforme tout-en-un pour entrepreneurs en construction : CRM, mesures, soumissions, chantiers, facturation.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Measura" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
}

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  )
}
