import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Chart, registerables } from 'chart.js';
import { ButtonComponent } from '@components/button/button.component';

Chart.register(...registerables);

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonComponent],
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.css']
})
export class ForecastComponent implements OnInit, AfterViewInit {
  @ViewChild('weeklyIssuesChart') weeklyIssuesChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyPerformanceChart') monthlyPerformanceChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ammunitionChart') ammunitionChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('budgetChart') budgetChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('annualBudgetChart') annualBudgetChart!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.createWeeklyIssuesChart();
    this.createMonthlyPerformanceChart();
    this.createAmmunitionChart();
    this.createBudgetChart();
    this.createAnnualBudgetChart();
  }

  private createWeeklyIssuesChart(): void {
    const ctx = this.weeklyIssuesChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            data: [45, 52, 38, 60, 48, 35, 42],
            backgroundColor: ['#E5E7EB', '#E5E7EB', '#D0B888', '#E5E7EB', '#E5E7EB', '#E5E7EB', '#E5E7EB'],
            borderRadius: 4,
            barThickness: 30
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 80,
              ticks: { stepSize: 20 },
              grid: { display: true, color: '#F3F4F8' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  private createMonthlyPerformanceChart(): void {
    const ctx = this.monthlyPerformanceChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            data: [45, 52, 48, 58, 62, 55],
            borderColor: '#D0B888',
            backgroundColor: 'rgba(208, 184, 136, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              display: false
            },
            x: {
              grid: { display: false },
              ticks: { color: '#8B909A', font: { size: 11 } }
            }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  private createAmmunitionChart(): void {
    const ctx = this.ammunitionChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [19, 89, 45, 51],
            backgroundColor: ['#0F60FF', '#D0B888', '#FFA500', '#7E22CE'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  private createBudgetChart(): void {
    const ctx = this.budgetChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [35, 5],
            backgroundColor: ['#C9A671', '#E5E7EB'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
          rotation: -90,
          circumference: 180,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  private createAnnualBudgetChart(): void {
    const ctx = this.annualBudgetChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            data: [8, 10, 9, 12, 11, 10],
            borderColor: 'transparent',
            backgroundColor: 'rgba(208, 184, 136, 0.3)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              display: false
            },
            x: {
              grid: { display: false },
              ticks: { color: '#8B909A', font: { size: 10 } }
            }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  ngOnDestroy(): void {
    this.charts.forEach(chart => chart.destroy());
  }
}
