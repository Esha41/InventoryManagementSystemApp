import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { StatusCardComponent, OrderItem } from './components/status-card/status-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, StatusCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Dashboard always displays all cards regardless of permissions
  newIssueOrders: OrderItem[] = [
    { orderId: '#0172', requestDate: '25 JULY 2024' },
    { orderId: '#0166', requestDate: '18 APRIL 2024' }
  ];

  onProgressOrders: OrderItem[] = [
    { orderId: '#0170', requestDate: '6 MAY 2024' },
    { orderId: '#0169', requestDate: '1 MAY 2024' },
    { orderId: '#0168', requestDate: '24 APRIL 2024' }
  ];

  completedOrders: OrderItem[] = [
    { orderId: '#0171', requestDate: '4 JUNE 2024' },
    { orderId: '#0167', requestDate: '20 APRIL 2024' }
  ];

  ngOnInit(): void {
    // Component initialization
  }
}

