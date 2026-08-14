'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * React Query hooks for the Appointment Engine (M9).
 */

export const appointmentKeys = {
  all: ['appointments'] as const,
  services: () => [...appointmentKeys.all, 'services'] as const,
  resources: () => [...appointmentKeys.all, 'resources'] as const,
  availability: (params: Record<string, string>) =>
    [...appointmentKeys.all, 'availability', params] as const,
  calendar: (from: string, to: string) =>
    [...appointmentKeys.all, 'calendar', from, to] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function sendJson<T>(
  url: string,
  method: 'POST' | 'PATCH',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceAmount: number;
  priceCurrency: string;
};

export type Resource = {
  id: string;
  kind: string;
  name: string;
  userId: string | null;
  rules: { weekday: number; startTime: string; endTime: string }[];
};

export type Appointment = {
  id: string;
  contactId: string;
  serviceId: string;
  resourceId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  notes: string | null;
};

export function useServices() {
  return useQuery({
    queryKey: appointmentKeys.services(),
    queryFn: () => fetchJson<{ services: Service[] }>('/api/appointments/services'),
  });
}

export function useResources() {
  return useQuery({
    queryKey: appointmentKeys.resources(),
    queryFn: () => fetchJson<{ resources: Resource[] }>('/api/appointments/resources'),
  });
}

export function useAvailability(serviceId: string, date: string) {
  return useQuery({
    queryKey: appointmentKeys.availability({ serviceId, date }),
    queryFn: () =>
      fetchJson<{
        slots: { resourceId: string; slots: { startsAt: string; endsAt: string }[] }[];
      }>(
        `/api/appointments/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}&timezone=Asia/Riyadh`,
      ),
    enabled: serviceId.length > 0 && date.length > 0,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: [...appointmentKeys.all, 'detail', id],
    queryFn: () => fetchJson<{ appointment: Appointment }>(`/api/appointments/${id}`),
    enabled: id.length > 0,
  });
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: appointmentKeys.calendar(from, to),
    queryFn: () =>
      fetchJson<{ appointments: Appointment[] }>(
        `/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  });
}

export function useBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      contactId: string;
      serviceId: string;
      resourceId: string;
      startsAt: string;
      timezone: string;
      notes?: string;
    }) => sendJson<{ appointment: Appointment }>('/api/appointments', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sendJson<{ ok: true }>(`/api/appointments/${id}`, 'PATCH', { cancel: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; startsAt: string }) =>
      sendJson<{ appointment: Appointment }>(`/api/appointments/${input.id}`, 'PATCH', {
        startsAt: input.startsAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}
