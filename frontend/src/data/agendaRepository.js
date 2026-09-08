import { apiClient } from './apiClient'

/**
 * Reads the agenda and the "who else is going" rosters.
 * Returns plain data; no React, no state.
 */
export function createAgendaRepository(client = apiClient) {
  return {
    listSessions: () => client.get('/sessions'),

    /**
     * Rosters for many sessions in one call. Fetching per card would fire
     * ~36 requests to paint a single day.
     */
    listAttendeesBySession: (sessionIds) => {
      if (sessionIds.length === 0) return Promise.resolve({})
      return client.get(`/attendees/by-session?ids=${sessionIds.join(',')}`)
    },
  }
}

export const agendaRepository = createAgendaRepository()
