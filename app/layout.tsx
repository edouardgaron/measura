import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import PwaRegister from "@/components/pwa/PwaRegister"
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
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 text-gray-900">
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
      </body>
    </html>
  )
}
