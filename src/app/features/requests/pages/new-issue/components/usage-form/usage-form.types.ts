/** Field-level validation messages (i18n keys) for the usage step form. */
export type UsageFormErrors = {
  usePurpose: string | null;
  requestPurposeNotes: string | null;
  usageLocation: string | null;
  usageDateFrom: string | null;
  usageTimeFrom: string | null;
  usageDateTo: string | null;
  usageTimeTo: string | null;
  selectedFiles: string | null;
  attachmentRequirements: string | null;
};

/** Optional overrides when validating date range before parent @Input updates. */
export type UsageDateRangeOverrides = Partial<{
  usageDateFrom: string;
  usageTimeFrom: string;
  usageDateTo: string;
  usageTimeTo: string;
}>;
