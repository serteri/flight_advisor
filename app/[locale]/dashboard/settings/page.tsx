"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

type ProfileResponse = {
    name: string | null;
    email: string;
    subscriptionPlan: string;
    subscriptionStatus: string | null;
    nextBillingDate: string | null;
};

type PreferencesResponse = {
    priceDropAlerts: boolean;
    disruptionAlerts: boolean;
    weeklySummary: boolean;
};

const toPlanLabel = (plan?: string): 'Free' | 'Basic' | 'Pro' => {
    const normalized = (plan || '').toUpperCase();
    if (normalized === 'BASIC') return 'Basic';
    if (normalized === 'PRO' || normalized === 'ELITE') return 'Pro';
    return 'Free';
};

const toStatusLabel = (status?: string | null): 'Active' | 'Cancelled' | 'Trial' | 'Unknown' => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active') return 'Active';
    if (normalized === 'trialing') return 'Trial';
    if (normalized === 'canceled' || normalized === 'cancelled') return 'Cancelled';
    return 'Unknown';
};

export default function SettingsPage() {
    const t = useTranslations('Dashboard');
    const ts = useTranslations('Settings');
    const { data: session, status } = useSession();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subscriptionPlan, setSubscriptionPlan] = useState('FREE');
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);

    const [priceDropAlerts, setPriceDropAlerts] = useState(true);
    const [disruptionAlerts, setDisruptionAlerts] = useState(true);
    const [weeklySummary, setWeeklySummary] = useState(false);

    const [loadingPage, setLoadingPage] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPreferences, setSavingPreferences] = useState(false);
    const [managingBilling, setManagingBilling] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user) {
            setLoadingPage(false);
            return;
        }

        setName(session.user.name || '');
        setEmail(session.user.email || '');
        setSubscriptionPlan(session.user.subscriptionPlan || 'FREE');

        let mounted = true;
        const loadSettings = async () => {
            try {
                const [profileRes, prefRes] = await Promise.all([
                    fetch('/api/user/profile', { method: 'GET' }),
                    fetch('/api/user/preferences', { method: 'GET' }),
                ]);

                if (profileRes.ok) {
                    const profileData = (await profileRes.json()) as ProfileResponse;
                    if (mounted) {
                        setName(profileData.name || '');
                        setEmail(profileData.email || session.user.email || '');
                        setSubscriptionPlan(profileData.subscriptionPlan || session.user.subscriptionPlan || 'FREE');
                        setSubscriptionStatus(profileData.subscriptionStatus || null);
                        setNextBillingDate(profileData.nextBillingDate || null);
                    }
                }

                if (prefRes.ok) {
                    const prefData = (await prefRes.json()) as PreferencesResponse;
                    if (mounted) {
                        setPriceDropAlerts(Boolean(prefData.priceDropAlerts));
                        setDisruptionAlerts(Boolean(prefData.disruptionAlerts));
                        setWeeklySummary(Boolean(prefData.weeklySummary));
                    }
                }
            } catch (error) {
                console.error('[SETTINGS] Failed to load settings:', error);
                toast.error(ts('toast.loadFailed'));
            } finally {
                if (mounted) setLoadingPage(false);
            }
        };

        loadSettings();

        return () => {
            mounted = false;
        };
    }, [session, status]);

    const planLabel = useMemo(() => toPlanLabel(subscriptionPlan), [subscriptionPlan]);
    const statusLabel = useMemo(() => toStatusLabel(subscriptionStatus), [subscriptionStatus]);

    const onSaveProfile = async () => {
        if (!name.trim()) {
            toast.error(ts('toast.nameEmpty'));
            return;
        }

        setSavingProfile(true);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || ts('toast.saveProfileFailed'));
            }

            toast.success(ts('toast.profileUpdated'));
        } catch (error) {
            const message = error instanceof Error ? error.message : ts('toast.saveProfileFailed');
            toast.error(message);
        } finally {
            setSavingProfile(false);
        }
    };

    const onSavePreferences = async () => {
        setSavingPreferences(true);
        try {
            const res = await fetch('/api/user/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceDropAlerts,
                    disruptionAlerts,
                    weeklySummary,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || ts('toast.savePreferencesFailed'));
            }

            toast.success(ts('toast.preferencesSaved'));
        } catch (error) {
            const message = error instanceof Error ? error.message : ts('toast.savePreferencesFailed');
            toast.error(message);
        } finally {
            setSavingPreferences(false);
        }
    };

    const onManageBilling = async () => {
        setManagingBilling(true);
        try {
            const res = await fetch('/api/user/billing-portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data?.url) {
                throw new Error(data?.error || ts('toast.billingPortalFailed'));
            }

            window.location.assign(data.url as string);
        } catch (error) {
            const message = error instanceof Error ? error.message : ts('toast.billingPortalFailed');
            toast.error(message);
            setManagingBilling(false);
        }
    };

    const onDeleteAccount = async () => {
        setDeletingAccount(true);
        try {
            const res = await fetch('/api/user/account', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || ts('toast.deleteAccountFailed'));
            }

            toast.success(ts('toast.accountDeleted'));
            await signOut({ callbackUrl: '/login' });
        } catch (error) {
            const message = error instanceof Error ? error.message : ts('toast.deleteAccountFailed');
            toast.error(message);
        } finally {
            setDeletingAccount(false);
        }
    };

    return (
        <ErrorBoundary>
            <Toaster position="top-right" richColors closeButton />
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900">{t('settings')}</h1>
                    <p className="text-sm text-slate-500">{ts('subtitle')}</p>
                </div>

                {loadingPage ? (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {ts('loading')}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{ts('profile.title')}</CardTitle>
                                <CardDescription>{ts('profile.desc')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">{ts('profile.name')}</Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder={ts('profile.namePlaceholder')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">{ts('profile.email')}</Label>
                                        <Input id="email" value={email} disabled readOnly />
                                    </div>
                                </div>
                                <Button onClick={onSaveProfile} disabled={savingProfile}>
                                    {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {ts('profile.save')}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{ts('subscription.title')}</CardTitle>
                                <CardDescription>{ts('subscription.desc')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-xs uppercase text-slate-500 font-semibold">{ts('subscription.plan')}</p>
                                        <p className="text-lg font-semibold text-slate-900">{planLabel}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-xs uppercase text-slate-500 font-semibold">{ts('subscription.status')}</p>
                                        <p className="text-lg font-semibold text-slate-900">{statusLabel}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-xs uppercase text-slate-500 font-semibold">{ts('subscription.nextBilling')}</p>
                                        <p className="text-lg font-semibold text-slate-900">
                                            {statusLabel === 'Active' && nextBillingDate
                                                ? new Date(nextBillingDate).toLocaleDateString('en-US')
                                                : '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={onManageBilling} disabled={managingBilling} variant="outline">
                                        {managingBilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {ts('subscription.manageBilling')}
                                    </Button>

                                    {planLabel === 'Free' && (
                                        <Button asChild>
                                            <Link href="/pricing">{ts('subscription.upgrade')}</Link>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{ts('notifications.title')}</CardTitle>
                                <CardDescription>{ts('notifications.desc')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{ts('notifications.priceDrop.title')}</p>
                                        <p className="text-sm text-slate-500">{ts('notifications.priceDrop.desc')}</p>
                                    </div>
                                    <Switch checked={priceDropAlerts} onChange={(e) => setPriceDropAlerts(e.target.checked)} />
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{ts('notifications.disruption.title')}</p>
                                        <p className="text-sm text-slate-500">{ts('notifications.disruption.desc')}</p>
                                    </div>
                                    <Switch checked={disruptionAlerts} onChange={(e) => setDisruptionAlerts(e.target.checked)} />
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{ts('notifications.weeklySummary.title')}</p>
                                        <p className="text-sm text-slate-500">{ts('notifications.weeklySummary.desc')}</p>
                                    </div>
                                    <Switch checked={weeklySummary} onChange={(e) => setWeeklySummary(e.target.checked)} />
                                </div>

                                <Button onClick={onSavePreferences} disabled={savingPreferences}>
                                    {savingPreferences && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {ts('notifications.save')}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-red-200">
                            <CardHeader>
                                <CardTitle className="text-red-700">{ts('account.title')}</CardTitle>
                                <CardDescription>{ts('account.desc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={deletingAccount}>
                                            {deletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {ts('account.delete')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{ts('account.deleteConfirmTitle')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {ts('account.deleteConfirmDesc')}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{ts('account.cancel')}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!deletingAccount) void onDeleteAccount();
                                                }}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                {deletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {ts('account.confirmDelete')}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
}
