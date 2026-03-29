import { TranslateService } from '@ngx-translate/core';
import { DriveStep, Side } from 'driver.js';

export function getPageTourSteps(
  pageKey: string,
  translate: TranslateService,
  isRTL: boolean
): DriveStep[] {
  const popoverSide: Side = isRTL ? 'left' : 'right';

  switch (pageKey) {
    case 'issue-request':
      return getIssueRequestSteps(translate, popoverSide);
    case 'return-request':
      return getReturnRequestSteps(translate, popoverSide);
    case 'discard-request':
      return getDiscardRequestSteps(translate, popoverSide);
    case 'add-asset':
      return getAddAssetSteps(translate, popoverSide);
    case 'asset-list':
      return getAssetListSteps(translate, popoverSide);
    default:
      return [];
  }
}

function getIssueRequestSteps(translate: TranslateService, _popoverSide: Side): DriveStep[] {
  return [
    {
      popover: {
        title: translate.instant('onboarding.pageTour.issueRequest.intro.title'),
        description: translate.instant('onboarding.pageTour.issueRequest.intro.description'),
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="issue-stepper"]',
      popover: {
        title: translate.instant('onboarding.pageTour.issueRequest.stepper.title'),
        description: translate.instant('onboarding.pageTour.issueRequest.stepper.description'),
        side: 'bottom',
        align: 'center',
      },
    },
  ];
}

function getReturnRequestSteps(translate: TranslateService, _popoverSide: Side): DriveStep[] {
  return [
    {
      popover: {
        title: translate.instant('onboarding.pageTour.returnRequest.intro.title'),
        description: translate.instant('onboarding.pageTour.returnRequest.intro.description'),
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="return-tabs"]',
      popover: {
        title: translate.instant('onboarding.pageTour.returnRequest.tabs.title'),
        description: translate.instant('onboarding.pageTour.returnRequest.tabs.description'),
        side: 'bottom',
        align: 'center',
      },
    },
  ];
}

function getDiscardRequestSteps(translate: TranslateService, _popoverSide: Side): DriveStep[] {
  return [
    {
      popover: {
        title: translate.instant('onboarding.pageTour.discardRequest.intro.title'),
        description: translate.instant('onboarding.pageTour.discardRequest.intro.description'),
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="discard-tabs"]',
      popover: {
        title: translate.instant('onboarding.pageTour.discardRequest.tabs.title'),
        description: translate.instant('onboarding.pageTour.discardRequest.tabs.description'),
        side: 'bottom',
        align: 'center',
      },
    },
  ];
}

function getAddAssetSteps(translate: TranslateService, _popoverSide: Side): DriveStep[] {
  return [
    {
      popover: {
        title: translate.instant('onboarding.pageTour.addAsset.intro.title'),
        description: translate.instant('onboarding.pageTour.addAsset.intro.description'),
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="add-asset-tabs"]',
      popover: {
        title: translate.instant('onboarding.pageTour.addAsset.tabs.title'),
        description: translate.instant('onboarding.pageTour.addAsset.tabs.description'),
        side: 'bottom',
        align: 'center',
      },
    },
  ];
}

function getAssetListSteps(translate: TranslateService, _popoverSide: Side): DriveStep[] {
  return [
    {
      popover: {
        title: translate.instant('onboarding.pageTour.assetList.intro.title'),
        description: translate.instant('onboarding.pageTour.assetList.intro.description'),
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="asset-list-header"]',
      popover: {
        title: translate.instant('onboarding.pageTour.assetList.header.title'),
        description: translate.instant('onboarding.pageTour.assetList.header.description'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-onboarding="asset-list-filters"]',
      popover: {
        title: translate.instant('onboarding.pageTour.assetList.filters.title'),
        description: translate.instant('onboarding.pageTour.assetList.filters.description'),
        side: 'bottom',
        align: 'center',
      },
    },
  ];
}
