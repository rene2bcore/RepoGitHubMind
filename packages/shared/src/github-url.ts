import { InvalidGitHubUrlError } from './errors'

export type GitHubRef = { owner: string; name: string; fullName: string }

const OWNER_OR_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/

/**
 * Convierte cualquier variante de una URL de repositorio de GitHub en
 * `owner/name`, en minúsculas (prompt maestro §30).
 *
 * Acepta con o sin protocolo, con `www.`, con `/` final, con `.git`, con
 * query o fragmento, y con rutas más largas (`/tree/main/...`), de las que
 * solo importan los dos primeros segmentos. Rechaza todo lo que no sea
 * `github.com`: el sistema nunca sigue una URL del usuario, solo llama a
 * `api.github.com` con el `owner/name` extraído.
 *
 * Se normaliza a minúsculas porque GitHub no distingue mayúsculas en owner ni
 * en name, y un mismo repositorio escrito de dos formas terminaría en dos
 * filas si no.
 */
export function parseGitHubUrl(input: string): GitHubRef {
  const raw = input.trim()
  if (!raw) throw new InvalidGitHubUrlError()

  const withProtocol = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    throw new InvalidGitHubUrlError()
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'github.com') throw new InvalidGitHubUrlError()

  const segments = url.pathname.split('/').filter(Boolean)
  const [ownerRaw, nameRaw] = segments
  if (!ownerRaw || !nameRaw) throw new InvalidGitHubUrlError()

  const owner = ownerRaw.toLowerCase()
  const name = nameRaw.toLowerCase().replace(/\.git$/, '')
  if (!OWNER_OR_NAME.test(owner) || !OWNER_OR_NAME.test(name)) throw new InvalidGitHubUrlError()

  return { owner, name, fullName: `${owner}/${name}` }
}

/** Todas las URLs de GitHub que haya en un texto, deduplicadas y normalizadas. */
export function extractGitHubRefs(text: string): { refs: GitHubRef[]; invalid: number } {
  const candidates = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s<>"')\]]+/gi) ?? []
  const seen = new Map<string, GitHubRef>()
  let invalid = 0
  for (const candidate of candidates) {
    try {
      const ref = parseGitHubUrl(candidate)
      if (!seen.has(ref.fullName)) seen.set(ref.fullName, ref)
    } catch {
      invalid += 1
    }
  }
  return { refs: [...seen.values()], invalid }
}
