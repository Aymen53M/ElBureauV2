export async function copyToClipboard(text: string) {
    try {
        const nav: any = (globalThis as any)?.navigator;
        if (nav?.clipboard?.writeText) {
            await nav.clipboard.writeText(text);
            return;
        }
    } catch {
        // ignore
    }

    try {
        const doc: any = (globalThis as any)?.document;
        if (!doc?.createElement) return;
        const el = doc.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        doc.body.appendChild(el);
        el.select();
        doc.execCommand('copy');
        doc.body.removeChild(el);
    } catch {
        // ignore
    }
}
