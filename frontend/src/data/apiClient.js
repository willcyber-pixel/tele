/**
 * HTTP transport. The only module in the app that knows fetch exists.
 *
 * Repositories build on this; blocs call repositories; components call
 * neither. Swapping transport (or stubbing it in a test) happens here alone.
 */

export class ApiError extends Error {
  constructor(message, status, url) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
  }
}

const BASE_URL = '/api'

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`

  let response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', ...(options.headers ?? {}) },
      ...options,
    })
  } catch (cause) {
    throw new ApiError(`Network request failed: ${cause.message}`, 0, url)
  }

  if (!response.ok) {
    throw new ApiError(
      `Request failed with ${response.status}`,
      response.status,
      url,
    )
  }

  if (response.status === 204) return null
  return response.json()
}

export const apiClient = {
  get: (path) => request(path),
  post: (path) => request(path, { method: 'POST' }),
  delete: (path) => request(path, { method: 'DELETE' }),
  /** Absolute URL for a browser-initiated download. */
  url: (path) => `${BASE_URL}${path}`,
}
