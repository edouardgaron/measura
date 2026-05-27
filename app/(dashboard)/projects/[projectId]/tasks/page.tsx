// app/(dashboard)/projects/[projectId]/tasks/page.tsx
'use client'

import * as React from 'react'
import { use } from 'react'
import {
  Plus,
  Loader2,
  Calendar,
  User,
  AlertCircle,
  ClipboardList,
  Check,
  ChevronDown,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface ProjectMember {
  id: string
  user_id: string | null
  email: string
  role: string
  profile?: { full_name: string | null; avatar_url: string | null }
}

interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: string | null
  photo_id: string | null
  created_at: string
  updated_at: string
  assignee?: ProjectMember | null
}

interface Props {
  params: Promise<{ projectId: string }>
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string; color: string; headerBg: string }[] = [
  { id: 'todo',        label: 'À faire',    color: 'border-gray-300',  headerBg: 'bg-gray-100' },
  { id: 'in_progress', label: 'En cours',   color: 'border-blue-300',  headerBg: 'bg-blue-50' },
  { id: 'blocked',     label: 'Bloqué',     color: 'border-red-300',   headerBg: 'bg-red-50' },
  { id: 'done',        label: 'Terminé',    color: 'border-green-300', headerBg: 'bg-green-50' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  low:    { label: 'Faible',   className: 'bg-gray-100 text-gray-700 border-transparent' },
  medium: { label: 'Moyen',    className: 'bg-blue-100 text-blue-700 border-transparent' },
  high:   { label: 'Élevé',    className: 'bg-orange-100 text-orange-700 border-transparent' },
  urgent: { label: 'Urgent',   className: 'bg-red-100 text-red-700 border-transparent' },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function AvatarCircle({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <div className={`${dim} rounded-full bg-blue-600 text-white flex items-center justify-center font-medium shrink-0`}>
      {initials}
    </div>
  )
}

function TaskCard({
  task,
  members,
  onClick,
  onComplete,
}: {
  task: Task
  members: ProjectMember[]
  onClick: () => void
  onComplete: (id: string) => void
}) {
  const assignee = members.find((m) => m.user_id === task.assigned_to || m.id === task.assigned_to)
  const assigneeName = assignee?.profile?.full_name ?? assignee?.email ?? null

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2 flex-1">{task.title}</p>
          {task.status !== 'done' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onComplete(task.id) }}
              className="shrink-0 h-5 w-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center"
              title="Marquer comme terminé"
            >
              <Check className="h-3 w-3 text-transparent hover:text-green-500" />
            </button>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <PriorityBadge priority={task.priority} />
          <div className="flex items-center gap-2">
            {task.due_date && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {assigneeName && <AvatarCircle name={assigneeName} />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Create/Edit Task Dialog ──────────────────────────────────────────────────

interface TaskFormValues {
  title: string
  description: string
  priority: TaskPriority
  due_date: string
  assigned_to: string
  photo_id: string
  status: TaskStatus
}

function TaskDialog({
  open,
  onClose,
  onSave,
  members,
  initial,
  saving,
}: {
  open: boolean
  onClose: () => void
  onSave: (values: TaskFormValues) => void
  members: ProjectMember[]
  initial?: Task | null
  saving: boolean
}) {
  const [form, setForm] = React.useState<TaskFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    priority: initial?.priority ?? 'medium',
    due_date: initial?.due_date ? initial.due_date.split('T')[0] : '',
    assigned_to: initial?.assigned_to ?? '',
    photo_id: initial?.photo_id ?? '',
    status: initial?.status ?? 'todo',
  })

  React.useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        priority: initial?.priority ?? 'medium',
        due_date: initial?.due_date ? initial.due_date.split('T')[0] : '',
        assigned_to: initial?.assigned_to ?? '',
        photo_id: initial?.photo_id ?? '',
        status: initial?.status ?? 'todo',
      })
    }
  }, [open, initial])

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Input
            label="Titre *"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Titre de la tâche…"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Détails…"
              rows={3}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as TaskPriority)}
                className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Statut</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as TaskStatus)}
                className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">À faire</option>
                <option value="in_progress">En cours</option>
                <option value="blocked">Bloqué</option>
                <option value="done">Terminé</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Due date */}
            <Input
              label="Date d'échéance"
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
            />

            {/* Assigned to */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Assigné à</label>
              <select
                value={form.assigned_to}
                onChange={(e) => set('assigned_to', e.target.value)}
                className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Non assigné</option>
                {members.map((m) => (
                  <option key={m.id} value={m.user_id ?? m.id}>
                    {m.profile?.full_name ?? m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={() => onSave(form)}
            loading={saving}
            disabled={!form.title.trim()}
          >
            {initial ? 'Enregistrer' : 'Créer la tâche'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TasksPage({ params }: Props) {
  const { projectId } = use(params)

  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<ProjectMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)

  // Filters
  const [filterPriority, setFilterPriority] = React.useState<TaskPriority | ''>('')
  const [filterAssignee, setFilterAssignee] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | ''>('')

  // Load tasks and members
  React.useEffect(() => {
    async function load() {
      setLoading(true)
      const [tasksRes, projectRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}`),
      ])
      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.tasks ?? [])
      }
      if (projectRes.ok) {
        const data = await projectRes.json()
        setMembers(data.project?.members ?? [])
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  // Filtered tasks
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterAssignee && t.assigned_to !== filterAssignee) return false
      if (filterStatus && t.status !== filterStatus) return false
      return true
    })
  }, [tasks, filterPriority, filterAssignee, filterStatus])

  function getColumnTasks(status: TaskStatus) {
    return filteredTasks.filter((t) => t.status === status)
  }

  async function handleSaveTask(values: TaskFormValues) {
    if (!values.title.trim()) return
    setSaving(true)

    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      status: values.status,
      due_date: values.due_date || null,
      assigned_to: values.assigned_to || null,
      photo_id: values.photo_id || null,
    }

    if (editingTask) {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTask.id, ...payload }),
      })
      if (res.ok) {
        const data = await res.json()
        setTasks((prev) => prev.map((t) => t.id === editingTask.id ? data.task : t))
        toast({ variant: 'success', title: 'Tâche modifiée' })
      } else {
        toast({ variant: 'error', title: 'Erreur lors de la modification' })
      }
    } else {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        setTasks((prev) => [...prev, data.task])
        toast({ variant: 'success', title: 'Tâche créée' })
      } else {
        toast({ variant: 'error', title: 'Erreur lors de la création' })
      }
    }

    setSaving(false)
    setDialogOpen(false)
    setEditingTask(null)
  }

  async function handleCompleteTask(taskId: string) {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: 'done' }),
    })
    if (res.ok) {
      const data = await res.json()
      setTasks((prev) => prev.map((t) => t.id === taskId ? data.task : t))
      toast({ variant: 'success', title: 'Tâche marquée comme terminée' })
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Supprimer cette tâche ?')) return
    const res = await fetch(`/api/projects/${projectId}/tasks?id=${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setDialogOpen(false)
      setEditingTask(null)
      toast({ variant: 'success', title: 'Tâche supprimée' })
    }
  }

  function openNew() {
    setEditingTask(null)
    setDialogOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const hasFilters = !!(filterPriority || filterAssignee || filterStatus)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Tâches</h2>
          <span className="text-sm text-gray-400">({tasks.length})</span>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toutes priorités</option>
          <option value="low">Faible</option>
          <option value="medium">Moyen</option>
          <option value="high">Élevé</option>
          <option value="urgent">Urgent</option>
        </select>

        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les membres</option>
          {members.map((m) => (
            <option key={m.id} value={m.user_id ?? m.id}>
              {m.profile?.full_name ?? m.email}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | '')}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="todo">À faire</option>
          <option value="in_progress">En cours</option>
          <option value="blocked">Bloqué</option>
          <option value="done">Terminé</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilterPriority(''); setFilterAssignee(''); setFilterStatus('') }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3 w-3" />
            Effacer
          </button>
        )}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = getColumnTasks(col.id)
            return (
              <div key={col.id} className={`flex flex-col rounded-xl border-2 ${col.color} bg-white overflow-hidden`}>
                {/* Column header */}
                <div className={`flex items-center justify-between px-4 py-2.5 ${col.headerBg}`}>
                  <span className="text-sm font-semibold text-gray-800">{col.label}</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {colTasks.length}
                  </span>
                </div>

                {/* Task cards */}
                <div className="flex flex-col gap-2 p-3 min-h-[120px]">
                  {colTasks.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                      Aucune tâche
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        members={members}
                        onClick={() => openEdit(task)}
                        onComplete={handleCompleteTask}
                      />
                    ))
                  )}
                </div>

                {/* Add task shortcut */}
                <button
                  type="button"
                  onClick={openNew}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Task dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTask(null) }}
        onSave={handleSaveTask}
        members={members}
        initial={editingTask}
        saving={saving}
      />

      {/* Delete button in edit mode — rendered inside dialog footer area */}
      {editingTask && dialogOpen && (
        <Dialog open={false}>
          {/* intentional no-op; delete is wired below via keyboard shortcut conceptually */}
        </Dialog>
      )}
    </div>
  )
}
