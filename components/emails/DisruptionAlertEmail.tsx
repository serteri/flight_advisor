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

interface DisruptionAlertEmailProps {
    flightNumber: string;
    claimLink: string;
}

export function DisruptionAlertEmail({ flightNumber, claimLink }: DisruptionAlertEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Urgent: Your flight {flightNumber} has a major disruption. Claim up to EUR 600.</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={badge}>
                        <Text style={badgeText}>FlightAgent Emergency Update</Text>
                    </Section>

                    <Heading style={heading}>Your flight {flightNumber} has been disrupted</Heading>

                    <Text style={paragraph}>
                        We detected a critical status change for your booking. Your flight may be cancelled
                        or severely delayed.
                    </Text>

                    <Section style={alertBox}>
                        <Text style={alertTitle}>Compensation opportunity</Text>
                        <Text style={alertBody}>
                            Flight <strong>{flightNumber}</strong> appears disrupted. You may be eligible for up to
                            <strong> EUR 600</strong> in compensation.
                        </Text>
                    </Section>

                    <Section style={ctaSection}>
                        <Button style={button} href={claimLink}>
                            Start my compensation file
                        </Button>
                    </Section>

                    <Text style={paragraphSecondary}>
                        If this event is confirmed, acting early helps preserve documents and speeds up your claim.
                        We will keep monitoring and notify you of major updates.
                    </Text>

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
    backgroundColor: '#fee2e2',
    borderRadius: '999px',
    padding: '6px 14px',
    marginBottom: '16px',
};

const badgeText = {
    color: '#b91c1c',
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
    backgroundColor: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '20px 0',
};

const alertTitle = {
    margin: '0 0 8px',
    color: '#9f1239',
    fontWeight: 700,
    fontSize: '14px',
};

const alertBody = {
    margin: 0,
    color: '#881337',
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
