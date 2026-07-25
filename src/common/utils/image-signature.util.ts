const SIGNATURES: { mime: string; check: (buf: Buffer) => boolean }[] = [
    {
        mime: 'image/jpeg',
        check: (buf) =>
            buf.length >= 3 &&
            buf[0] === 0xff &&
            buf[1] === 0xd8 &&
            buf[2] === 0xff,
    },
    {
        mime: 'image/png',
        check: (buf) =>
            buf.length >= 8 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a,
    },
    {
        mime: 'image/webp',
        check: (buf) =>
            buf.length >= 12 &&
            buf.toString('ascii', 0, 4) === 'RIFF' &&
            buf.toString('ascii', 8, 12) === 'WEBP',
    },
];

export function detectImageMimeType(buffer: Buffer): string | null {
    const match = SIGNATURES.find((sig) => sig.check(buffer));
    return match ? match.mime : null;
}
