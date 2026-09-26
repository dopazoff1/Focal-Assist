import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { getActiveLocale } from '../../utils/locale';
import {
  CalendarAttendee,
  CalendarAttendeeStatus,
  CalendarEvent,
  CalendarEventInput,
  CalendarEventKind,
  CalendarEventVisibility,
  CalendarRecurrence,
  CalendarService,
  CalendarViewMode,
  ORBIT_CALENDARS
} from '../../services/calendar';
import { CollaborationCurrentUser, CollaborationService } from '../../services/collaboration';
import { StaffService } from '../../services/staff';

interface CalendarPerson {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  active: boolean;
}

interface CalendarDraft {
  id: number | null;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  meetingLink: string;
  startAtLocal: string;
  endAtLocal: string;
  allDay: boolean;
  kind: CalendarEventKind;
  visibility: CalendarEventVisibility;
  recurrence: CalendarRecurrence;
  recurrenceCount: number;
  attendeeIds: number[];
  optionalAttendeeIds: number[];
  reminders: string[];
  agenda: string;
  notes: string;
  color: string;
}

interface CalendarTemplate {
  id: string;
  label: string;
  subtitle: string;
  calendarId: string;
  kind: CalendarEventKind;
  durationMinutes: number;
  visibility: CalendarEventVisibility;
  reminders: string[];
  title: string;
  description: string;
  agenda: string;
}

interface CalendarDayCell {
  date: Date;
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
}

interface CalendarTimelineEvent {
  source: CalendarEvent;
  top: number;
  height: number;
  timeLabel: string;
}

interface CalendarTimelineColumn {
  date: Date;
  iso: string;
  label: string;
  isToday: boolean;
  allDayEvents: CalendarEvent[];
  timedEvents: CalendarTimelineEvent[];
}

interface CalendarAgendaGroup {
  date: Date;
  label: string;
  events: CalendarEvent[];
}

