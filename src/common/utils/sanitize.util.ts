export function stripHtml(input: string): string {
    return input
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .trim();
}
