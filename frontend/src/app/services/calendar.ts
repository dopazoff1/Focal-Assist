import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { ServerStateService } from './server-state';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
export type CalendarEventKind = 'meeting' | 'focus' | 'handover' | 'training' | 'launch' | 'personal';
export type CalendarAttendeeStatus = 'pending' | 'accepted' | 'tentative' | 'declined';
export type CalendarEventVisibility = 'team' | 'private' | 'invite_only';
export type CalendarRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarDefinition {
  id: string;
  label: string;
  color: string;
  accent: string;
  description: string;
}

export interface CalendarAttendee {
  userId: number;
  name: string;
  email: string;
  role: string;
  status: CalendarAttendeeStatus;
  optional: boolean;
}

export interface CalendarEvent {
  id: number;
  seriesId: string | null;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  meetingLink: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  kind: CalendarEventKind;
  visibility: CalendarEventVisibility;
  recurrence: CalendarRecurrence;
  organizerId: number;
  organizerName: string;
  attendees: CalendarAttendee[];
  reminders: string[];
  agenda: string;
  notes: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface CalendarState {
  events: CalendarEvent[];
  nextEventId: number;
}

export interface CalendarEventInput {
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  meetingLink?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  kind: CalendarEventKind;
  visibility: CalendarEventVisibility;
  recurrence: CalendarRecurrence;
  recurrenceCount?: number;
  organizerId: number;
  organizerName: string;
  attendees: CalendarAttendee[];
  reminders?: string[];
  agenda?: string;
  notes?: string;
  color?: string;
}

export const ORBIT_CALENDARS: CalendarDefinition[] = [
  {
    id: 'ops',
    label: 'Ops Bridge',
    color: '#2563eb',
    accent: 'rgba(37, 99, 235, 0.14)',
    description: 'Daily support operations, live floor control, and staffing rituals.'
  },
  {
    id: 'people',
    label: 'People Rhythm',
    color: '#16a34a',
    accent: 'rgba(22, 163, 74, 0.14)',
    description: '1:1s, hiring panels, coaching, and team ceremonies.'
  },
  {
    id: 'training',
    label: 'Academy',
    color: '#7c3aed',
    accent: 'rgba(124, 58, 237, 0.14)',
    description: 'Training blocks, enablement windows, and launch rehearsals.'
  },
  {
    id: 'delivery',
    label: 'Launch Lane',
    color: '#f97316',
    accent: 'rgba(249, 115, 22, 0.14)',
    description: 'Projects, milestones, deployments, and release checkpoints.'
  },
  {
    id: 'personal',
    label: 'Personal Focus',
    color: '#0f172a',
    accent: 'rgba(15, 23, 42, 0.10)',
    description: 'Deep work, private reminders, and personal planning.'
  }
];

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly storageKey = 'orbit_calendar_state_v1';
  private readonly state$ = new BehaviorSubject<CalendarState>(this.seedState());
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight = false;
  private pendingPersist = false;

  constructor(private serverState: ServerStateService) {
    if (typeof window === 'undefined') return;
    this.serverState.loadState<CalendarState>(this.storageKey).subscribe({
      next: (remote) => {
        if (remote) {
          this.state$.next(this.normalizeState(remote));
          return;
        }
        this.schedulePersist();
      },
      error: () => {
        // Keep seeded in-memory state if server load fails.
      }
    });
  }

  readonly events$ = this.state$.asObservable().pipe(map(state => state.events));

  get events(): CalendarEvent[] {
    return this.state$.value.events;
  }

  get calendars(): CalendarDefinition[] {
    return ORBIT_CALENDARS;
  }

  createEvent(input: CalendarEventInput): CalendarEvent[] {
    const state = this.state$.value;
    const calendar = this.resolveCalendar(input.calendarId);
    const now = new Date().toISOString();
    const recurrenceCount = Math.max(1, Number(input.recurrenceCount || 1));
    const seriesId = input.recurrence === 'none'
      ? null
      : `SER-${state.nextEventId}-${Date.now()}`;

    const occurrences = this.buildOccurrences(
      input.startAt,
      input.endAt,
      input.recurrence,
      recurrenceCount
    );

    const created = occurrences.map((occurrence, index) => ({
      id: state.nextEventId + index,
      seriesId,
      calendarId: calendar.id,
      title: (input.title || '').trim(),
      description: (input.description || '').trim(),
      location: (input.location || '').trim(),
      meetingLink: (input.meetingLink || '').trim(),
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      allDay: !!input.allDay,
      kind: input.kind,
      visibility: input.visibility,
      recurrence: input.recurrence,
      organizerId: Number(input.organizerId || 0),
      organizerName: (input.organizerName || '').trim() || 'Organizer',
      attendees: this.normalizeAttendees(input.attendees || [], Number(input.organizerId || 0), input.organizerName || 'Organizer'),
      reminders: this.normalizeReminders(input.reminders || []),
      agenda: (input.agenda || '').trim(),
      notes: (input.notes || '').trim(),
      color: (input.color || calendar.color || '#2563eb').trim(),
      createdAt: now,
      updatedAt: now
    } satisfies CalendarEvent));

    this.commit({
      ...state,
      events: this.sortEvents([...state.events, ...created]),
      nextEventId: state.nextEventId + created.length
    });

    return created;
  }

