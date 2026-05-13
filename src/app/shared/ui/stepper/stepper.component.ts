import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';
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
export class StepperComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() steps: Step[] = [];
  @Input() currentStep: number = 0;
  
  @Input() animateWhenAmmunitionSelected = false;
  @Output() stepChange = new EventEmitter<number>();


  stepperEnterActive = true;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.animateWhenAmmunitionSelected) {
      this.stepperEnterActive = true;
      return;
    }

    const ammoAnimTurnedOn =
      !!changes['animateWhenAmmunitionSelected'] &&
      changes['animateWhenAmmunitionSelected'].previousValue === false &&
      changes['animateWhenAmmunitionSelected'].currentValue === true;

    const stepChanged =
      !!changes['currentStep'] && !changes['currentStep'].firstChange;
    const stepsLengthChanged =
      !!changes['steps'] &&
      !changes['steps'].firstChange &&
      (changes['steps'].previousValue as Step[] | undefined)?.length !==
        (changes['steps'].currentValue as Step[] | undefined)?.length;

    if (!ammoAnimTurnedOn && !stepChanged && !stepsLengthChanged) {
      return;
    }

    this.stepperEnterActive = false;
    this.cdr.markForCheck();
    queueMicrotask(() => {
      this.stepperEnterActive = true;
      this.cdr.markForCheck();
    });
  }

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

  isConnectorCompleted(index: number): boolean {
    return index < this.currentStep;
  }
}

