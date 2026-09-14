import { readEnv } from '@rgm/shared'
import { FakeGitHubProvider } from './fake'
import type { GitHubProvider } from './provider'
import { RestGitHubProvider } from './rest'

export type { GitHubProvider, GitHubRepositoryData } from './provider'
export { RestGitHubProvider } from './rest'
export { FakeGitHubProvider, FIXTURES } from './fake'

let provider: GitHubProvider | null = null

/**
 * El proveedor del proceso: el falso con `GITHUB_FAKE=1` (pruebas y
 * desarrollo sin red), el real en cualquier otro caso. Una instancia por
 * proceso para que el bloqueo por rate limit se recuerde entre peticiones.
 */
export function getGitHubProvider(): GitHubProvider {
  if (!provider) {
    const env = readEnv()
    provider = env.GITHUB_FAKE
      ? new FakeGitHubProvider()
      : new RestGitHubProvider({ token: env.GITHUB_TOKEN || undefined })
  }
  return provider
}

/** Solo para pruebas: sustituir el proveedor del proceso. */
export function setGitHubProvider(next: GitHubProvider | null): void {
  provider = next
}
