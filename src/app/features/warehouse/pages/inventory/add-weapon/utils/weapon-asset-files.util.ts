/** Append uploaded files de-duplicating by name+size+lastModified (legacy behavior). */
export function mergeUploadedFilesDeduped(existing: File[], newlySelected: File[]): File[] {
  if (!newlySelected.length) return existing;
  const combined = [...existing, ...newlySelected];
  const seen = new Set<string>();
  return combined.filter((f) => {
    const key = `${f.name}::${f.size}::${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatFileSizeHuman(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${value} ${sizes[i]}`;
}
