/**
 * Escapes HTML special characters in a string to prevent XSS.
 * @param input The input to escape (will be coerced to string).
 * @returns The escaped string.
 */
export function escapeHtml(input: any): string {
  const str = String(input);
  return str.replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m] as string;
  });
}
