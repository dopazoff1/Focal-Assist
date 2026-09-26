import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AstraPublicKbComponent } from '../astra-public-kb/astra-public-kb';

@Component({
  selector: 'app-astra-help-center',
  standalone: true,
  imports: [CommonModule, RouterModule, AstraPublicKbComponent],
  templateUrl: './astra-help-center.html',
  styleUrls: ['./astra-help-center.css']
})
export class AstraHelpCenterComponent {}
