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
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
