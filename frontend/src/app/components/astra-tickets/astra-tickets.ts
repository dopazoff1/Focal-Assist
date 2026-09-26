import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AstraKbService, AstraTicket } from '../../services/astra-kb';

@Component({
  selector: 'app-astra-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './astra-tickets.html',
  styleUrls: ['./astra-tickets.css']
})
export class AstraTicketsComponent implements OnInit {
  loading = false;
  saving = false;
  error = '';
  success = '';

  tickets: AstraTicket[] = [];
  selected: AstraTicket | null = null;

  search = '';
  statusFilter = 'ALL';
  updateStatus = '';
  assigneeName = '';
  internalNote = '';

  constructor(private astra: AstraKbService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.astra.listTickets().subscribe({
      next: rows => {
        this.tickets = rows || [];
        if (this.selected) {
          const refreshed = this.tickets.find(t => t.id === this.selected!.id);
          this.select(refreshed || this.tickets[0] || null);
        } else {
          this.select(this.tickets[0] || null);
        }
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load public ticket queue.';
      }
    });
  }

  get filteredTickets(): AstraTicket[] {
    const query = this.search.trim().toLowerCase();
    return this.tickets.filter(ticket => {
      if (this.statusFilter !== 'ALL' && (ticket.status || '').toUpperCase() !== this.statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const bag = `${ticket.ticketKey} ${ticket.subject} ${ticket.requesterEmail} ${ticket.requesterName}`.toLowerCase();
      return bag.includes(query);
    });
  }

  select(ticket: AstraTicket | null): void {
    this.selected = ticket;
    this.error = '';
    this.success = '';
    if (!ticket) {
      this.updateStatus = '';
      this.assigneeName = '';
      this.internalNote = '';
      return;
    }
    this.updateStatus = ticket.status || 'OPEN';
    this.assigneeName = ticket.assigneeName || '';
    this.internalNote = '';
  }

  save(): void {
    if (!this.selected || this.saving) {
      return;
    }
    this.saving = true;
    this.error = '';
    this.success = '';

    this.astra
      .updateTicket(this.selected.id, {
        status: this.updateStatus,
        assigneeName: this.assigneeName.trim() || '',
        internalNote: this.internalNote.trim() || ''
      })
      .subscribe({
        next: (result: any) => {
          this.saving = false;
          this.success = 'Ticket updated.';
          this.internalNote = '';
          const updated: AstraTicket | undefined = result?.ticket;
          if (updated) {
            const idx = this.tickets.findIndex(row => row.id === updated.id);
            if (idx >= 0) {
              this.tickets[idx] = updated;
            }
            this.tickets = [...this.tickets].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            const refreshed = this.tickets.find(row => row.id === updated.id) || null;
            this.select(refreshed);
          } else {
            this.load();
          }
        },
        error: err => {
          this.saving = false;
          this.error = err?.error?.message || err?.message || 'Could not update ticket.';
        }
      });
  }
}
