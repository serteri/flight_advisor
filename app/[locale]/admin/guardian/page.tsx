import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUserEmail, isAdmin } from '@/lib/auth/currentUser';
import { getEmailReadiness } from '@/lib/email/status';
import { isLiveFlightData } from '@/lib/flightData/client';
import { getGuardianOpsSnapshot } from '@/lib/guardian/opsSnapshot';
import { getPublishScheduleStatus, PUBLISH_SCHEDULE_CRON, type ScheduleStatus } from '@/lib/guardian/publishSchedule';

export const dynamic = 'force-dynamic';

// Operators only (ADMIN_EMAIL, same rule as /admin/claims). Shows counts, ids,
// statuses and failure text: never email addresses, passenger names or secrets.

const fmt = (d: Date | null | undefined) => (d ? d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'never');

function Badge({ ok, children }: { ok: boolean | 'warn'; children: React.ReactNode }) {
    const tone = ok === true ? 'bg-emerald-50 text-emerald-700' : ok === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
    return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{children}</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-2 text-sm first:border-t-0">
            <dt className="text-slate-600">{label}</dt>
            <dd className="text-right font-medium text-slate-900">{children}</dd>
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
            <dl>{children}</dl>
        </section>
    );
}

async function scheduleStatusWithTimeout(): Promise<ScheduleStatus> {
    const timeout = new Promise<ScheduleStatus>((resolve) =>
        setTimeout(() => resolve({ health: 'UNREACHABLE', tokenPresent: true, detail: 'timed out after 5 s' }), 5000),
    );
    return Promise.race([getPublishScheduleStatus(), timeout]);
}

