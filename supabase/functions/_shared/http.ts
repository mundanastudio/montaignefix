import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.message === "string" ? body.message : "error")
  }
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function db() {
  return admin().schema("montaigne_fix")
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const value = await req.json()
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isIp(value: string): boolean {
  if (value.length < 3 || value.length > 64) return false
  if (value.includes(",")) return false
  return /^[0-9a-f:.]+$/i.test(value)
}

/** IP del cliente. Cloudflare pisa cf-connecting-ip; el primer X-Forwarded-For lo puede poner el navegador. */
export function clientIp(req: Request): string {
  const cloudflare = req.headers.get("cf-connecting-ip")?.trim() ?? ""
  if (isIp(cloudflare)) return cloudflare
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(isIp)
  return chain[chain.length - 1] ?? "desconocida"
}

export function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() ?? ""
}

export async function handle(req: Request, run: () => Promise<Response>): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors })
  if (req.method !== "POST") return json(405, { ok: false, message: "Método no permitido." })
  try {
    return await run()
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, error.body)
    console.error("edge", error instanceof Error ? error.name : "error")
    return json(500, { ok: false, message: "No se ha podido completar. Inténtalo de nuevo." })
  }
}
