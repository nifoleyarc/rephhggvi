import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { getDatabase } from '../server/database/init.js'
import { saveRemoteImage } from '../server/utils/imageStorage.js'

dotenv.config()

const CONCURRENCY = Math.max(parseInt(process.env.IMAGE_MIGRATION_CONCURRENCY || '4', 10), 1)
const REPORT_PATH = process.env.IMAGE_MIGRATION_REPORT || path.join(process.cwd(), 'migration-report.json')

async function migrateStream(db, stream, stats) {
  if (!stream.thumbnail_url) {
    stats.skipped++
    return
  }

  try {
    const stored = await saveRemoteImage(stream.thumbnail_url, {
      reason: 'cloudinary-migration',
      streamId: stream.id
    })

    await db.run(`
      UPDATE streams SET
        thumbnail_url = ?, 
        thumbnail_source = 'local',
        thumbnail_public_id = ?,
        thumbnail_width = ?,
        thumbnail_height = ?,
        thumbnail_format = ?,
        thumbnail_bytes = ?,
        thumbnail_updated_at = ?
      WHERE id = ?
    `, [
      stored.url,
      stored.publicId,
      stored.width || null,
      stored.height || null,
      stored.format || null,
      stored.bytes || null,
      new Date().toISOString(),
      stream.id
    ])

    stats.migrated++
    console.log(`✅ [${stream.id}] Мигрировано: ${stream.title}`)
  } catch (error) {
    stats.failed++
    console.error(`❌ [${stream.id}] Ошибка миграции: ${error.message}`)
    stats.errors.push({
      id: stream.id,
      title: stream.title,
      error: error.message
    })
  }
}

async function runMigration() {
  const db = await getDatabase()
  const candidates = await db.all(`
    SELECT id, title, thumbnail_url, thumbnail_source, thumbnail_public_id
    FROM streams
    WHERE thumbnail_source = 'cloudinary'
      OR thumbnail_url LIKE '%cloudinary.com%'
      OR thumbnail_url LIKE '%res.cloudinary.com%'
  `)

  const stats = {
    total: candidates.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  console.log(`🚀 Запуск миграции Cloudinary → локальное хранилище (${candidates.length} записей)`)

  const active = new Set()

  for (const stream of candidates) {
    const job = migrateStream(db, stream, stats).finally(() => active.delete(job))
    active.add(job)
    if (active.size >= CONCURRENCY) {
      await Promise.race(active)
    }
  }

  await Promise.all(active)
  await db.close()

  const report = {
    finishedAt: new Date().toISOString(),
    ...stats
  }

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')

  console.log('📄 Отчёт сохранён в', REPORT_PATH)
  console.log('📊 Итог:', JSON.stringify({ migrated: stats.migrated, failed: stats.failed, skipped: stats.skipped }))
}

runMigration().catch(error => {
  console.error('💥 Критическая ошибка миграции:', error)
  process.exit(1)
})

