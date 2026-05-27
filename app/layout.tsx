import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Measura - Mesures de bâtiments",
  description: "Application professionnelle de mesure de bâtiments et génération de rapports PDF",
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
      </body>
    </html>
  )
}
