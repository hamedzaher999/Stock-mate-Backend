import { randomBytes } from 'crypto';

export function generateRequestNumber(prefix: string): string {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const randomPart = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}
