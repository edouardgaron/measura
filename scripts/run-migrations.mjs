// scripts/run-migrations.mjs
// Exécute des migrations SQL Supabase via une connexion Postgres directe.
// Usage : DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs [005 006 ...]
// Sans argument : exécute les migrations en attente 009 → 014.
// Idempotent (les fichiers utilisent IF NOT EXISTS / DROP ... IF EXISTS).

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIG_DIR = join(__dirname, '..', 'supabase', 'migrations')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌ DATABASE_URL manquante.')
  process.exit(1)
}

// Sélection des migrations
const args = process.argv.slice(2)
const allFiles = readdirSync(MIG_DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort()
let files
if (args.length > 0) {
  files = args.map((p) => allFiles.find((f) => f.startsWith(p))).filter(Boolean)
} else {
  files = allFiles.filter((f) => Number(f.slice(0, 3)) >= 9) // 009 → 014
}

const EXPECTED_TABLES = [
  'work_orders', 'daily_reports', 'time_entries', 'daily_report_materials', 'site_issues', 'deliveries',
  'invoices', 'invoice_items', 'payments', 'leads', 'lead_activities',
  'message_templates', 'messages', 'automation_rules', 'scheduled_messages',
  'schedule_events', 'schedule_assignments', 'employee_certifications',
  'suppliers', 'inventory_items', 'purchase_orders', 'purchase_order_items', 'stock_movements',
  'accounting_connections', 'marketplace_listings', 'rfqs', 'rfq_responses',
]

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

async function main() {
  console.log(`🔌 Connexion à la base…`)
  await client.connect()
  console.log(`✅ Connecté. ${files.length} migration(s) à exécuter :\n   ${files.join('\n   ')}\n`)

  for (const file of files) {
    const sql = readFileSync(join(MIG_DIR, file), 'utf8')
    process.stdout.write(`▶️  ${file} … `)
    try {
      await client.query(sql)
      console.log('OK')
    } catch (e) {
      console.log('ÉCHEC')
      console.error(`   ⚠️  ${e.message}`)
      // Continue : la prochaine peut dépendre, mais on signale
    }
  }

  // Vérification : tables présentes
  const { rows } = await client.query(
    `select table_name from information_schema.tables where table_schema='public' and table_name = any($1)`,
    [EXPECTED_TABLES]
  )
  const present = new Set(rows.map((r) => r.table_name))
  const missing = EXPECTED_TABLES.filter((t) => !present.has(t))

  console.log(`\n📊 Tables présentes : ${present.size}/${EXPECTED_TABLES.length}`)
  if (missing.length) console.log(`   ❌ Manquantes : ${missing.join(', ')}`)
  else console.log('   ✅ Toutes les tables attendues existent.')

  // Vérif RLS active sur un échantillon
  const { rows: rls } = await client.query(
    `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename = any($1)`,
    [['work_orders', 'invoices', 'leads', 'inventory_items', 'marketplace_listings']]
  )
  console.log('\n🔒 RLS :')
  rls.forEach((r) => console.log(`   ${r.tablename}: ${r.rowsecurity ? 'activé' : '❌ DÉSACTIVÉ'}`))

  await client.end()
  console.log('\n🎉 Terminé.')
}

main().catch((e) => { console.error('Erreur fatale:', e.message); process.exit(1) })
