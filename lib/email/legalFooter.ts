// lib/email/legalFooter.ts
//
// Every outgoing email carries the "not legal advice" notice. It is appended
// at the single send point (lib/email/deliver.ts) so no template can
// forget it.

export const LEGAL_DISCLAIMER_TEXT =
    'FlightAgent is not a law firm and this is not legal advice. Compensation information is an estimate based on flight data; the airline may dispute eligibility, for example by citing extraordinary circumstances.';

const HTML_MARKER = 'data-legal-disclaimer';

const htmlFooter = `<p ${HTML_MARKER} style="margin-top:24px;font-size:12px;line-height:18px;color:#64748b;">${LEGAL_DISCLAIMER_TEXT}</p>`;

export function withLegalFooter<T extends { html?: string; text?: string }>(message: T): T {
    const out = { ...message };
    if (typeof out.html === 'string' && !out.html.includes(HTML_MARKER)) {
        const bodyClose = out.html.lastIndexOf('</body>');
        out.html = bodyClose >= 0
            ? `${out.html.slice(0, bodyClose)}${htmlFooter}${out.html.slice(bodyClose)}`
            : `${out.html}${htmlFooter}`;
    }
    if (typeof out.text === 'string' && !out.text.includes(LEGAL_DISCLAIMER_TEXT)) {
        out.text = `${out.text}\n\n--\n${LEGAL_DISCLAIMER_TEXT}`;
    }
    return out;
}
