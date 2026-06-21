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

interface WelcomeTripEmailProps {
    flightNumber: string;
    magicLink: string;
}

export function WelcomeTripEmail({ flightNumber, magicLink }: WelcomeTripEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Your flight {flightNumber} is now protected by FlightAgent Guardian.</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={badge}>
                        <Text style={badgeText}>FlightAgent Guardian</Text>
                    </Section>

                    <Heading style={heading}>Your flight is now protected</Heading>

                    <Text style={paragraph}>
                        Your flight <strong>{flightNumber}</strong> has been placed under monitoring.
                        Click the button below to see the details and audit log.
                    </Text>

                    <Section style={ctaSection}>
                        <Button style={button} href={magicLink}>
                            View my trip
                        </Button>
                    </Section>

                    <Hr style={hr} />

                    <Text style={footer}>
                        If the button doesn't work, copy and paste this link into your browser:
                        <br />
                        <a href={magicLink} style={footerLink}>{magicLink}</a>
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

export default WelcomeTripEmail;

const main = {
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    maxWidth: '480px',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
};

const badge = {
    display: 'inline-block',
    backgroundColor: '#ecfdf5',
    borderRadius: '999px',
    padding: '6px 14px',
    marginBottom: '16px',
};

const badgeText = {
    color: '#059669',
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
    margin: '0 0 16px',
};

const paragraph = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#475569',
};

const ctaSection = {
    textAlign: 'center' as const,
    margin: '28px 0',
};

const button = {
    backgroundColor: '#0284c7',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center' as const,
    padding: '14px 28px',
    display: 'inline-block',
};

const hr = {
    borderColor: '#e2e8f0',
    margin: '24px 0',
};

const footer = {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '20px',
};

const footerLink = {
    color: '#0284c7',
    wordBreak: 'break-all' as const,
};
