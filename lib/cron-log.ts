import { createAdminClient } from '@/lib/supabase/admin'

type Handler = (req: Request) => Promise<Response>

async function record(job: string, run: {
  status: 'ok' | 'failed'
  http_status: number | null
  error: string | null
  duration_ms: number
}) {
  // Never allowed to fail the job it is watching. Before admin_01_dashboard.sql
  // is applied the table is simply missing, which is this exact path.
  try {
    const { error } = await (createAdminClient() as any).from('job_runs').insert({ job, ...run })
    if (error) console.error(`[cron-log] ${job}: ${error.message}`)
  } catch (e: any) {
    console.error(`[cron-log] ${job}: ${e?.message}`)
  }
}

/**
 * Records one job_runs row per cron run, for the Daily jobs panel in /admin. A
 * failed cron used to be visible only in the Vercel logs, so nobody saw it.
 *
 * A 401 is somebody hitting the URL without the secret, not a run of the job.
 */
export function withCronLog(job: string, handler: Handler): Handler {
  return async (req) => {
    const started = Date.now()
    try {
      const res = await handler(req)
      if (res.status !== 401) {
        await record(job, {
          status: res.status >= 400 ? 'failed' : 'ok',
          http_status: res.status,
          error: res.status >= 400 ? `HTTP ${res.status}` : null,
          duration_ms: Date.now() - started,
        })
      }
      return res
    } catch (e: any) {
      await record(job, {
        status: 'failed',
        http_status: null,
        error: String(e?.message ?? e).slice(0, 500),
        duration_ms: Date.now() - started,
      })
      throw e
    }
  }
}
