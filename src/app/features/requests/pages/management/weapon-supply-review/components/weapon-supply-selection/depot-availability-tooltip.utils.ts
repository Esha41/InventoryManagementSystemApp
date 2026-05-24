export interface DepotTooltipPositionOptions {
  isRTL: boolean;
  tooltipWidth: number;
  tooltipHeight: number;
  viewportPad?: number;
  gap?: number;
}

export type DepotTooltipStyles = Record<string, string>;

/**
 * Position a fixed tooltip beside the depot row accent (inline-start of the anchor cell).
 */
export function computeDepotAvailabilityTooltipPosition(
  anchorRect: DOMRect,
  options: DepotTooltipPositionOptions
): DepotTooltipStyles {
  const pad = options.viewportPad ?? 12;
  const gap = options.gap ?? 8;
  const maxWidth = Math.min(280, window.innerWidth - pad * 2);
  const width = Math.min(options.tooltipWidth, maxWidth);
  const height = options.tooltipHeight;

  let top = anchorRect.bottom + gap;
  if (top + height > window.innerHeight - pad) {
    top = Math.max(pad, anchorRect.top - height - gap);
  }

  let left: number;
  if (options.isRTL) {
    left = anchorRect.right - width;
  } else {
    left = anchorRect.left;
  }

  left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxWidth: `${Math.round(maxWidth)}px`
  };
}
