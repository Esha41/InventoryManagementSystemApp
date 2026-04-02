import { TranslateService } from '@ngx-translate/core';
import { DriveStep, Side } from 'driver.js';

export function getTourSteps(
  translate: TranslateService,
  isRTL: boolean,
  onLanguageSwitch?: () => void
): DriveStep[] {
  const popoverSide: Side = isRTL ? 'left' : 'right';
  const popoverSideOpposite: Side = isRTL ? 'right' : 'left';

  const langToggleLabel = isRTL ? 'English' : 'العربية';

  const welcomeDescription = translate.instant('onboarding.welcome.description')
    + '<p class="ettad-tour-lang-hint">'
    + translate.instant('onboarding.welcome.langHint')
    + '</p>';

  return [
    {
      popover: {
        title: translate.instant('onboarding.welcome.title'),
        description: welcomeDescription,
        popoverClass: 'ettad-tour-popover ettad-tour-welcome',
        side: 'over',
        align: 'center',
        onPopoverRender: onLanguageSwitch
          ? (popover: any) => {
              const wrapper = popover.wrapper as HTMLElement;
              wrapper.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
              wrapper.setAttribute('lang', isRTL ? 'ar' : 'en');
              const footer = popover.footer as HTMLElement;
              if (!footer) return;
              const langBtn = document.createElement('button');
              langBtn.className = 'ettad-tour-lang-btn';
              langBtn.textContent = langToggleLabel;
              langBtn.addEventListener('click', (e: Event) => { e.preventDefault(); onLanguageSwitch(); });
              footer.prepend(langBtn);
            }
          : (popover: any) => {
              const wrapper = popover.wrapper as HTMLElement;
              wrapper.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
              wrapper.setAttribute('lang', isRTL ? 'ar' : 'en');
            },
      },
    },
    {
      element: '[data-onboarding="sidebar"]',
      popover: {
        title: translate.instant('onboarding.sidebar.title'),
        description: translate.instant('onboarding.sidebar.description'),
        side: popoverSide,
        align: 'start',
      },
    },
    {
      element: '[data-onboarding="main-content"]',
      popover: {
        title: translate.instant('onboarding.dashboard.title'),
        description: translate.instant('onboarding.dashboard.description'),
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="request-management"]',
      popover: {
        title: translate.instant('onboarding.requestManagement.title'),
        description: translate.instant('onboarding.requestManagement.description'),
        side: popoverSide,
        align: 'start',
      },
    },
    {
      element: '[data-onboarding="approval-management"]',
      popover: {
        title: translate.instant('onboarding.approvalManagement.title'),
        description: translate.instant('onboarding.approvalManagement.description'),
        side: popoverSide,
        align: 'start',
      },
    },
    {
      element: '[data-onboarding="theme-toggle"]',
      popover: {
        title: translate.instant('onboarding.theme.title'),
        description: translate.instant('onboarding.theme.description'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="language-toggle"]',
      popover: {
        title: translate.instant('onboarding.language.title'),
        description: translate.instant('onboarding.language.description'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="notifications"]',
      popover: {
        title: translate.instant('onboarding.notifications.title'),
        description: translate.instant('onboarding.notifications.description'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="user-profile"]',
      popover: {
        title: translate.instant('onboarding.profile.title'),
        description: translate.instant('onboarding.profile.description'),
        side: 'bottom',
        align: popoverSideOpposite === 'right' ? 'end' : 'start',
      },
    },
    {
      popover: {
        title: translate.instant('onboarding.complete.title'),
        description: translate.instant('onboarding.complete.description'),
        side: 'over',
        align: 'center',
      },
    },
  ];
}
