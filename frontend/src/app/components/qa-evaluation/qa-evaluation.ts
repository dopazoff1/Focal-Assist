import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import { CrmCase, CrmService, GmailThreadResponse, QaEvaluation } from '../../services/crm';
import { StaffService, StaffUser } from '../../services/staff';
import { AuthService } from '../../services/auth';
import { TeamLinksService } from '../../services/team-links';

@Component({
  selector: 'app-qa-evaluation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qa-evaluation.html',
  styleUrls: ['./qa-evaluation.css']
})
export class QaEvaluationComponent implements OnInit {
  loadingAgents = false;
  loadingTickets = false;
  loadingThread = false;
  loadingEvaluations = false;
  saving = false;

  agents: StaffUser[] = [];
  selectedAgentId: number | null = null;
  tickets: CrmCase[] = [];
  selectedTicketId: number | null = null;
  selectedThread: GmailThreadResponse | null = null;
  evaluations: QaEvaluation[] = [];

  score = 85;
  strengths = '';
  improvements = '';
  comment = '';

  error = '';
  info = '';

  constructor(
    private staffService: StaffService,
    private crmService: CrmService,
    private auth: AuthService,
    private teamLinksService: TeamLinksService
  ) {}

  ngOnInit(): void {
    this.loadAgents();
  }

  get selectedTicket(): CrmCase | null {
    if (!this.selectedTicketId) return null;
    return this.tickets.find(t => t.id === this.selectedTicketId) ?? null;
  }

  private loadAgents(): void {
    this.loadingAgents = true;
    this.staffService.listUsers()
      .pipe(finalize(() => this.loadingAgents = false))
      .subscribe({
        next: users => {
          const activeAgents = users.filter(u => this.normalizeRole(u.role) === 'AGENT' && u.active);
          const nonAgentIds = new Set(
            users
              .filter(u => this.normalizeRole(u.role) !== 'AGENT')
              .map(u => Number(u.id))
              .filter(id => Number.isFinite(id) && id > 0)
          );
          const role = this.auth.getNormalizedRole();
          const me = this.auth.getUser();

          if (role === 'QA' && me?.id) {
            this.teamLinksService.getAgentIdsForManager('QA', me.id).subscribe({
              next: ids => {
                const linkedIds = [...new Set((ids || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0))];
                const linkedAgentIds = linkedIds.filter(id => !nonAgentIds.has(id));
                if (linkedAgentIds.length === 0) {
                  this.agents = [];
                  this.tickets = [];
                  this.selectedTicketId = null;
                  this.selectedThread = null;
                  this.evaluations = [];
                  this.error = 'No agents are linked to your QA account.';
                  return;
                }

                const linked = activeAgents.filter(a => linkedAgentIds.includes(Number(a.id)));
                if (linked.length > 0) {
                  this.agents = linked;
                  this.error = '';
                  this.selectAgent(this.agents[0].id);
                  return;
                }
                // Fallback for restricted /api/staff responses: derive agents from assigned tickets.
                this.loadAgentsFromCases(linkedAgentIds, nonAgentIds);
              },
              error: () => {
                this.agents = [];
                this.tickets = [];
                this.selectedTicketId = null;
                this.selectedThread = null;
                this.evaluations = [];
                this.error = 'Could not load linked agents for this QA account.';
              }
            });
          } else {
            this.agents = activeAgents;
            if (this.agents.length > 0) {
              this.error = '';
              this.selectAgent(this.agents[0].id);
            } else {
              this.loadAgentsFromCases();
            }
          }
        },
        error: () => this.loadAgentsFromCases()
      });
  }

