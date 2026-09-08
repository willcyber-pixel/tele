import { apiClient } from './apiClient'

/** Reads and writes one attendee's personal schedule. */
export function createScheduleRepository(client = apiClient) {
  return {
    list: (attendeeId) => client.get(`/schedule/${attendeeId}`),
    add: (attendeeId, sessionId) =>
      client.post(`/schedule/${attendeeId}/sessions/${sessionId}`),
    remove: (attendeeId, sessionId) =>
      client.delete(`/schedule/${attendeeId}/sessions/${sessionId}`),
    conflicts: (attendeeId) => client.get(`/schedule/${attendeeId}/conflicts`),
    calendarUrl: (attendeeId) => client.url(`/schedule/${attendeeId}/calendar.ics`),
  }
}

export const scheduleRepository = createScheduleRepository()
