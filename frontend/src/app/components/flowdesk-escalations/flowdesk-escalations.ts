import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of, switchMap } from 'rxjs';
import {
  EscalationComment,
  EscalationL2User,
  EscalationPriority,
  EscalationStatus,
  EscalationTicket,
  EscalationUserContext,
  FlowdeskEscalationService
} from '../../services/flowdesk-escalations';
import { JiraBridgeService, JiraIssueDraftPayload, JiraTransition } from '../../services/jira-bridge';
import { AuthService } from '../../services/auth';

type TicketScope = 'my' | 'all' | 'playlist';

@Component({
  selector: 'app-flowdesk-escalations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flowdesk-escalations.html',
  styleUrl: './flowdesk-escalations.css'
})
export class FlowdeskEscalations implements OnInit, OnDestroy {
  readonly priorities: EscalationPriority[] = ['low', 'medium', 'high', 'critical'];
  readonly l2Statuses: EscalationStatus[] = ['escalated', 'investigating', 'waiting_l1', 'resolved', 'closed', 'duplicate_closed'];

  tickets: EscalationTicket[] = [];
  visibleTickets: EscalationTicket[] = [];
  l2Playlist: EscalationTicket[] = [];
  selectedTicketId: number | null = null;
  selectedComments: EscalationComment[] = [];
  ticketScope: TicketScope = 'my';
  query = '';
  loading = false;

  // L1 create + escalation.
  createTitle = '';
  createDescription = '';
  createCustomerEmail = '';
  createClientId = '';
  createIssueTypeDraft = '';
  createIssueTypes: string[] = [];
  duplicateClientTickets: EscalationTicket[] = [];
  createRouting: 'l2_queue' | 'l2_direct' = 'l2_queue';
  createDirectL2UserId: number | null = null;
  createDirectL2Name = '';
  createPriority: EscalationPriority = 'medium';
  escalationReason = '';
  escalationAssigneeUserId: number | null = null;
  escalationAssigneeName = '';

  // Shared comment box.
  internalCommentDraft = '';

  // L2 update.
  l2Status: EscalationStatus = 'investigating';
  l2CommentDraft = '';
  l2AssigneeUserId: number | null = null;
  l2AssigneeName = '';
  duplicateOriginalTicketId: number | null = null;
  duplicateNote = '';

  // Assignee selection.
  l2Users: EscalationL2User[] = [];
  staffError = '';

  // Jira actions (credentials come from Settings page).
  jiraTransitions: JiraTransition[] = [];
  jiraTransitionId = '';
  jiraCommentDraft = '';
  jiraBusy = false;
  jiraMessage = '';
  showJiraCreateModal = false;
  playlistStarted = false;
  playlistBusy = false;
  jiraDraft: JiraIssueDraftPayload = {
    summary: '',
    description: '',
    projectKey: '',
    issueTypeName: '',
    priority: '',
    customerEmail: '',
    clientId: '',
    escalationReason: ''
  };

  actionMessage = '';
  actionError = '';

  private ticketsSub?: Subscription;