interface CalendarSuggestion {
  label: string;
  startAtLocal: string;
  endAtLocal: string;
  freeAttendees: number;
  conflictCount: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideChevronLeft, LucideChevronRight],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  readonly calendarDefs = ORBIT_CALENDARS;
  readonly viewModes: CalendarViewMode[] = ['month', 'week', 'day', 'agenda'];
  readonly reminderOptions = ['none', '5m', '15m', '30m', '1h', '1d'];
  readonly kindOptions: Array<{ value: CalendarEventKind; label: string }> = [
    { value: 'meeting', label: 'Meeting' },
    { value: 'focus', label: 'Focus' },
    { value: 'handover', label: 'Handover' },
    { value: 'training', label: 'Training' },
    { value: 'launch', label: 'Launch' },
    { value: 'personal', label: 'Personal' }
  ];
  readonly visibilityOptions: Array<{ value: CalendarEventVisibility; label: string }> = [
    { value: 'team', label: 'Team visible' },
    { value: 'invite_only', label: 'Invite only' },
    { value: 'private', label: 'Private' }
  ];
  readonly recurrenceOptions: Array<{ value: CalendarRecurrence; label: string }> = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];
  readonly templates: CalendarTemplate[] = [
    {
      id: 'standup',
      label: 'Floor standup',
      subtitle: '15 min live operations sync',
      calendarId: 'ops',
      kind: 'meeting',
      durationMinutes: 15,
      visibility: 'team',
      reminders: ['15m'],
      title: 'Support floor standup',
      description: 'Queue load, risk tickets, ownership, and current blockers.',
      agenda: 'Volumes, staffing, escalations.'
    },
    {
      id: 'one-on-one',
      label: '1:1 checkpoint',
      subtitle: 'Coaching or manager sync',
      calendarId: 'people',
      kind: 'meeting',
      durationMinutes: 30,
      visibility: 'invite_only',
      reminders: ['30m'],
      title: '1:1 coaching',
      description: 'Feedback, energy level, blockers, and growth priorities.',
      agenda: 'Wins, misses, support needed.'
    },
    {
      id: 'focus',
      label: 'Focus block',
      subtitle: 'Deep work with no interruptions',
      calendarId: 'personal',
      kind: 'focus',
      durationMinutes: 120,
      visibility: 'private',
      reminders: ['5m'],
      title: 'Focus block',
      description: 'Protected time for deep work, documentation, or analysis.',
      agenda: 'Single-task execution.'
    },
    {
      id: 'launch',
      label: 'Launch review',
      subtitle: 'Cross-team go-live review',
      calendarId: 'delivery',
      kind: 'launch',
      durationMinutes: 60,
      visibility: 'team',
      reminders: ['1h', '15m'],
      title: 'Launch readiness review',
      description: 'Final gate before release with support, product, and escalation owners.',
      agenda: 'Readiness, risk review, rollback owner.'
    },
    {
      id: 'training',
      label: 'Training block',
      subtitle: 'Academy or QA calibration',
      calendarId: 'training',
      kind: 'training',
      durationMinutes: 90,
      visibility: 'invite_only',
      reminders: ['30m'],
      title: 'Training session',
      description: 'Structured enablement with examples, notes, and follow-up.',
      agenda: 'Walkthrough, practice, Q&A.'
    }
  ];
  readonly timelineStartHour = 6;
  readonly timelineEndHour = 23;
  readonly pxPerHour = 72;

  readonly weekdayLabelsLong = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly weekdayLabelsMini = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  viewMode: CalendarViewMode = 'month';
  anchorDate = startOfDay(new Date());
  selectedDate = startOfDay(new Date());

  events: CalendarEvent[] = [];
  directory: CalendarPerson[] = [];
  calendarFilter: Record<string, boolean> = {};
  searchQuery = '';
  attendeeSearch = '';
  onlyMyInvites = false;
  directoryLoading = false;
  dataMessage = '';
  selectedEventId: number | null = null;
  editorMode: 'create' | 'edit' = 'create';
  saveState: 'idle' | 'saved' = 'idle';

  draft!: CalendarDraft;

  private eventsSub?: Subscription;

  constructor(
    public auth: AuthService,
    private calendarService: CalendarService,
    private staffService: StaffService,
    private collaborationService: CollaborationService
  ) {
    this.calendarFilter = Object.fromEntries(this.calendarDefs.map(calendar => [calendar.id, true]));
    this.draft = this.buildDraft();
  }

  ngOnInit(): void {
    this.eventsSub = this.calendarService.events$.subscribe(events => {
      this.events = events;
      if (this.selectedEventId && !this.events.some(event => event.id === this.selectedEventId)) {
        this.selectedEventId = null;
      }
    });
    this.events = this.calendarService.events;
    this.prepareNewEvent(this.selectedDate);
    void this.loadDirectory();
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  get currentUserId(): number {
    const user = this.auth.getUser();
    const storedId = typeof window !== 'undefined' ? localStorage.getItem('id') : '0';
    const parsed = Number(user?.id || storedId || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  get currentUserName(): string {
    return (this.auth.getUserName() || 'Current User').trim() || 'Current User';
  }

  get currentUserEmail(): string {
    const user = this.auth.getUser();
    const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('email') : '';
    return (user?.email || storedEmail || '').toString().trim();
  }

  get currentUserRole(): string {
    return this.auth.getNormalizedRole() || 'AGENT';
  }

  get rangeLabel(): string {
    if (this.viewMode === 'month') {
      return this.anchorDate.toLocaleDateString(getActiveLocale(), { month: 'long', year: 'numeric' });
    }
    if (this.viewMode === 'week') {
      const start = startOfWeek(this.anchorDate);
      const end = addDays(start, 6);
      const startLabel = start.toLocaleDateString(getActiveLocale(), { month: 'short', day: 'numeric' });
      const endLabel = end.toLocaleDateString(getActiveLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startLabel} - ${endLabel}`;
    }
    if (this.viewMode === 'day') {
      return this.selectedDate.toLocaleDateString(getActiveLocale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    return 'Upcoming agenda';
  }

  get timelineHours(): number[] {
    return Array.from({ length: this.timelineEndHour - this.timelineStartHour + 1 }, (_, index) => this.timelineStartHour + index);
  }

  get timelineHeight(): number {
    return (this.timelineHours.length - 1) * this.pxPerHour;
  }

  get visibleEvents(): CalendarEvent[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.events.filter(event => {
      if (this.calendarFilter[event.calendarId] === false) return false;
      if (this.onlyMyInvites && !event.attendees.some(attendee => attendee.userId === this.currentUserId)) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        event.title,
        event.description,
        event.location,
        event.organizerName,
        event.attendees.map(attendee => attendee.name).join(' '),
        event.attendees.map(attendee => attendee.email).join(' ')
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  get selectedEvent(): CalendarEvent | null {
    return this.events.find(event => event.id === this.selectedEventId) || null;
  }

  get invitationInbox(): CalendarEvent[] {
    return this.visibleEvents
      .filter(event => event.attendees.some(attendee =>
        attendee.userId === this.currentUserId
        && (attendee.status === 'pending' || attendee.status === 'tentative')
      ))
      .filter(event => new Date(event.endAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .slice(0, 6);
  }

  get monthCells(): CalendarDayCell[] {
    const monthStart = startOfMonth(this.anchorDate);
    const gridStart = startOfWeek(monthStart);
    const monthEnd = endOfMonth(this.anchorDate);
    const gridEnd = endOfWeek(monthEnd);
    const cells: CalendarDayCell[] = [];

    let pointer = new Date(gridStart);
    while (pointer <= gridEnd) {
      const day = startOfDay(pointer);
      cells.push(this.createDayCell(day));
      pointer = addDays(pointer, 1);
    }

    return cells;
  }

  get miniMonthCells(): CalendarDayCell[] {
    const cells = [...this.monthCells];
    if (!cells.length) return cells;
    let pointer = addDays(cells[cells.length - 1].date, 1);
    while (cells.length < 42) {
      cells.push(this.createDayCell(pointer));
      pointer = addDays(pointer, 1);
    }
    return cells;
  }

  get weekColumns(): CalendarTimelineColumn[] {
    const base = this.viewMode === 'day' ? this.selectedDate : startOfWeek(this.anchorDate);
    const days = this.viewMode === 'day'
      ? [startOfDay(base)]
      : Array.from({ length: 7 }, (_, index) => addDays(base, index));

    return days.map(date => this.buildTimelineColumn(date));
  }

  get agendaGroups(): CalendarAgendaGroup[] {
    const upcoming = this.visibleEvents
      .filter(event => new Date(event.endAt).getTime() >= startOfDay(this.anchorDate).getTime())
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .slice(0, 40);

    const groups = new Map<string, CalendarAgendaGroup>();
    for (const event of upcoming) {
      const date = startOfDay(new Date(event.startAt));
      const key = toIsoDate(date);
      if (!groups.has(key)) {
        groups.set(key, {
          date,
          label: date.toLocaleDateString(getActiveLocale(), { weekday: 'long', month: 'long', day: 'numeric' }),
          events: []
        });
      }
      groups.get(key)!.events.push(event);
    }

    return [...groups.values()];
  }

  get filteredDirectory(): CalendarPerson[] {
    const query = this.attendeeSearch.trim().toLowerCase();
    const source = this.directory.filter(person => person.active);
    if (!query) return source;
    return source.filter(person => `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(query));
  }

  get selectedEventStatusForCurrentUser(): CalendarAttendeeStatus | '' {
    const attendee = this.selectedEvent?.attendees.find(item => item.userId === this.currentUserId);
    return attendee ? attendee.status : '';
  }

  get selectedEventCalendarLabel(): string {
    const calendar = this.calendarDefs.find(item => item.id === this.selectedEvent?.calendarId);
    return calendar ? calendar.label : 'Calendar';
  }

  get suggestedSlots(): CalendarSuggestion[] {
    if (!this.draft.startAtLocal || !this.draft.endAtLocal) return [];
    const attendeeIds = this.draft.attendeeIds.length ? this.draft.attendeeIds : [this.currentUserId].filter(id => id > 0);
    const start = parseLocalDateTime(this.draft.startAtLocal);
    const end = parseLocalDateTime(this.draft.endAtLocal);
    if (!start || !end || end <= start) return [];

    const durationMs = end.getTime() - start.getTime();
    const suggestions: CalendarSuggestion[] = [];
    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const day = addDays(startOfDay(addDays(start, dayOffset)), 0);
      for (const hour of [9, 11, 14, 16]) {
        const slotStart = new Date(day);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + durationMs);
        const conflictCount = this.countConflicts(slotStart, slotEnd, attendeeIds);
        suggestions.push({
          label: slotStart.toLocaleDateString(getActiveLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) + ` - ${formatTime(slotStart)}`,
          startAtLocal: toLocalInputValue(slotStart.toISOString()),
          endAtLocal: toLocalInputValue(slotEnd.toISOString()),
          freeAttendees: Math.max(0, attendeeIds.length - conflictCount),
          conflictCount
        });
      }
    }

    return suggestions
      .sort((left, right) => {
        if (left.conflictCount !== right.conflictCount) return left.conflictCount - right.conflictCount;
        return left.startAtLocal.localeCompare(right.startAtLocal);
      })
      .slice(0, 4);
  }

  async loadDirectory(): Promise<void> {
    this.directoryLoading = true;
    this.dataMessage = '';

    try {
      const staffUsers = await firstValueFrom(this.staffService.listUsers());
      this.directory = (Array.isArray(staffUsers) ? staffUsers : [])
        .map(user => ({
          id: Number(user.id || 0),
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || `User ${user.id}`,
          email: (user.email || '').trim(),
          role: (user.role || 'AGENT').toString().toUpperCase(),
          status: (user.status || 'OFFLINE').toString().toUpperCase(),
          active: user.active !== false
        }))
        .filter(user => user.id > 0);
    } catch {
      try {
        const workspace = await this.collaborationService.getWorkspace(this.currentUserContext);
        this.directory = (workspace.users || [])
          .map(user => ({
            id: Number(user.id || 0),
            name: (user.name || '').trim() || user.email || `User ${user.id}`,
            email: (user.email || '').trim(),
            role: (user.role || 'AGENT').toString().toUpperCase(),
            status: (user.status || 'OFFLINE').toString().toUpperCase(),
            active: user.active !== false
          }))
          .filter(user => user.id > 0);
      } catch {
        this.directory = [];
      }
    } finally {
      this.directoryLoading = false;
    }

    if (!this.directory.some(person => person.id === this.currentUserId) && this.currentUserId > 0) {
      this.directory.unshift({
        id: this.currentUserId,
        name: this.currentUserName,
        email: this.currentUserEmail,
        role: this.currentUserRole,
        status: this.auth.getUserStatus(),
        active: true
      });
    }

    this.directory = dedupePeople(this.directory);
  }

  get currentUserContext(): CollaborationCurrentUser {
    return {
      id: this.currentUserId,
      fullName: this.currentUserName,
      email: this.currentUserEmail,
      role: this.currentUserRole,
      status: this.auth.getUserStatus() || 'ONLINE'
    };
  }

  setView(mode: CalendarViewMode): void {
    this.viewMode = mode;
    if (mode === 'day') {
      this.anchorDate = startOfDay(this.selectedDate);
    }
  }

  shiftWindow(offset: number): void {
    if (this.viewMode === 'month') {
      this.anchorDate = addMonths(this.anchorDate, offset);
      return;
    }
    if (this.viewMode === 'week' || this.viewMode === 'agenda') {
      this.anchorDate = addDays(this.anchorDate, offset * 7);
      return;
    }
    this.selectedDate = addDays(this.selectedDate, offset);
    this.anchorDate = startOfDay(this.selectedDate);
  }

  jumpToToday(): void {
    this.anchorDate = startOfDay(new Date());
    this.selectedDate = startOfDay(new Date());
  }

  selectDate(date: Date): void {
    this.selectedDate = startOfDay(date);
    if (this.viewMode === 'day') {
      this.anchorDate = this.selectedDate;
    }
  }

  jumpToDate(date: Date): void {
    this.anchorDate = startOfDay(date);
    this.selectedDate = startOfDay(date);
  }

  toggleCalendarFilter(calendarId: string): void {
    this.calendarFilter[calendarId] = this.calendarFilter[calendarId] === false;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.onlyMyInvites = false;
    this.calendarFilter = Object.fromEntries(this.calendarDefs.map(calendar => [calendar.id, true]));
  }

  selectEvent(event: CalendarEvent): void {
    this.selectedEventId = event.id;
    this.editorMode = 'edit';
    this.draft = {
      id: event.id,
      calendarId: event.calendarId,
      title: event.title,
      description: event.description,
      location: event.location,
      meetingLink: event.meetingLink,
      startAtLocal: toLocalInputValue(event.startAt),
      endAtLocal: toLocalInputValue(event.endAt),
      allDay: event.allDay,
      kind: event.kind,
      visibility: event.visibility,
      recurrence: event.recurrence,
      recurrenceCount: event.seriesId ? countSeriesEvents(this.events, event.seriesId) : 1,
      attendeeIds: event.attendees.map(attendee => attendee.userId),
      optionalAttendeeIds: event.attendees.filter(attendee => attendee.optional).map(attendee => attendee.userId),
      reminders: [...event.reminders],
      agenda: event.agenda,
      notes: event.notes,
      color: event.color
    };
    this.selectedDate = startOfDay(new Date(event.startAt));
  }

  prepareNewEvent(date?: Date, template?: CalendarTemplate): void {
    this.selectedEventId = null;
    this.editorMode = 'create';
    const baseDate = startOfDay(date || this.selectedDate || new Date());
    const start = new Date(baseDate);
    start.setHours(10, 0, 0, 0);
    const duration = template?.durationMinutes || 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const organizerIds = this.currentUserId > 0 ? [this.currentUserId] : [];

    this.draft = {
      id: null,
      calendarId: template?.calendarId || 'ops',
      title: template?.title || '',
      description: template?.description || '',
      location: '',
      meetingLink: '',
      startAtLocal: toLocalInputValue(start.toISOString()),
      endAtLocal: toLocalInputValue(end.toISOString()),
      allDay: false,
      kind: template?.kind || 'meeting',
      visibility: template?.visibility || 'team',
      recurrence: 'none',
      recurrenceCount: 1,
      attendeeIds: organizerIds,
      optionalAttendeeIds: [],
      reminders: template?.reminders ? [...template.reminders] : ['15m'],
      agenda: template?.agenda || '',
      notes: '',
      color: template?.calendarId ? (this.calendarDefs.find(item => item.id === template.calendarId)?.color || '#2563eb') : '#2563eb'
    };
  }

  applyTemplate(template: CalendarTemplate): void {
    this.prepareNewEvent(this.selectedDate, template);
  }

  toggleDraftAttendee(userId: number): void {
    const set = new Set(this.draft.attendeeIds);
    if (set.has(userId)) {
      set.delete(userId);
    } else {
      set.add(userId);
    }
    this.draft.attendeeIds = [...set];
    if (!set.has(userId)) {
      this.draft.optionalAttendeeIds = this.draft.optionalAttendeeIds.filter(id => id !== userId);
    }
  }

  toggleDraftOptional(userId: number): void {
    if (!this.draft.attendeeIds.includes(userId)) {
      this.draft.attendeeIds = [...this.draft.attendeeIds, userId];
    }
    const set = new Set(this.draft.optionalAttendeeIds);
    if (set.has(userId)) {
      set.delete(userId);
    } else {
      set.add(userId);
    }
    this.draft.optionalAttendeeIds = [...set];
  }

  isDraftAttendee(userId: number): boolean {
    return this.draft.attendeeIds.includes(userId);
  }

  isDraftOptional(userId: number): boolean {
    return this.draft.optionalAttendeeIds.includes(userId);
  }

  toggleReminder(reminder: string): void {
    const set = new Set(this.draft.reminders);
    if (set.has(reminder)) {
      set.delete(reminder);
    } else {
      set.add(reminder);
    }
    this.draft.reminders = set.size ? [...set] : ['15m'];
  }

  useSuggestedSlot(slot: CalendarSuggestion): void {
    this.draft.startAtLocal = slot.startAtLocal;
    this.draft.endAtLocal = slot.endAtLocal;
  }

  async saveDraft(): Promise<void> {
    const payload = this.buildEventPayload();
    if (!payload) {
      this.dataMessage = 'Title, start, and end are required.';
      return;
    }

    if (this.editorMode === 'edit' && this.draft.id) {
      this.calendarService.updateEvent(this.draft.id, payload);
      this.selectedEventId = this.draft.id;
    } else {
      const created = this.calendarService.createEvent(payload);
      this.selectedEventId = created[0]?.id || null;
      if (created[0]) {
        this.selectEvent(created[0]);
      }
    }

    this.saveState = 'saved';
    this.dataMessage = 'Event saved.';
    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.saveState = 'idle', 1600);
    }
  }

  duplicateSelectedEvent(): void {
    const event = this.selectedEvent;
    if (!event) return;
    const copy = this.calendarService.duplicateEvent(event.id, 1);
    if (copy) {
      this.selectEvent(copy);
      this.dataMessage = 'Event duplicated.';
    }
  }

  deleteSelectedEvent(): void {
    const event = this.selectedEvent;
    if (!event) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm(`Delete "${event.title}"?`);
    if (!confirmed) return;
    this.calendarService.deleteEvent(event.id);
    this.prepareNewEvent(this.selectedDate);
    this.dataMessage = 'Event deleted.';
  }

  respondToInvite(status: CalendarAttendeeStatus): void {
    const event = this.selectedEvent;
    if (!event || this.currentUserId <= 0) return;
    const updated = this.calendarService.setAttendeeStatus(event.id, this.currentUserId, status);
    if (updated) {
      this.selectEvent(updated);
      this.dataMessage = `Invitation ${status}.`;
    }
  }

  formatEventTime(event: CalendarEvent): string {
    if (event.allDay) return 'All day';
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return `${formatTime(start)} - ${formatTime(end)}`;
  }

  formatEventDateTime(event: CalendarEvent): string {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return `${start.toLocaleDateString(getActiveLocale(), { weekday: 'short', month: 'short', day: 'numeric' })} - ${formatTime(start)} - ${formatTime(end)}`;
  }

  formatHour(hour: number): string {
    const sample = new Date();
    sample.setHours(hour, 0, 0, 0);
    return formatTime(sample);
  }

  getPersonName(userId: number): string {
    return this.directory.find(person => person.id === userId)?.name || `User ${userId}`;
  }

  getCalendarLabel(calendarId: string): string {
    return this.calendarDefs.find(item => item.id === calendarId)?.label || 'Calendar';
  }

  trackByIso(_: number, item: CalendarDayCell | CalendarTimelineColumn): string {
    return item.iso;
  }

  trackByEventId(_: number, item: CalendarEvent | CalendarTimelineEvent): number {
    return 'source' in item ? item.source.id : item.id;
  }
  
  private buildTimelineColumn(date: Date): CalendarTimelineColumn {
    const events = this.eventsForDay(date);
    const allDayEvents = events.filter(event => event.allDay || spansWholeDay(event, date));
    const timedEvents = events
      .filter(event => !allDayEvents.some(item => item.id === event.id))
      .map(event => this.positionTimelineEvent(event, date))
      .sort((left, right) => left.top - right.top);

    return {
      date,
      iso: toIsoDate(date),
      label: date.toLocaleDateString(getActiveLocale(), { weekday: 'short', day: 'numeric' }),
      isToday: isSameDay(date, new Date()),
      allDayEvents,
      timedEvents
    };
  }

  private createDayCell(day: Date): CalendarDayCell {
    return {
      date: day,
      iso: toIsoDate(day),
      dayNumber: day.getDate(),
      inMonth: day.getMonth() === this.anchorDate.getMonth(),
      isToday: isSameDay(day, new Date()),
      isSelected: isSameDay(day, this.selectedDate),
      events: this.eventsForDay(day).slice(0, 4)
    };
  }

  private positionTimelineEvent(event: CalendarEvent, date: Date): CalendarTimelineEvent {
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);
    const eventStart = new Date(event.startAt);
    const eventEnd = new Date(event.endAt);
    const start = new Date(Math.max(eventStart.getTime(), dayStart.getTime()));
    const end = new Date(Math.min(eventEnd.getTime(), dayEnd.getTime()));
    const minutesFromStart = ((start.getHours() * 60) + start.getMinutes()) - (this.timelineStartHour * 60);
    const durationMinutes = Math.max(30, ((end.getHours() * 60) + end.getMinutes()) - ((start.getHours() * 60) + start.getMinutes()));

    return {
      source: event,
      top: clamp((minutesFromStart / 60) * this.pxPerHour, 0, this.timelineHeight - 36),
      height: clamp((durationMinutes / 60) * this.pxPerHour, 48, this.timelineHeight),
      timeLabel: this.formatEventTime(event)
    };
  }

  private buildDraft(): CalendarDraft {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      id: null,
      calendarId: 'ops',
      title: '',
      description: '',
      location: '',
      meetingLink: '',
      startAtLocal: toLocalInputValue(start.toISOString()),
      endAtLocal: toLocalInputValue(end.toISOString()),
      allDay: false,
      kind: 'meeting',
      visibility: 'team',
      recurrence: 'none',
      recurrenceCount: 1,
      attendeeIds: this.currentUserId > 0 ? [this.currentUserId] : [],
      optionalAttendeeIds: [],
      reminders: ['15m'],
      agenda: '',
      notes: '',
      color: '#2563eb'
    };
  }

  private buildEventPayload(): CalendarEventInput | null {
    const title = this.draft.title.trim();
    const startAt = parseLocalDateTime(this.draft.startAtLocal);
    const endAt = parseLocalDateTime(this.draft.endAtLocal);
    if (!title || !startAt || !endAt || endAt <= startAt) return null;

    const calendar = this.calendarDefs.find(item => item.id === this.draft.calendarId) || this.calendarDefs[0];
    const optionalSet = new Set(this.draft.optionalAttendeeIds);
    const attendees: CalendarAttendee[] = this.draft.attendeeIds
      .map(id => this.directory.find(person => person.id === id))
      .filter((person): person is CalendarPerson => !!person)
      .map(person => ({
        userId: person.id,
        name: person.name,
        email: person.email,
        role: person.role,
        status: person.id === this.currentUserId ? 'accepted' : 'pending',
        optional: optionalSet.has(person.id)
      }));

    return {
      calendarId: this.draft.calendarId,
      title,
      description: this.draft.description.trim(),
      location: this.draft.location.trim(),
      meetingLink: this.draft.meetingLink.trim(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: !!this.draft.allDay,
      kind: this.draft.kind,
      visibility: this.draft.visibility,
      recurrence: this.draft.recurrence,
      recurrenceCount: Math.max(1, Number(this.draft.recurrenceCount || 1)),
      organizerId: this.currentUserId,
      organizerName: this.currentUserName,
      attendees,
      reminders: this.draft.reminders,
      agenda: this.draft.agenda.trim(),
      notes: this.draft.notes.trim(),
      color: this.draft.color || calendar.color
    };
  }

  private eventsForDay(date: Date): CalendarEvent[] {
    const dayStart = startOfDay(date).getTime();
    const dayEnd = addDays(startOfDay(date), 1).getTime();
    return this.visibleEvents
      .filter(event => {
        const start = new Date(event.startAt).getTime();
        const end = new Date(event.endAt).getTime();
        return start < dayEnd && end > dayStart;
      })
      .sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  private countConflicts(start: Date, end: Date, attendeeIds: number[]): number {
    const targetIds = new Set(attendeeIds);
    const conflictingUsers = new Set<number>();
    for (const event of this.events) {
      const eventStart = new Date(event.startAt).getTime();
      const eventEnd = new Date(event.endAt).getTime();
      if (eventStart >= end.getTime() || eventEnd <= start.getTime()) continue;
      const involved = new Set<number>([event.organizerId, ...event.attendees.map(attendee => attendee.userId)]);
      for (const id of targetIds) {
        if (involved.has(id)) {
          conflictingUsers.add(id);
        }
      }
    }
    return conflictingUsers.size;
  }
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toIsoDate(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(getActiveLocale(), { hour: 'numeric', minute: '2-digit' });
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function spansWholeDay(event: CalendarEvent, date: Date): boolean {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = addDays(startOfDay(date), 1).getTime();
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  return start <= dayStart && end >= dayEnd;
}

function countSeriesEvents(events: CalendarEvent[], seriesId: string): number {
  return events.filter(event => event.seriesId === seriesId).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function dedupePeople(people: CalendarPerson[]): CalendarPerson[] {
  const byId = new Map<number, CalendarPerson>();
  for (const person of people) {
    if (!Number.isFinite(person.id) || person.id <= 0) continue;
    byId.set(person.id, person);
  }
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

