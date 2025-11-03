import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Upload } from 'lucide-angular';

@Component({
  selector: 'app-discard-request',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ButtonComponent,
    LucideAngularModule
  ],
  templateUrl: './discard-request.component.html',
  styleUrls: ['./discard-request.component.css']
})
export class DiscardRequestComponent {
  readonly Upload = Upload;

  dateCreated: string = '';
  discardOrderId: string = '';
  quantity: string = '';
  comments: string = '';
  attachment: File | null = null;
  attachmentName: string = '';

  isSubmitted = false;
  errors: { [key: string]: string } = {};

  constructor() {
    const today = new Date();
    this.dateCreated = this.formatDate(today);
  }

  private formatDate(date: Date): string {
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}, ${month} - ${year}`;
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.attachment = input.files[0];
      this.attachmentName = input.files[0].name;
    }
  }

  removeAttachment(): void {
    this.attachment = null;
    this.attachmentName = '';
    const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
    fileInput?.click();
  }

  onSendRequest(form: NgForm): void {
    this.isSubmitted = true;
    this.errors = {};

    if (!this.discardOrderId.trim()) {
      this.errors['discardOrderId'] = 'Discard Order ID is required';
    }

    if (!this.quantity.trim()) {
      this.errors['quantity'] = 'Quantity is required';
    } else if (!/^\d+(,\d{3})*$/.test(this.quantity.replace(/\s/g, ''))) {
      this.errors['quantity'] = 'Please enter a valid quantity (e.g., 20,000)';
    }

    if (Object.keys(this.errors).length > 0) {
      return;
    }

    const requestData = {
      dateCreated: this.dateCreated,
      discardOrderId: this.discardOrderId,
      quantity: this.quantity,
      comments: this.comments || 'None',
      attachment: this.attachment
    };

    console.log('Discard Request submitted:', requestData);
    alert('Discard request submitted successfully!');
    this.resetForm();
  }

  hasError(fieldName: string): boolean {
    return this.isSubmitted && !!this.errors[fieldName];
  }

  getError(fieldName: string): string {
    return this.errors[fieldName] || '';
  }

  private resetForm(): void {
    const today = new Date();
    this.dateCreated = this.formatDate(today);
    this.discardOrderId = '';
    this.quantity = '';
    this.comments = '';
    this.attachment = null;
    this.attachmentName = '';
    this.isSubmitted = false;
    this.errors = {};

    const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}