  constructor(
    private escalations: FlowdeskEscalationService,
    private jiraBridge: JiraBridgeService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.ticketScope = this.isL2 ? 'playlist' : 'my';
    this.playlistStarted = !this.isL2;
    this.loading = true;

    this.ticketsSub = this.escalations.tickets$.subscribe(tickets => {
      this.tickets = [...tickets];
      this.refreshVisibleTickets();
      this.refreshL2Playlist();
      this.ensureSelection();
      this.syncSelectedTicketState();
      this.refreshDuplicateClientTickets();
      this.loading = false;
    });

    this.escalations.loadWorkspace().subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.actionError = this.extractErrorMessage(err, 'Could not load escalation tickets.');
      }
    });

    this.loadL2Users();
    this.jiraBridge.loadConfig().subscribe();
  }

  ngOnDestroy(): void {
    this.ticketsSub?.unsubscribe();
  }

  get myRole(): string {
    return (this.auth.getNormalizedRole() || 'AGENT').toUpperCase();
  }

  get isL1(): boolean {
    return this.escalations.isL1Role(this.myRole);
  }

  get isL2(): boolean {
    return this.escalations.isL2Role(this.myRole);
  }

  get me(): EscalationUserContext {
    const user = this.auth.getUser();
    const id = Number(user?.id || localStorage.getItem('id') || 0);
    return {
      userId: Number.isFinite(id) ? id : 0,
      fullName: this.auth.getUserName() || 'Current User',
      role: this.myRole
    };
  }

  get selectedTicket(): EscalationTicket | null {
    if (!this.selectedTicketId) return null;
    return this.tickets.find(ticket => ticket.id === this.selectedTicketId) ?? null;
  }

  changeScope(scope: TicketScope): void {
    this.ticketScope = scope;
    if (this.isL2 && scope === 'playlist' && !this.playlistStarted) {
      this.selectedTicketId = null;
    }
    this.refreshVisibleTickets();
    this.ensureSelection();
  }

  refreshVisibleTickets(): void {
    const me = this.me;
    const normalizedMe = me.fullName.trim().toLowerCase();

    let rows = [...this.tickets];
    if (this.isL1) {
      if (this.ticketScope === 'my') {
        rows = rows.filter(ticket =>
          ticket.createdByUserId === me.userId
          || (ticket.createdByName || '').toLowerCase() === normalizedMe
        );
      }
    } else if (this.isL2) {
      if (this.ticketScope === 'playlist') {
        rows = [...this.l2Playlist];
      } else if (this.ticketScope === 'my') {
        rows = rows.filter(ticket => Number(ticket.l2AssigneeUserId || 0) === Number(me.userId || 0));
      }
    }

    const q = this.query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(ticket =>
        (ticket.key || '').toLowerCase().includes(q)
        || (ticket.title || '').toLowerCase().includes(q)
        || (ticket.customerEmail || '').toLowerCase().includes(q)
        || (ticket.clientId || '').toLowerCase().includes(q)
        || (ticket.createdByName || '').toLowerCase().includes(q)
        || (ticket.l2AssigneeName || '').toLowerCase().includes(q)
        || (ticket.status || '').toLowerCase().includes(q)
      );
    }

    if (this.ticketScope === 'playlist' && this.isL2) {
      // Playlist order = oldest pending first.
      rows.sort((a, b) => new Date(a.createdAt || a.updatedAt || 0).getTime() - new Date(b.createdAt || b.updatedAt || 0).getTime());
    } else {
      rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }
    this.visibleTickets = rows;
  }

  selectTicket(ticketId: number): void {
    this.clearMessages();
    this.selectedTicketId = ticketId;
    this.syncSelectedTicketState();
    this.jiraMessage = '';
    this.jiraTransitions = [];
    this.jiraTransitionId = '';
  }

  createTicket(): void {
    this.clearMessages();
    if (!this.isL1) {
      this.actionError = 'Only L1 roles can create escalation tickets.';
      return;
    }
    if (!this.createTitle.trim()) {
      this.actionError = 'Ticket title is required.';
      return;
    }
    if (this.createRouting === 'l2_direct' && !this.createDirectL2Name.trim()) {
      this.actionError = 'Provide an L2 assignee name for direct L2 routing.';
      return;
    }

    let flow$: Observable<EscalationTicket> = this.escalations.createTicket(
      {
        title: this.createTitle,
        description: this.createDescription,
        customerEmail: this.createCustomerEmail,
        clientId: this.createClientId,
        issueTypes: this.createIssueTypes,
        priority: this.createPriority
      },
      this.me
    );

    flow$ = flow$.pipe(
      switchMap(created => {
        if (this.createRouting === 'l2_direct') {
          return this.escalations.escalateTicket(
            created.id,
            {
              reason: 'Created and routed directly to L2.',
              l2AssigneeUserId: this.createDirectL2UserId,
              l2AssigneeName: this.createDirectL2Name
            },
            this.me
          );
        }
        return this.escalations.escalateTicket(
          created.id,
          { reason: 'Created directly in L2 queue.' },
          this.me
        );
      })
    );

    flow$.subscribe({
      next: created => {
        this.createTitle = '';
        this.createDescription = '';
        this.createCustomerEmail = '';
        this.createClientId = '';
        this.createIssueTypeDraft = '';
        this.createIssueTypes = [];
        this.duplicateClientTickets = [];
        this.createRouting = 'l2_queue';
        this.createDirectL2UserId = null;
        this.createDirectL2Name = '';
        this.createPriority = 'medium';
        this.selectedTicketId = created.id;
        this.ticketScope = this.isL1 ? 'my' : this.ticketScope;
        this.refreshVisibleTickets();
        this.syncSelectedTicketState();
        this.actionMessage = `${created.key} created and routed to L2.`;
      },
      error: err => {
        this.actionError = this.extractErrorMessage(err, 'Could not create ticket.');
      }
    });
  }

  onCreateDirectL2Changed(value: string): void {
    const id = Number(value || 0);
    if (!id) {
      this.createDirectL2UserId = null;
      this.createDirectL2Name = '';
      return;
    }
    this.createDirectL2UserId = id;
    const user = this.l2Users.find(item => item.id === id);
    this.createDirectL2Name = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  escalateSelectedTicket(): void {
    this.clearMessages();
    const ticket = this.selectedTicket;
    if (!ticket) {
      this.actionError = 'Select a ticket first.';
      return;
    }
    if (!this.isL1) {
      this.actionError = 'Only L1 roles can escalate.';
      return;
    }

    this.escalations.escalateTicket(
      ticket.id,
      {
        reason: this.escalationReason,
        l2AssigneeUserId: this.escalationAssigneeUserId,
        l2AssigneeName: this.escalationAssigneeName
      },
      this.me
    ).subscribe({
      next: updated => {
        this.escalationReason = '';
        this.actionMessage = `${updated.key} escalated to L2.`;
        this.syncSelectedTicketState();
      },
      error: err => {
        this.actionError = this.extractErrorMessage(err, 'Could not escalate this ticket.');
      }
    });
  }

  addInternalComment(): void {
    this.clearMessages();
    const ticket = this.selectedTicket;
    if (!ticket) {
      this.actionError = 'Select a ticket first.';
      return;
    }
    this.escalations.addComment(ticket.id, this.internalCommentDraft, this.me, 'internal').subscribe({
      next: () => {
        this.internalCommentDraft = '';
        this.actionMessage = 'Comment added.';
        this.syncSelectedTicketState();
      },
      error: err => {
        this.actionError = this.extractErrorMessage(err, 'Could not add comment.');
      }
    });
  }

  addIssueTypeFromDraft(): void {
    const value = (this.createIssueTypeDraft || '').trim();
    if (!value) return;
    if (!this.createIssueTypes.some(item => item.toLowerCase() === value.toLowerCase())) {
      this.createIssueTypes = [...this.createIssueTypes, value];
    }
    this.createIssueTypeDraft = '';
  }

  removeIssueType(value: string): void {
    this.createIssueTypes = this.createIssueTypes.filter(item => item !== value);
  }

  refreshDuplicateClientTickets(): void {
    const clientId = this.createClientId.trim();
    if (!clientId) {
      this.duplicateClientTickets = [];
      return;
    }
    this.duplicateClientTickets = this.escalations.findByClientId(clientId)
      .filter(ticket => !this.isTicketResolved(ticket));
  }

  saveL2Update(): void {
    this.clearMessages();
    const ticket = this.selectedTicket;
    if (!ticket) {
      this.actionError = 'Select a ticket first.';
      return;
    }
    if (!this.isL2) {
      this.actionError = 'Only L2 roles can update ticket status.';
      return;
    }
    if (this.isAssignedToAnotherL2(ticket)) {
      this.actionError = `${ticket.key} is assigned to ${ticket.l2AssigneeName || 'another L2 user'}.`;
      return;
    }
    const requestedStatus: EscalationStatus = this.l2Status;
    const requestedComment = this.l2CommentDraft.trim();
    const requestedAssigneeUserId = this.l2AssigneeUserId || this.me.userId;
    const requestedAssigneeName = this.l2AssigneeName || this.me.fullName;
    const requestedResolved = requestedStatus === 'resolved' || requestedStatus === 'closed';
    if (requestedResolved && ticket.jiraIssueKey && !this.isJiraResolvedStatus(ticket.jiraStatus)) {
      this.actionError = 'Cannot resolve this ticket before Jira is resolved. Sync Jira status first.';
      return;
    }

    let flow$: Observable<any> = of(null);
    if (!ticket.l2AssigneeUserId) {
      flow$ = flow$.pipe(
        switchMap(() => this.escalations.claimForL2(ticket.id, this.me)),
        switchMap(result => {
          if (!result.ok) {
            throw new Error(result.error || 'Could not claim ticket.');
          }
          return of(result.ticket);
        })
      );
    }

    flow$ = flow$.pipe(
      switchMap(() => this.escalations.assignL2(
        ticket.id,
        { l2AssigneeUserId: requestedAssigneeUserId, l2AssigneeName: requestedAssigneeName },
        this.me
      )),
      switchMap(() => this.escalations.updateStatus(ticket.id, requestedStatus, this.me)),
      switchMap(updated => {
        if (requestedComment) {
          return this.escalations.addComment(ticket.id, requestedComment, this.me, 'internal').pipe(
            switchMap(() => of(updated))
          );
        }
        return of(updated);
      })
    );

    flow$.subscribe({
      next: (updated: EscalationTicket) => {
        this.l2CommentDraft = '';
        this.actionMessage = `${updated.key} updated.`;
        this.refreshL2Playlist();
        this.syncSelectedTicketState();
      },
      error: err => {
        this.actionError = this.extractErrorMessage(err, 'Could not update ticket.');
      }
    });
  }

  closeSelectedAsDuplicate(): void {
    this.clearMessages();
    const ticket = this.selectedTicket;
    if (!ticket) {
      this.actionError = 'Select a ticket first.';
      return;
    }
    if (!this.isL2) {
      this.actionError = 'Only L2 roles can close duplicates.';
      return;
    }
    if (this.isAssignedToAnotherL2(ticket)) {
      this.actionError = `${ticket.key} is assigned to ${ticket.l2AssigneeName || 'another L2 user'}.`;
      return;
    }
    const originalId = Number(this.duplicateOriginalTicketId || 0);
    if (!originalId || originalId === ticket.id) {
      this.actionError = 'Select a valid original ticket.';
      return;
    }
    this.escalations.closeAsDuplicate(ticket.id, originalId, this.me, this.duplicateNote).subscribe({
      next: closed => {
        this.duplicateNote = '';
        this.duplicateOriginalTicketId = null;
        this.actionMessage = `${closed.key} linked and closed as duplicate.`;
        this.refreshL2Playlist();
        this.syncSelectedTicketState();
      },
      error: err => {
        this.actionError = this.extractErrorMessage(err, 'Could not close this ticket as duplicate.');
      }
    });
  }

  createJiraIssueForSelectedTicket(): void {
    const ticket = this.selectedTicket;
    if (!ticket || !this.isL2 || this.isAssignedToAnotherL2(ticket) || !!ticket.jiraIssueKey) {
      if (!ticket) this.jiraMessage = 'Select a ticket first.';
      else if (!this.isL2) this.jiraMessage = 'Only L2 roles can create Jira issues.';
      else if (this.isAssignedToAnotherL2(ticket)) this.jiraMessage = `${ticket.key} is assigned to ${ticket.l2AssigneeName || 'another L2 user'}.`;
      return;
    }
    const cfg = this.jiraBridge.config;
    this.jiraDraft = {
      summary: `[${ticket.key}] ${ticket.title}`.trim(),
      description: (ticket.description || '').trim(),
      projectKey: (cfg?.projectKey || '').trim(),
      issueTypeName: (cfg?.issueTypeName || 'Task').trim() || 'Task',
      priority: (ticket.priority || 'medium').toString().trim(),
      customerEmail: (ticket.customerEmail || '').trim(),
      clientId: (ticket.clientId || '').trim(),
      escalationReason: (ticket.escalationReason || '').trim()
    };
    this.showJiraCreateModal = true;
  }

  closeJiraCreateModal(): void {
    this.showJiraCreateModal = false;
  }

  confirmCreateJiraIssue(): void {
    const ticket = this.selectedTicket;
    if (!ticket) {
      this.showJiraCreateModal = false;
      this.jiraMessage = 'Select a ticket first.';
      return;
    }
    this.showJiraCreateModal = false;
    this.jiraBusy = true;
    this.jiraMessage = '';
    this.jiraBridge.createIssueFromTicket(ticket, this.jiraDraft).pipe(
      switchMap(res => {
        const key = (res?.key || '').toString().trim();
        const url = key ? this.jiraBridge.browseUrl(key) : '';
        return this.escalations.linkJiraIssue(ticket.id, {
          jiraIssueKey: key,
          jiraIssueUrl: url,
          jiraStatus: 'Created',
          jiraSyncedAt: new Date().toISOString()
        }).pipe(
          switchMap(() => of(key))
        );
      })
    ).subscribe({
      next: key => {
        this.jiraBusy = false;
        this.jiraMessage = key ? `Jira issue ${key} created.` : 'Jira issue created.';
        this.refreshL2Playlist();
        this.syncSelectedTicketState();
      },
      error: err => {
        this.jiraBusy = false;
        this.jiraMessage = this.extractErrorMessage(err, 'Could not create Jira issue.');
      }
    });
  }

  normalizeJiraDraft(field: keyof JiraIssueDraftPayload): void {
    const raw = (this.jiraDraft[field] || '').toString();
    this.jiraDraft = {
      ...this.jiraDraft,
      [field]: field === 'projectKey'
        ? raw.trim().toUpperCase()
        : raw.trim()
    };
  }

  syncJiraIssue(): void {
    const ticket = this.selectedTicket;
    const issueKey = (ticket?.jiraIssueKey || '').trim();
    if (!ticket || !issueKey) {
      this.jiraMessage = 'No Jira issue linked to this ticket.';
      return;
    }
    this.jiraBusy = true;
    this.jiraMessage = '';
    this.jiraBridge.getIssue(issueKey).pipe(
      switchMap(issue => {
        const status = this.jiraBridge.extractIssueStatus(issue) || 'Unknown';
        return this.escalations.linkJiraIssue(ticket.id, {
          jiraIssueKey: issueKey,
          jiraIssueUrl: this.jiraBridge.browseUrl(issueKey),
          jiraStatus: status,
          jiraSyncedAt: new Date().toISOString()
        }).pipe(switchMap(() => of(status)));
      })
    ).subscribe({
      next: status => {
        this.jiraBusy = false;
        this.jiraMessage = `Jira synced (${status}).`;
        this.loadJiraTransitions();
        this.refreshL2Playlist();
        this.syncSelectedTicketState();
      },
      error: err => {
        this.jiraBusy = false;
        this.jiraMessage = this.extractErrorMessage(err, 'Could not sync Jira issue.');
      }
    });
  }

  loadJiraTransitions(): void {
    const ticket = this.selectedTicket;
    const issueKey = (ticket?.jiraIssueKey || '').trim();
    if (!ticket || !issueKey) return;
    this.jiraBridge.getTransitions(issueKey).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.transitions) ? res.transitions : [];
        this.jiraTransitions = rows;
        if (!rows.some(item => item.id === this.jiraTransitionId)) {
          this.jiraTransitionId = rows[0]?.id || '';
        }
      },
      error: () => {
        this.jiraTransitions = [];
        this.jiraTransitionId = '';
      }
    });
  }

  applyJiraTransition(): void {
    const ticket = this.selectedTicket;
    const issueKey = (ticket?.jiraIssueKey || '').trim();
    if (!ticket || !issueKey) {
      this.jiraMessage = 'No Jira issue linked.';
      return;
    }
    if (!this.jiraTransitionId) {
      this.jiraMessage = 'Select a Jira transition.';
      return;
    }
    this.jiraBusy = true;
    this.jiraMessage = '';
    this.jiraBridge.transitionIssue(issueKey, this.jiraTransitionId).subscribe({
      next: () => {
        this.jiraBusy = false;
        this.jiraMessage = 'Jira transition applied.';
        this.syncJiraIssue();
      },
      error: (err) => {
        this.jiraBusy = false;
        this.jiraMessage = this.extractErrorMessage(err, 'Could not apply Jira transition.');
      }
    });
  }

  addJiraCommentToIssue(): void {
    const ticket = this.selectedTicket;
    const issueKey = (ticket?.jiraIssueKey || '').trim();
    if (!ticket || !issueKey) {
      this.jiraMessage = 'No Jira issue linked.';
      return;
    }
    const body = this.jiraCommentDraft.trim();
    if (!body) {
      this.jiraMessage = 'Jira comment is empty.';
      return;
    }
    this.jiraBusy = true;
    this.jiraMessage = '';
    this.jiraBridge.addComment(issueKey, body).subscribe({
      next: () => {
        this.jiraBusy = false;
        this.jiraCommentDraft = '';
        this.jiraMessage = 'Jira comment added.';
      },
      error: (err) => {
        this.jiraBusy = false;
        this.jiraMessage = this.extractErrorMessage(err, 'Could not add Jira comment.');
      }
    });
  }

  onEscalationAssigneeChanged(value: string): void {
    const id = Number(value || 0);
    if (!id) {
      this.escalationAssigneeUserId = null;
      this.escalationAssigneeName = '';
      return;
    }
    this.escalationAssigneeUserId = id;
    const user = this.l2Users.find(item => item.id === id);
    this.escalationAssigneeName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  onL2AssigneeChanged(value: string): void {
    const id = Number(value || 0);
    if (!id) {
      this.l2AssigneeUserId = null;
      this.l2AssigneeName = '';
      return;
    }
    this.l2AssigneeUserId = id;
    const user = this.l2Users.find(item => item.id === id);
    this.l2AssigneeName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  trackTicket(_: number, ticket: EscalationTicket): number {
    return ticket.id;
  }

  startPlaylist(): void {
    this.clearMessages();
    if (!this.isL2) return;
    this.playlistStarted = true;
    this.playlistBusy = false;
    if (!this.l2Playlist.length) {
      this.actionMessage = 'No tickets available in playlist.';
      return;
    }
    const unassigned = this.l2Playlist.find(ticket => !ticket.l2AssigneeUserId);
    if (unassigned) {
      this.playlistBusy = true;
      this.escalations.claimForL2(unassigned.id, this.me).subscribe({
        next: result => {
          this.playlistBusy = false;
          if (!result.ok) {
            this.actionError = result.error || 'Could not claim playlist ticket.';
            return;
          }
          this.selectedTicketId = result.ticket?.id ?? unassigned.id;
          this.syncSelectedTicketState();
          this.actionMessage = `${result.ticket?.key || unassigned.key} assigned to you.`;
        },
        error: err => {
          this.playlistBusy = false;
          this.actionError = this.extractErrorMessage(err, 'Could not claim playlist ticket.');
        }
      });
      return;
    }
    const mine = this.l2Playlist.find(ticket => Number(ticket.l2AssigneeUserId || 0) === Number(this.me.userId || 0));
    if (!mine) {
      this.actionMessage = 'No tickets available in playlist.';
      return;
    }
    this.selectedTicketId = mine.id;
    this.syncSelectedTicketState();
    this.actionMessage = `${mine.key} opened from your playlist.`;
  }

  moveToNextPlaylistTicket(): void {
    this.clearMessages();
    if (!this.isL2 || !this.l2Playlist.length) {
      this.actionMessage = 'No next ticket in playlist.';
      return;
    }
    this.playlistStarted = true;
    this.playlistBusy = false;
    const currentIndex = this.selectedTicketId
      ? this.l2Playlist.findIndex(ticket => ticket.id === this.selectedTicketId)
      : -1;
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

    for (let offset = 0; offset < this.l2Playlist.length; offset += 1) {
      const idx = (startIndex + offset) % this.l2Playlist.length;
      const candidate = this.l2Playlist[idx];
      if (!candidate) continue;
      if (!candidate.l2AssigneeUserId) {
        this.playlistBusy = true;
        this.escalations.claimForL2(candidate.id, this.me).subscribe({
          next: result => {
            this.playlistBusy = false;
            if (!result.ok) {
              this.actionError = result.error || 'Could not claim next ticket.';
              return;
            }
            this.selectedTicketId = result.ticket?.id ?? candidate.id;
            this.syncSelectedTicketState();
            this.actionMessage = `${result.ticket?.key || candidate.key} assigned to you.`;
          },
          error: err => {
            this.playlistBusy = false;
            this.actionError = this.extractErrorMessage(err, 'Could not claim next ticket.');
          }
        });
        return;
      }
      if (Number(candidate.l2AssigneeUserId || 0) === Number(this.me.userId || 0)) {
        this.selectedTicketId = candidate.id;
        this.syncSelectedTicketState();
        this.actionMessage = `${candidate.key} opened.`;
        return;
      }
    }
    this.actionMessage = 'No next ticket available.';
  }

  canResolveSelectedTicket(): boolean {
    const ticket = this.selectedTicket;
    if (!ticket) return false;
    if (!ticket.jiraIssueKey) return true;
    return this.isJiraResolvedStatus(ticket.jiraStatus);
  }

  l2PlaylistPosition(): number {
    if (!this.selectedTicketId) return 0;
    const idx = this.l2Playlist.findIndex(ticket => ticket.id === this.selectedTicketId);
    return idx >= 0 ? idx + 1 : 0;
  }

  private syncSelectedTicketState(): void {
    const ticket = this.selectedTicket;
    if (!ticket) {
      this.selectedComments = [];
      return;
    }
    this.selectedComments = this.escalations.commentsForTicket(ticket.id);
    this.l2Status = ticket.status;
    this.l2AssigneeUserId = ticket.l2AssigneeUserId;
    this.l2AssigneeName = ticket.l2AssigneeName || '';
    this.escalationAssigneeUserId = ticket.l2AssigneeUserId;
    this.escalationAssigneeName = ticket.l2AssigneeName || '';
  }

  private ensureSelection(): void {
    if (this.isL2 && this.ticketScope === 'playlist') {
      if (!this.visibleTickets.length) {
        if (this.selectedTicketId && !this.tickets.some(item => item.id === this.selectedTicketId)) {
          this.selectedTicketId = null;
        }
        return;
      }
      if (this.selectedTicketId && this.visibleTickets.some(item => item.id === this.selectedTicketId)) {
        return;
      }
      // In playlist mode, explicit Play/Next controls own the navigation.
      if (!this.playlistStarted) {
        this.selectedTicketId = null;
      }
      return;
    }
    if (!this.visibleTickets.length) {
      this.selectedTicketId = null;
      return;
    }
    const exists = this.visibleTickets.some(item => item.id === this.selectedTicketId);
    if (!exists) {
      this.selectedTicketId = this.visibleTickets[0].id;
    }
  }

  private refreshL2Playlist(): void {
    if (!this.isL2) {
      this.l2Playlist = [];
      return;
    }
    const myId = Number(this.me.userId || 0);
    const queue = this.tickets
      .filter(ticket => this.isL2QueueCandidate(ticket))
      .filter(ticket => {
        const assigneeId = Number(ticket.l2AssigneeUserId || 0);
        return !assigneeId || assigneeId === myId;
      })
      .sort((a, b) => {
        return new Date(a.createdAt || a.updatedAt || 0).getTime() - new Date(b.createdAt || b.updatedAt || 0).getTime();
      });
    this.l2Playlist = queue;
    if (this.ticketScope === 'playlist') {
      this.visibleTickets = [...queue];
    }
  }

  private loadL2Users(): void {
    this.escalations.listL2Users().subscribe({
      next: (users) => {
        this.staffError = '';
        this.l2Users = (users || [])
          .filter(user => user.active)
          .filter(user => this.escalations.isL2Role(this.normalizeRole(user.role)));
      },
      error: (err) => {
        this.l2Users = [];
        this.staffError = Number(err?.status || 0) === 403
          ? 'L2 assignee directory is restricted by API access.'
          : 'Could not load L2 assignee list.';
      }
    });
  }

  private normalizeRole(raw: string): string {
    const role = (raw || '').toString().trim().toUpperCase().replace('ROLE_', '');
    if (role === '1') return 'ADMIN';
    if (role === '2') return 'AGENT';
    if (role === '3' || role === 'TL') return 'TEAM_LEADER';
    if (role === '4' || role === 'QUALITY') return 'QA';
    if (role === '5' || role === 'HEAD_OF_CS') return 'HEAD_CS';
    if (role === '6') return 'OPS';
    return role;
  }

  private clearMessages(): void {
    this.actionMessage = '';
    this.actionError = '';
  }

  private extractErrorMessage(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }

  private isL2QueueCandidate(ticket: EscalationTicket): boolean {
    const l2Scoped = ticket.level === 'L2'
      || ticket.status === 'escalated'
      || ticket.status === 'investigating'
      || ticket.status === 'waiting_l1'
      || !!ticket.escalatedAt
      || !!ticket.l2AssigneeName
      || !!ticket.jiraIssueKey;
    if (!l2Scoped) return false;

    const ticketResolved = this.isTicketResolved(ticket);
    if (!ticket.jiraIssueKey) {
      return !ticketResolved;
    }
    const jiraResolved = this.isJiraResolvedStatus(ticket.jiraStatus);
    return !(ticketResolved && jiraResolved);
  }

  private isAssignedToAnotherL2(ticket: EscalationTicket): boolean {
    const assigneeId = Number(ticket.l2AssigneeUserId || 0);
    const myId = Number(this.me.userId || 0);
    return assigneeId > 0 && assigneeId !== myId;
  }

  private isTicketResolved(ticket: EscalationTicket): boolean {
    return ticket.status === 'resolved'
      || ticket.status === 'closed'
      || ticket.status === 'duplicate_closed';
  }

  private isJiraResolvedStatus(rawStatus: string): boolean {
    const status = (rawStatus || '').toString().trim().toLowerCase();
    if (!status) return false;
    return status.includes('done')
      || status.includes('resolved')
      || status.includes('closed');
  }

  commentBody(comment: EscalationComment): string {
    if (this.isL2) return comment.body || '';
    if ((comment.source || '').toLowerCase() === 'jira') {
      return 'L3 updated the ticket.';
    }
    return comment.body || '';
  }
}
