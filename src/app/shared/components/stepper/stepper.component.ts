import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface Step {
  label: string;
  completed: boolean;
  isDelegation?: boolean;
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.css']
})
export class StepperComponent {
  @Input() steps: Step[] = [];
  @Input() currentStep: number = 0;
  @Output() stepChange = new EventEmitter<number>();

  onStepClick(index: number): void {
    if (index <= this.currentStep || this.steps[index - 1]?.completed) {
      this.stepChange.emit(index);
    }
  }

  isStepActive(index: number): boolean {
    return index === this.currentStep;
  }

  isStepCompleted(index: number): boolean {
    return index < this.currentStep || this.steps[index].completed;
  }

  isStepClickable(index: number): boolean {
    return index <= this.currentStep || this.steps[index - 1]?.completed;
  }
}