  updateEvent(eventId: number, patch: Partial<CalendarEvent>): CalendarEvent | null {
    const state = this.state$.value;
    let updated: CalendarEvent | null = null;
    const events = state.events.map(event => {
      if (event.id !== eventId) return event;

      const calendar = this.resolveCalendar(String(patch.calendarId || event.calendarId));
      updated = {
        ...event,
        ...patch,
        calendarId: calendar.id,
        attendees: this.normalizeAttendees(
          Array.isArray(patch.attendees) ? patch.attendees : event.attendees,
          Number(patch.organizerId ?? event.organizerId),
          String(patch.organizerName ?? event.organizerName)
        ),
        reminders: this.normalizeReminders(Array.isArray(patch.reminders) ? patch.reminders : event.reminders),
        color: String(patch.color || event.color || calendar.color),
        updatedAt: new Date().toISOString()
      };
      return updated;
    });

    this.commit({ ...state, events: this.sortEvents(events) });
    return updated;
  }

  duplicateEvent(eventId: number, dayOffset = 1): CalendarEvent | null {
    const event = this.events.find(item => item.id === eventId);
    if (!event) return null;

    const created = this.createEvent({
      calendarId: event.calendarId,
      title: `${event.title} (copy)`,
      description: event.description,
      location: event.location,
      meetingLink: event.meetingLink,
      startAt: addDays(event.startAt, dayOffset),
      endAt: addDays(event.endAt, dayOffset),
      allDay: event.allDay,
      kind: event.kind,
      visibility: event.visibility,
      recurrence: 'none',
      recurrenceCount: 1,
      organizerId: event.organizerId,
      organizerName: event.organizerName,
      attendees: event.attendees,
      reminders: event.reminders,
      agenda: event.agenda,
      notes: event.notes,
      color: event.color
    });

    return created[0] || null;
  }

  deleteEvent(eventId: number): void {
    const state = this.state$.value;
    this.commit({
      ...state,
      events: state.events.filter(event => event.id !== eventId)
    });
  }

  setAttendeeStatus(eventId: number, userId: number, status: CalendarAttendeeStatus): CalendarEvent | null {
    const state = this.state$.value;
    let updated: CalendarEvent | null = null;
    const events = state.events.map(event => {
      if (event.id !== eventId) return event;
      updated = {
        ...event,
        attendees: event.attendees.map(attendee =>
          attendee.userId === userId
            ? { ...attendee, status }
            : attendee
        ),
        updatedAt: new Date().toISOString()
      };
      return updated;
    });
    this.commit({ ...state, events: this.sortEvents(events) });
    return updated;
  }

  private commit(state: CalendarState): void {
    this.state$.next(this.normalizeState(state));
    this.schedulePersist();
  }

  private normalizeState(raw: Partial<CalendarState> | null | undefined): CalendarState {
    const parsed = raw as CalendarState | null | undefined;
    if (!parsed || !Array.isArray(parsed.events)) {
      return this.seedState();
    }
    const maxId = parsed.events.reduce((max, item) => Math.max(max, Number(item?.id || 0)), 0);
    const nextEventId = Number.isFinite(Number(parsed.nextEventId))
      ? Math.max(Number(parsed.nextEventId), maxId + 1)
      : maxId + 1;
    return {
      nextEventId,
      events: this.sortEvents((parsed.events || []).map(event => this.normalizeEvent(event as CalendarEvent)))
    };
  }

