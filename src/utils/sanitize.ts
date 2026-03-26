const TAG_REGEX = /<[^>]*>/g;

export function sanitizeText(input: string, maxLength = 500): string {
  return input
    .trim()
    .replace(TAG_REGEX, '')
    .slice(0, maxLength);
}

export function sanitizeName(input: string, maxLength = 50): string {
  return input
    .trim()
    .replace(TAG_REGEX, '')
    .slice(0, maxLength);
}