export default async function AdminGuardianPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);

    // Authorization first: nothing below runs for a non-admin.
    const email = await getCurrentUserEmail();
    if (!isAdmin(email)) notFound();

    const [snapshot, schedule] = await Promise.all([getGuardianOpsSnapshot(), scheduleStatusWithTimeout()]);
    const emailReadiness = getEmailReadiness();
    const q = snapshot.quota;
    const live = isLiveFlightData();
    const hasProviderCredentials = Boolean(process.env.RAPID_API_KEY?.trim() && process.env.RAPID_API_HOST_AERODATABOX?.trim());
    const qstashConfigured = Boolean(
        process.env.QSTASH_TOKEN?.trim() && process.env.QSTASH_URL?.trim() &&
        process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() && process.env.QSTASH_NEXT_SIGNING_KEY?.trim(),
    );
    const lastRun = snapshot.lastPublishDue;

    return (
        <div className="container mx-auto px-4 py-8 md:px-6">
            <div className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900">Guardian operations</h1>
                <p className="mt-1 text-sm text-slate-600">Generated {fmt(snapshot.generatedAt)}. No personal data or secrets are shown here.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card title="System: email delivery">
                    <Row label="State">
                        <Badge ok={emailReadiness.state === 'READY' ? true : emailReadiness.state === 'DELIVERY_DISABLED' ? 'warn' : false}>
                            {emailReadiness.state}
                        </Badge>
                    </Row>
                    <Row label="Real sending enabled">{emailReadiness.deliveryEnabled ? 'yes' : 'no (EMAIL_DELIVERY_READY / VERCEL_ENV)'}</Row>
                    <Row label="Provider">{emailReadiness.provider}{emailReadiness.providerConfigured ? '' : ' (credentials missing)'}</Row>
                    <Row label="Sender address configured">{emailReadiness.fromConfigured ? 'yes' : 'NO'}</Row>
                    <Row label="Public app URL valid">{emailReadiness.appUrlValid ? 'yes' : 'NO'}</Row>
                    {emailReadiness.configIssues.length > 0 && (
                        <Row label="Missing / invalid (names)">{emailReadiness.configIssues.join(', ')}</Row>
                    )}
                </Card>

                <Card title="System: QStash">
                    <Row label="Credentials configured"><Badge ok={qstashConfigured}>{qstashConfigured ? 'yes' : 'NO'}</Badge></Row>
                    <Row label="Publish-due schedule">
                        <Badge ok={schedule.health === 'HEALTHY'}>{schedule.health}</Badge>
                    </Row>
                    {schedule.detail && <Row label="Detail">{schedule.detail}</Row>}
                    <Row label="Expected cron">{PUBLISH_SCHEDULE_CRON} (UTC)</Row>
                    <Row label="Last successful publish-due run">{fmt(lastRun?.at)}</Row>
                    <Row label="Last run: published / failed">{lastRun ? `${lastRun.published} / ${lastRun.failed}` : 'n/a'}</Row>
                    <Row label="Last run: skipped stale / deferred">{lastRun ? `${lastRun.stale} / ${lastRun.deferred}` : 'n/a'}</Row>
                    <Row label="Due now (unpublished checks)">{snapshot.checks.unpublished}</Row>
                    <Row label="Latest failure">{fmt(snapshot.latestFailureAt)}</Row>
                </Card>

                <Card title="System: AeroDataBox">
                    <Row label="Mode"><Badge ok={live ? true : 'warn'}>{live ? 'LIVE' : 'MOCK (not production)'}</Badge></Row>
                    <Row label="Credentials configured"><Badge ok={hasProviderCredentials}>{hasProviderCredentials ? 'yes' : 'NO'}</Badge></Row>
                    <Row label={`Monthly allocation (${snapshot.quotaPeriod})`}>{q.monthlyAllocationUnits} units</Row>
                    <Row label="Quota used">{q.unitsUsed} units ({q.usedPercent}%)</Row>
                    <Row label="Quota remaining">{q.unitsRemaining} units</Row>
                    <Row label="Estimated calls used / remaining">{q.estimatedCallsUsed} / {q.estimatedCallsRemaining}</Row>
                    <Row label="Quota status">
                        <Badge ok={q.level === 'OK' ? true : q.level === 'SKIP_EARLY' ? 'warn' : false}>{q.level}</Badge>
                    </Row>
                    <Row label="Additional normal trips supportable">{q.additionalNormalTrips}</Row>
                    <Row label="Usage figure source">{q.source === 'PROVIDER_HEADERS' ? 'provider headers' : 'internal counter'}</Row>
                </Card>

                <Card title="Monitoring">
                    <Row label="Active monitored trips">{snapshot.trips.active}</Row>
                    <Row label="Pending confirmations">{snapshot.trips.pendingConfirmation}</Row>
                    <Row label="Pending verification">{snapshot.trips.pendingVerification}</Row>
                    <Row label="Flight not found">{snapshot.trips.flightNotFound}</Row>
                    <Row label="Completed">{snapshot.trips.completed}</Row>
                </Card>

                <Card title="Scheduled checks">
                    <Row label="Scheduled, not yet published">{snapshot.checks.unpublished}</Row>
                    <Row label="Published (waiting for QStash)">{snapshot.checks.published}</Row>
                    <Row label="Running now (trip leases)">{snapshot.checks.running}</Row>
                    <Row label="Failed (total / last 24 h)">{snapshot.checks.failed} / {snapshot.checks.failedLast24h}</Row>
                    <Row label="Stale (overdue > 24 h, still SCHEDULED)">
                        <Badge ok={snapshot.checks.stale === 0 ? true : false}>{snapshot.checks.stale}</Badge>
                    </Row>
                </Card>
            </div>

            <section className="mt-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Latest failures</h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Time</th>
                                <th className="px-3 py-2">Trip</th>
                                <th className="px-3 py-2">Check</th>
                                <th className="px-3 py-2">Checkpoint</th>
                                <th className="px-3 py-2">Failure type</th>
                                <th className="px-3 py-2">Provider / status</th>
                                <th className="px-3 py-2">Retry state</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshot.failures.length === 0 && (
                                <tr><td className="px-3 py-4 text-slate-500" colSpan={7}>No failed checks.</td></tr>
                            )}
                            {snapshot.failures.map((f) => (
                                <tr key={f.checkId} className="border-t border-slate-100 align-top">
                                    <td className="px-3 py-2 text-slate-600">{fmt(f.at)}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{f.tripId}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{f.checkId}</td>
                                    <td className="px-3 py-2">{f.kind}</td>
                                    <td className="px-3 py-2">{f.failureClass}</td>
                                    <td className="px-3 py-2 text-xs text-slate-700">{f.code ?? ''} {f.detail}</td>
                                    <td className="px-3 py-2">{f.retryState === 'RETRY_PENDING' ? 'retry pending' : 'final'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
