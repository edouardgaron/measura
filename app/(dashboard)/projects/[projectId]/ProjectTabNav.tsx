// app/(dashboard)/projects/[projectId]/ProjectTabNav.tsx
'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface Tab {
  label: string
  href: string
  icon: LucideIcon
  segment: string | null
}

interface Props {
  tabs: Tab[]
}

export default function ProjectTabNav({ tabs }: Props) {
  const segment = useSelectedLayoutSegment()

  return (
    <nav
      className="-mb-px flex gap-1 overflow-x-auto"
      aria-label="Navigation du projet"
    >
      {tabs.map((tab) => {
        const isActive = tab.segment === segment
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