  private loadAgentsFromCases(preferredIds: number[] = [], excludedIds: Set<number> = new Set<number>()): void {
    const preferred = new Set((preferredIds || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));
    this.crmService.getAllCases()
      .pipe(timeout(10000))
      .subscribe({
        next: all => {
          const byId = new Map<number, StaffUser>();
          for (const t of all) {
            const id = Number(t.assignedUserId);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (preferred.size > 0 && !preferred.has(id)) continue;
            if (excludedIds.has(id)) continue;
            if (byId.has(id)) continue;

            const full = (t.assignedTo || `Agent ${id}`).trim();
            const parts = full.split(/\s+/).filter(Boolean);
            byId.set(id, {
              id,
              firstName: parts[0] || 'Agent',
              lastName: parts.slice(1).join(' ') || String(id),
              dob: '',
              email: '',
              role: 'AGENT',
              status: 'UNKNOWN',
              active: true
            });
          }

          this.agents = Array.from(byId.values());
          if (this.agents.length > 0) {
            this.error = '';
            this.selectAgent(this.agents[0].id);
          } else {
            this.error = 'No linked agents found for this QA.';
            this.tickets = [];
            this.selectedTicketId = null;
            this.selectedThread = null;
            this.evaluations = [];
          }
        },
        error: () => {
          this.agents = [];
          this.error = 'Could not load agents.';
        }
      });
  }

  selectAgent(agentId: number): void {
    this.selectedAgentId = agentId;
    this.selectedTicketId = null;
    this.selectedThread = null;
    this.evaluations = [];
    this.loadAgentTickets();
  }

  private loadAgentTickets(): void {
    if (!this.selectedAgentId) {
      this.tickets = [];
      return;
    }
    this.loadingTickets = true;
    this.crmService.getAllCases()
      .pipe(
        timeout(10000),
        finalize(() => this.loadingTickets = false)
      )
      .subscribe({
        next: all => {
          const selectedId = Number(this.selectedAgentId);
          this.tickets = all.filter(t => Number(t.assignedUserId) === selectedId);
          if (this.tickets.length > 0) {
            this.selectTicket(this.tickets[0].id);
          } else {
            this.selectedTicketId = null;
            this.selectedThread = null;
            this.evaluations = [];
          }
        },
        error: () => this.error = 'Could not load tickets for selected agent.'
      });
  }

  selectTicket(ticketId: number): void {
    this.selectedTicketId = ticketId;
    this.loadThread();
    this.loadEvaluations();
  }

  private loadThread(): void {
    const t = this.selectedTicket;
    if (!t) {
      this.selectedThread = null;
      return;
    }
    this.loadingThread = true;
    this.crmService.getThread(t.assignedUserId || 0, t.id)
      .pipe(
        timeout(12000),
        finalize(() => this.loadingThread = false)
      )
      .subscribe({
        next: thread => this.selectedThread = thread,
        error: () => this.selectedThread = null
      });
  }

  private loadEvaluations(): void {
    const t = this.selectedTicket;
    if (!t) {
      this.evaluations = [];
      return;
    }
    this.loadingEvaluations = true;
    this.crmService.getEvaluationsByCase(t.id)
      .pipe(finalize(() => this.loadingEvaluations = false))
      .subscribe({
        next: rows => this.evaluations = rows,
        error: () => this.evaluations = []
      });
  }

  createEvaluation(): void {
    const t = this.selectedTicket;
    if (!t || !t.assignedUserId) {
      this.error = 'Select a valid assigned ticket.';
      return;
    }
    this.error = '';
    this.saving = true;
    this.crmService.createEvaluation({
      conversationId: t.id,
      evaluatedUserId: t.assignedUserId,
      score: this.score,
      strengths: this.strengths,
      improvements: this.improvements,
      comment: this.comment
    }).pipe(finalize(() => this.saving = false))
      .subscribe({
        next: ev => {
          this.evaluations = [ev, ...this.evaluations];
          this.strengths = '';
          this.improvements = '';
          this.comment = '';
          this.info = 'Evaluation created.';
        },
        error: err => {
          this.error = err?.error?.message || 'Failed to create evaluation.';
        }
      });
  }

  private normalizeRole(raw: string): string {
    const role = (raw || '').toUpperCase().replace('ROLE_', '');
    if (role === '2') return 'AGENT';
    if (role === '1') return 'ADMIN';
    return role;
  }
}
