import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';
import { AppComponent } from './app/app.component';
// Disable logs in production
if (!environment.enableLogging) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // keep errors if you want visibility
  // console.error = () => {};
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

