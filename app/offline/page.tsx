// app/offline/page.tsx — page de repli hors-ligne (PWA)
export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1e3a5f] text-2xl font-bold text-white">M</div>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">Hors ligne</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Vous n’êtes pas connecté à Internet. Vérifiez votre connexion — Measura se rechargera automatiquement une fois en ligne.
      </p>
    </div>
  )
}
