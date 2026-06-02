// app/(dashboard)/projects/[projectId]/ProjectTabNav.tsx
'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import {
  LayoutDashboard, Camera, Ruler, Box, FileText,
  Settings, Calculator, CheckSquare, Palette,
  FileSignature, ClipboardList, Cpu, HardHat, Hammer, DollarSign, Receipt, Map, Bot, Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Camera, Ruler, Box, FileText,
  Settings, Calculator, CheckSquare, Palette,
  FileSignature, ClipboardList, Cpu, HardHat, Hammer, DollarSign, Receipt, Map, Bot, Clock,
}

interface Tab {
  label: string
  href: string
  icon: string
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
        const Icon = ICON_MAP[tab.icon]
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
