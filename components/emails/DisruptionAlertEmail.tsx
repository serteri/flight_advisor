import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from '@react-email/components';

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED' | 'REFUND_AND_EXPENSES';

interface DisruptionAlertEmailProps {
    flightNumber: string;
    claimLink: string;
    claimRuleType?: ClaimRuleType;
}

interface ClaimTypeContent {
    preview: string;
    heading: string;
    alertTitle: string;
    alertBody: string;
    ctaLabel: string;
    supportText: string;
}

const CONTENT_MAP: Record<ClaimRuleType, ClaimTypeContent> = {
    COMPENSATION_CANCELLED: {
        preview: `Your flight FLIGHT has been cancelled — find out your rights.`,
        heading: `Your flight FLIGHT has been cancelled`,
        alertTitle: 'Cancellation Rights Detected',
        alertBody:
            'Flight FLIGHT appears to be cancelled. Depending on the airline and route, you may be entitled to a full refund or rebooking at no cost.',
        ctaLabel: 'Check My Cancellation Rights',
        supportText:
            'Acting early helps preserve your documents and options. We will keep monitoring and notify you of any updates.',
    },
    COMPENSATION_DELAYED: {
        preview: `Your flight FLIGHT is severely delayed — find out your options.`,
        heading: `Your flight FLIGHT has a major delay`,
        alertTitle: 'Significant Delay Detected (3h+)',
        alertBody:
            'Flight FLIGHT has been delayed by 3 hours or more at the arrival gate. You may be entitled to delay compensation under applicable regulations.',
        ctaLabel: 'Check My Delay Rights',
        supportText:
            'We are continuing to monitor your flight. If the delay is confirmed, your case file will be ready to submit.',
    },
    REFUND_AND_EXPENSES: {
        preview: `Your flight FLIGHT was disrupted — refund and expense options available.`,
        heading: `Your flight FLIGHT has been disrupted`,
        alertTitle: 'Refund & Expenses Process Available',
        alertBody:
            'Flight FLIGHT appears disrupted. For routes where EU261 does not apply, you may still be eligible for a ticket refund and reasonable out-of-pocket expense reimbursement.',
        ctaLabel: 'Start My Refund Process',
        supportText:
            'Keep all receipts for meals, accommodation or alternative transport. These may be claimable. We will keep monitoring your flight.',
    },
};

const DEFAULT_RULE_TYPE: ClaimRuleType = 'COMPENSATION_DELAYED';

function resolveContent(flightNumber: string, ruleType?: ClaimRuleType): ClaimTypeContent {
    const base = CONTENT_MAP[ruleType ?? DEFAULT_RULE_TYPE] ?? CONTENT_MAP[DEFAULT_RULE_TYPE];
    const replace = (str: string) => str.replace(/FLIGHT/g, flightNumber);
    return {
        preview:     replace(base.preview),
        heading:     replace(base.heading),
        alertTitle:  base.alertTitle,
        alertBody:   replace(base.alertBody),
        ctaLabel:    base.ctaLabel,
        supportText: base.supportText,
    };
}

export function DisruptionAlertEmail({
    flightNumber,
    claimLink,
    claimRuleType,
}: DisruptionAlertEmailProps) {
    const content = resolveContent(flightNumber, claimRuleType);

    return (
        <Html>
            <Head />
            <Preview>{content.preview}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={badge}>
                        <Text style={badgeText}>FlightAgent Alert</Text>
                    </Section>

                    <Heading style={heading}>{content.heading}</Heading>

                    <Text style={paragraph}>
                        We detected a significant status change for your booking. Our system is
                        actively monitoring your flight and will keep you updated.
                    </Text>

                    <Section style={alertBox}>
                        <Text style={alertTitle}>{content.alertTitle}</Text>
                        <Text style={alertBody}>{content.alertBody}</Text>
                    </Section>

                    <Section style={ctaSection}>
                        <Button style={button} href={claimLink}>
                            {content.ctaLabel}
                        </Button>
                    </Section>

                    <Text style={paragraphSecondary}>{content.supportText}</Text>

                    <Hr style={hr} />

                    <Text style={footer}>
                        If the button does not work, copy this link into your browser:
                        <br />
                        <a href={claimLink} style={footerLink}>{claimLink}</a>
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

export default DisruptionAlertEmail;

const main = {
    backgroundColor: '#f5f7fb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    maxWidth: '520px',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
};

const badge = {
    display: 'inline-block',
    backgroundColor: '#fef3c7',
    borderRadius: '999px',
    padding: '6px 14px',
    marginBottom: '16px',
};

const badgeText = {
    color: '#92400e',
    fontSize: '12px',
    fontWeight: 700,
    margin: 0,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
};

const heading = {
    fontSize: '24px',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 14px',
};

const paragraph = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#334155',
};

const alertBox = {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '20px 0',
};

const alertTitle = {
    margin: '0 0 8px',
    color: '#78350f',
    fontWeight: 700,
    fontSize: '14px',
};

const alertBody = {
    margin: 0,
    color: '#92400e',
    fontSize: '14px',
    lineHeight: '22px',
};

const ctaSection = {
    textAlign: 'center' as const,
    margin: '24px 0',
};

const button = {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center' as const,
    padding: '14px 24px',
    display: 'inline-block',
};

const paragraphSecondary = {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#475569',
};

const hr = {
    borderColor: '#e2e8f0',
    margin: '22px 0',
};

const footer = {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '20px',
};

const footerLink = {
    color: '#0f172a',
    wordBreak: 'break-all' as const,
};