  private schedulePersist(): void {
    if (typeof window === 'undefined') return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistState();
    }, 120);
  }

  private persistState(): void {
    if (this.persistInFlight) {
      this.pendingPersist = true;
      return;
    }
    this.persistInFlight = true;
    const snapshot = this.normalizeState(this.state$.value);
    this.serverState.saveState(this.storageKey, snapshot).subscribe({
      next: () => {},
      error: () => {},
      complete: () => {
        this.persistInFlight = false;
        if (this.pendingPersist) {
          this.pendingPersist = false;
          this.schedulePersist();
        }
      }
    });
  }

  private seedState(): CalendarState {
    const today = new Date();
    const standupStart = setTime(today, 9, 30);
    const standupEnd = setTime(today, 10, 0);
    const focusStart = setTime(addDaysDate(today, 1), 14, 0);
    const focusEnd = setTime(addDaysDate(today, 1), 16, 0);
    const launchStart = setTime(addDaysDate(today, 2), 11, 0);
    const launchEnd = setTime(addDaysDate(today, 2), 12, 30);
    const trainingStart = setTime(addDaysDate(today, 4), 15, 0);
    const trainingEnd = setTime(addDaysDate(today, 4), 17, 0);
    const now = new Date().toISOString();

    return {
      nextEventId: 5,
      events: this.sortEvents([
        {
          id: 1,
          seriesId: null,
          calendarId: 'ops',
          title: 'Support floor standup',
          description: 'Queue load, risk tickets, and ownership alignment for the day.',
          location: 'Ops pod',
          meetingLink: '',
          startAt: standupStart.toISOString(),
          endAt: standupEnd.toISOString(),
          allDay: false,
          kind: 'meeting',
          visibility: 'team',
          recurrence: 'none',
          organizerId: 1,
          organizerName: 'Ops Control',
          attendees: [],
          reminders: ['15m'],
          agenda: 'Volume, staffing, escalations, launch risks.',
          notes: 'Keep this short and tactical.',
          color: '#2563eb',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 2,
          seriesId: null,
          calendarId: 'personal',
          title: 'Focus block: article cleanup',
          description: 'Rewrite top friction KB articles and remove stale SOP steps.',
          location: '',
          meetingLink: '',
          startAt: focusStart.toISOString(),
          endAt: focusEnd.toISOString(),
          allDay: false,
          kind: 'focus',
          visibility: 'private',
          recurrence: 'none',
          organizerId: 1,
          organizerName: 'You',
          attendees: [],
          reminders: ['5m'],
          agenda: 'Clean structure, shorten intros, improve search terms.',
          notes: '',
          color: '#0f172a',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 3,
          seriesId: null,
          calendarId: 'delivery',
          title: 'Launch readiness review',
          description: 'Final gate before rollout, covering comms, support playbook, and escalation plan.',
          location: 'War room A',
          meetingLink: 'https://meet.google.com/demo-launch',
          startAt: launchStart.toISOString(),
          endAt: launchEnd.toISOString(),
          allDay: false,
          kind: 'launch',
          visibility: 'team',
          recurrence: 'none',
          organizerId: 1,
          organizerName: 'Delivery Office',
          attendees: [],
          reminders: ['30m', '5m'],
          agenda: 'Readiness, rollback owner, staffing coverage, FAQ sign-off.',
          notes: 'Treat open high-priority risks as blockers.',
          color: '#f97316',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 4,
          seriesId: null,
          calendarId: 'training',
          title: 'New agent calibration',
          description: 'Review QA patterns and align on handling expectations.',
          location: 'Academy lab',
          meetingLink: '',
          startAt: trainingStart.toISOString(),
          endAt: trainingEnd.toISOString(),
          allDay: false,
          kind: 'training',
          visibility: 'invite_only',
          recurrence: 'none',
          organizerId: 1,
          organizerName: 'Academy',
          attendees: [],
          reminders: ['1h'],
          agenda: 'Calibration examples, escalation thresholds, response writing.',
          notes: '',
          color: '#7c3aed',
          createdAt: now,
          updatedAt: now
        }
      ])
    };
  }

  private normalizeEvent(raw: CalendarEvent): CalendarEvent {
    const calendar = this.resolveCalendar(raw?.calendarId);
    return {
      id: Number(raw?.id || 0),
      seriesId: raw?.seriesId ? String(raw.seriesId) : null,
      calendarId: calendar.id,
      title: String(raw?.title || '').trim(),
      description: String(raw?.description || '').trim(),
      location: String(raw?.location || '').trim(),
      meetingLink: String(raw?.meetingLink || '').trim(),
      startAt: String(raw?.startAt || new Date().toISOString()),
      endAt: String(raw?.endAt || new Date().toISOString()),
      allDay: !!raw?.allDay,
      kind: this.normalizeKind(raw?.kind),
      visibility: this.normalizeVisibility(raw?.visibility),
      recurrence: this.normalizeRecurrence(raw?.recurrence),
      organizerId: Number(raw?.organizerId || 0),
      organizerName: String(raw?.organizerName || '').trim() || 'Organizer',
      attendees: this.normalizeAttendees(raw?.attendees || [], Number(raw?.organizerId || 0), String(raw?.organizerName || '').trim() || 'Organizer'),
      reminders: this.normalizeReminders(raw?.reminders || []),
      agenda: String(raw?.agenda || '').trim(),
      notes: String(raw?.notes || '').trim(),
      color: String(raw?.color || calendar.color || '#2563eb'),
      createdAt: String(raw?.createdAt || new Date().toISOString()),
      updatedAt: String(raw?.updatedAt || new Date().toISOString())
    };
  }

  private normalizeAttendees(raw: CalendarAttendee[], organizerId: number, organizerName: string): CalendarAttendee[] {
    const byId = new Map<number, CalendarAttendee>();
    for (const attendee of Array.isArray(raw) ? raw : []) {
      const userId = Number(attendee?.userId || 0);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      byId.set(userId, {
        userId,
        name: String(attendee?.name || '').trim() || `User ${userId}`,
        email: String(attendee?.email || '').trim(),
        role: String(attendee?.role || 'AGENT').trim().toUpperCase(),
        status: this.normalizeAttendeeStatus(attendee?.status),
        optional: !!attendee?.optional
      });
    }

    if (organizerId > 0 && !byId.has(organizerId)) {
      byId.set(organizerId, {
        userId: organizerId,
        name: organizerName || 'Organizer',
        email: '',
        role: 'OWNER',
        status: 'accepted',
        optional: false
      });
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private normalizeReminders(raw: string[]): string[] {
    const allowed = new Set(['none', '5m', '15m', '30m', '1h', '1d']);
    const normalized = (Array.isArray(raw) ? raw : [])
      .map(item => String(item || '').trim())
      .filter(item => allowed.has(item));
    return normalized.length ? [...new Set(normalized)] : ['15m'];
  }

  private sortEvents(events: CalendarEvent[]): CalendarEvent[] {
    return [...events].sort((left, right) => {
      const byStart = String(left.startAt).localeCompare(String(right.startAt));
      if (byStart !== 0) return byStart;
      return left.title.localeCompare(right.title);
    });
  }

  private resolveCalendar(calendarId: string): CalendarDefinition {
    return ORBIT_CALENDARS.find(item => item.id === calendarId) || ORBIT_CALENDARS[0];
  }

  private normalizeKind(kind: unknown): CalendarEventKind {
    const value = String(kind || '').trim().toLowerCase();
    if (value === 'focus' || value === 'handover' || value === 'training' || value === 'launch' || value === 'personal') {
      return value;
    }
    return 'meeting';
  }

  private normalizeVisibility(value: unknown): CalendarEventVisibility {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'private' || normalized === 'invite_only') {
      return normalized;
    }
    return 'team';
  }

  private normalizeRecurrence(value: unknown): CalendarRecurrence {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly') {
      return normalized;
    }
    return 'none';
  }

  private normalizeAttendeeStatus(value: unknown): CalendarAttendeeStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'accepted' || normalized === 'tentative' || normalized === 'declined') {
      return normalized;
    }
    return 'pending';
  }

  private buildOccurrences(
    startAt: string,
    endAt: string,
    recurrence: CalendarRecurrence,
    count: number
  ): Array<{ startAt: string; endAt: string }> {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return [];
    }

    const items: Array<{ startAt: string; endAt: string }> = [];
    for (let index = 0; index < count; index += 1) {
      const occurrenceStart = shiftDate(start, recurrence, index);
      const occurrenceEnd = shiftDate(end, recurrence, index);
      items.push({
        startAt: occurrenceStart.toISOString(),
        endAt: occurrenceEnd.toISOString()
      });
      if (recurrence === 'none') break;
    }
    return items;
  }
}

function shiftDate(base: Date, recurrence: CalendarRecurrence, index: number): Date {
  const next = new Date(base);
  if (recurrence === 'daily') next.setDate(next.getDate() + index);
  if (recurrence === 'weekly') next.setDate(next.getDate() + (index * 7));
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + index);
  return next;
}

function addDays(iso: string, days: number): string {
  const next = new Date(iso);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function addDaysDate(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(base: Date, hours: number, minutes: number): Date {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}
