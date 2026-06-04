// scripts/seed-demo.mjs
// Peuple la base avec un jeu de données démo réaliste pour ChantierPro 360.
// Idempotent : utilise des UUID fixes + upsert (onConflict: 'id'), donc
// ré-exécutable sans créer de doublons. Rattache tout au compte propriétaire
// existant (par défaut : 1er utilisateur, ou OWNER_EMAIL en variable d'env).
//
// Usage :
//   node scripts/seed-demo.mjs              (lit .env.local)
//   OWNER_EMAIL=moi@exemple.com node scripts/seed-demo.mjs
//
// Nécessite : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Charge .env.local si présent (sans dépendance dotenv) ───────────────────
const envPath = join(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0 && !line.trim().startsWith('#')) {
      const k = line.slice(0, i).trim()
      const v = line.slice(i + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.')
  process.exit(1)
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

// ── UUID fixes (idempotence) ────────────────────────────────────────────────
const COMPANY = 'd0000000-0000-4000-8000-000000000001'
const EMP = (n) => `d0000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`
const LEAD = (n) => `d0000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`
const PROJ = (n) => `d0000000-0000-4000-8000-0000000003${String(n).padStart(2, '0')}`
const EST = (n) => `d0000000-0000-4000-8000-0000000004${String(n).padStart(2, '0')}`
const REPORT = (n) => `d0000000-0000-4000-8000-0000000005${String(n).padStart(2, '0')}`

const daysAgo = (d) => {
  const dt = new Date('2026-06-04T12:00:00Z')
  dt.setUTCDate(dt.getUTCDate() - d)
  return dt.toISOString().slice(0, 10)
}

async function must(label, promise) {
  const { error } = await promise
  if (error) {
    console.error(`❌ ${label}:`, error.message)
    process.exit(1)
  }
  console.log(`✓ ${label}`)
}

async function main() {
  // 1) Propriétaire
  const { data: usersData } = await sb.auth.admin.listUsers()
  const wanted = process.env.OWNER_EMAIL
  const owner = wanted
    ? usersData?.users?.find((u) => u.email === wanted)
    : usersData?.users?.[0]
  if (!owner) {
    console.error('❌ Aucun utilisateur trouvé. Créez un compte puis relancez.')
    process.exit(1)
  }
  console.log(`👤 Propriétaire : ${owner.email} (${owner.id})`)
  const OWNER = owner.id

  // S'assure que le profil existe (le trigger handle_new_user le crée normalement).
  // profiles.role ∈ {admin, entrepreneur, client} ; le rôle 'owner' vit dans company_members.
  await sb.from('profiles').upsert({ id: OWNER, full_name: 'Édouard Garon', role: 'entrepreneur' }, { onConflict: 'id' })

  // 2) Entreprise démo
  await must('Entreprise', sb.from('companies').upsert({
    id: COMPANY,
    name: 'Construction Démo Inc.',
    owner_id: OWNER,
    phone: '514-555-0142',
    email: 'info@constructiondemo.ca',
    website: 'https://constructiondemo.ca',
    address_line1: '1200 rue Industrielle',
    address_city: 'Laval',
    address_province: 'QC',
    address_postal: 'H7L 4P9',
    address_country: 'CA',
    tax_gst: 0.05, tax_qst: 0.09975,
    default_markup: 0.20, default_labor_rate: 65.00,
    unit_system: 'metric', locale: 'fr',
    subscription_tier: 'pro', is_active: true,
  }, { onConflict: 'id' }))

  await must('Membre propriétaire', sb.from('company_members').upsert({
    company_id: COMPANY, user_id: OWNER, role: 'owner', is_active: true,
    joined_at: new Date('2026-01-15T12:00:00Z').toISOString(),
  }, { onConflict: 'company_id,user_id' }))

  // 3) Employés
  const employees = [
    { id: EMP(1), full_name: 'Marc Tremblay',  role: 'Chef de chantier', email: 'marc@constructiondemo.ca',  phone: '514-555-0111', hourly_cost: 38, hourly_rate: 85 },
    { id: EMP(2), full_name: 'Julie Bouchard',  role: 'Peintre',          email: 'julie@constructiondemo.ca', phone: '514-555-0112', hourly_cost: 28, hourly_rate: 65 },
    { id: EMP(3), full_name: 'David Roy',        role: 'Couvreur',         email: 'david@constructiondemo.ca', phone: '514-555-0113', hourly_cost: 32, hourly_rate: 72 },
    { id: EMP(4), full_name: 'Sophie Lavoie',    role: 'Apprentie',        email: 'sophie@constructiondemo.ca',phone: '514-555-0114', hourly_cost: 22, hourly_rate: 50 },
  ]
  await must('Employés', sb.from('employees').upsert(
    employees.map((e) => ({ ...e, owner_id: OWNER, company_id: COMPANY, is_active: true })),
    { onConflict: 'id' }
  ))

  // 4) Leads (CRM)
  const leads = [
    { id: LEAD(1), name: 'Résidence Côté',        contact_name: 'Pierre Côté',     contact_email: 'p.cote@gmail.com',     contact_phone: '450-555-0201', stage: 'new',        work_type: 'painting', estimated_value: 8500,  priority: 'medium', source: 'website',  address_city: 'Laval' },
    { id: LEAD(2), name: 'Condo Gauthier',         contact_name: 'Marie Gauthier',  contact_email: 'm.gauthier@gmail.com', contact_phone: '514-555-0202', stage: 'contacted',  work_type: 'roofing',  estimated_value: 14200, priority: 'high',   source: 'referral', address_city: 'Montréal' },
    { id: LEAD(3), name: 'Duplex Bergeron',        contact_name: 'Luc Bergeron',    contact_email: 'l.bergeron@gmail.com', contact_phone: '450-555-0203', stage: 'quote_sent', work_type: 'siding',   estimated_value: 22000, priority: 'high',   source: 'phone',    address_city: 'Longueuil' },
    { id: LEAD(4), name: 'Maison Pelletier',       contact_name: 'Anne Pelletier',  contact_email: 'a.pelletier@gmail.com',contact_phone: '514-555-0204', stage: 'won',        work_type: 'painting', estimated_value: 11500, priority: 'medium', source: 'social',   address_city: 'Laval' },
    { id: LEAD(5), name: 'Garage Nadeau',          contact_name: 'Éric Nadeau',     contact_email: 'e.nadeau@gmail.com',   contact_phone: '450-555-0205', stage: 'lost',       work_type: 'repair',   estimated_value: 4800,  priority: 'low',    source: 'walk_in',  address_city: 'Repentigny', lost_reason: 'Budget trop élevé' },
  ]
  await must('Leads CRM', sb.from('leads').upsert(
    leads.map((l, i) => ({ ...l, owner_id: OWNER, company_id: COMPANY, position: i, address_province: 'QC', address_country: 'CA' })),
    { onConflict: 'id' }
  ))

  // 5) Projets
  const projects = [
    { id: PROJ(1), title: 'Peinture extérieure — Maison Pelletier', building_type: 'residential', status: 'measuring',  address_line1: '45 av. des Érables',  address_city: 'Laval',     notes: 'Revêtement bois à repeindre, 2 étages.' },
    { id: PROJ(2), title: 'Réfection toiture — Condo Gauthier',      building_type: 'residential', status: 'review',     address_line1: '880 rue Sherbrooke E', address_city: 'Montréal',  notes: 'Bardeaux d’asphalte, 18 carrés.' },
    { id: PROJ(3), title: 'Revêtement — Duplex Bergeron',            building_type: 'residential', status: 'completed',  address_line1: '12 rue Saint-Charles', address_city: 'Longueuil', notes: 'Déclin de fibrociment, façade + côtés.' },
  ]
  await must('Projets', sb.from('projects').upsert(
    projects.map((p) => ({ ...p, owner_id: OWNER, company_id: COMPANY, address_province: 'QC', address_country: 'CA', unit_system: 'metric' })),
    { onConflict: 'id' }
  ))

  // Relie les leads gagnés aux projets correspondants
  await sb.from('leads').update({ project_id: PROJ(1) }).eq('id', LEAD(4))
  await sb.from('leads').update({ project_id: PROJ(2) }).eq('id', LEAD(2))
  await sb.from('leads').update({ project_id: PROJ(3) }).eq('id', LEAD(3))

  // 6) Estimations + items
  const estimates = [
    { id: EST(1), project_id: PROJ(1), title: 'Estimation — Peinture Pelletier', status: 'accepted', work_type: 'painting',
      labor_cost: 5200, material_cost: 2100, equipment_cost: 400, overhead_cost: 300, markup_percent: 20 },
    { id: EST(2), project_id: PROJ(2), title: 'Estimation — Toiture Gauthier', status: 'sent', work_type: 'roofing',
      labor_cost: 6800, material_cost: 5400, equipment_cost: 900, overhead_cost: 500, markup_percent: 20 },
    { id: EST(3), project_id: PROJ(3), title: 'Estimation — Revêtement Bergeron', status: 'accepted', work_type: 'siding',
      labor_cost: 9200, material_cost: 8600, equipment_cost: 1200, overhead_cost: 700, markup_percent: 18 },
  ]
  for (const e of estimates) {
    const base = e.labor_cost + e.material_cost + e.equipment_cost + e.overhead_cost
    const subtotal = Math.round(base * (1 + e.markup_percent / 100) * 100) / 100
    const tax_gst = Math.round(subtotal * 0.05 * 100) / 100
    const tax_qst = Math.round(subtotal * 0.09975 * 100) / 100
    const total = Math.round((subtotal + tax_gst + tax_qst) * 100) / 100
    await must(`Estimation ${e.title}`, sb.from('estimates').upsert({
      id: e.id, project_id: e.project_id, company_id: COMPANY, created_by: OWNER,
      title: e.title, status: e.status, work_type: e.work_type,
      labor_cost: e.labor_cost, material_cost: e.material_cost, equipment_cost: e.equipment_cost,
      overhead_cost: e.overhead_cost, markup_percent: e.markup_percent,
      subtotal, tax_gst, tax_qst, total, discount_amount: 0,
      valid_until: daysAgo(-30), locale: 'fr',
      notes: 'Estimation générée à titre de démonstration.',
    }, { onConflict: 'id' }))

    // Remplace les items de cette estimation (idempotent)
    await sb.from('estimate_items').delete().eq('estimate_id', e.id)
    await must(`Items ${e.title}`, sb.from('estimate_items').insert([
      { estimate_id: e.id, sort_order: 0, category: 'labor',    description: 'Main-d’œuvre',          quantity: Math.round(e.labor_cost / 65), unit: 'hour', unit_price: 65 },
      { estimate_id: e.id, sort_order: 1, category: 'material', description: 'Matériaux et fournitures', quantity: 1, unit: 'lot', unit_price: e.material_cost },
      { estimate_id: e.id, sort_order: 2, category: 'equipment',description: 'Équipement / location',   quantity: 1, unit: 'lot', unit_price: e.equipment_cost },
    ]))
  }

  // 7) Rapports journaliers + pointages (alimentent la rentabilité réelle)
  const reports = [
    { id: REPORT(1), project_id: PROJ(1), date: daysAgo(2), weather: 'sunny',  temperature: 22, progress: 35, work: 'Lavage à pression et grattage de la façade avant.', crew: [EMP(1), EMP(2), EMP(4)] },
    { id: REPORT(2), project_id: PROJ(1), date: daysAgo(1), weather: 'cloudy', temperature: 18, progress: 55, work: 'Application de l’apprêt sur murs avant et latéral droit.', crew: [EMP(2), EMP(4)] },
    { id: REPORT(3), project_id: PROJ(3), date: daysAgo(5), weather: 'sunny',  temperature: 20, progress: 100, work: 'Pose finale du déclin côté arrière, nettoyage du chantier.', crew: [EMP(1), EMP(3)] },
  ]
  const empCost = Object.fromEntries(employees.map((e) => [e.id, e.hourly_cost]))
  const empName = Object.fromEntries(employees.map((e) => [e.id, e.full_name]))
  for (const r of reports) {
    await must(`Rapport ${r.date}`, sb.from('daily_reports').upsert({
      id: r.id, project_id: r.project_id, company_id: COMPANY, created_by: OWNER,
      report_date: r.date, weather: r.weather, temperature: r.temperature,
      work_performed: r.work, progress_percent: r.progress,
      crew_summary: `${r.crew.length} travailleurs sur place`,
      status: 'submitted',
    }, { onConflict: 'id' }))

    await sb.from('time_entries').delete().eq('daily_report_id', r.id)
    const entries = r.crew.map((eid) => ({
      project_id: r.project_id, daily_report_id: r.id, employee_id: eid,
      employee_name: empName[eid], work_date: r.date,
      clock_in: '07:30', clock_out: '16:00', break_minutes: 30,
      hours: 8, hourly_cost: empCost[eid], created_by: OWNER,
    }))
    await must(`Pointages ${r.date}`, sb.from('time_entries').insert(entries))
  }

  console.log('\n🎉 Jeu de données démo créé. Connectez-vous avec', owner.email, 'pour le voir.')
}

main().catch((e) => { console.error(e); process.exit(1) })
