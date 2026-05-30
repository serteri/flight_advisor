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
                toast.error('Failed to load settings. Please refresh and try again.');
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
            toast.error('Name cannot be empty.');
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
                throw new Error(data?.error || 'Failed to save profile');
            }

            toast.success('Profile updated successfully.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save profile';
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
                throw new Error(data?.error || 'Failed to save notification preferences');
            }

            toast.success('Notification preferences saved.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save notification preferences';
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
                throw new Error(data?.error || 'Unable to open billing portal');
            }

            window.location.assign(data.url as string);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to open billing portal';
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
                throw new Error(data?.error || 'Failed to delete account');
            }

            toast.success('Account deleted successfully.');
            await signOut({ callbackUrl: '/login' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete account';
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
                    <p className="text-sm text-slate-500">Manage your account, subscription, and alerts.</p>
                </div>

                {loadingPage ? (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading settings...
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile</CardTitle>
                                <CardDescription>Update your display name and review your account email.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" value={email} disabled readOnly />
                                    </div>
                                </div>
                                <Button onClick={onSaveProfile} disabled={savingProfile}>
                                    {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save profile
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Subscription</CardTitle>
                                <CardDescription>Review your current plan and billing status.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-xs uppercase text-slate-500 font-semibold">Plan</p>
                                        <p className="text-lg font-semibold text-slate-900">{planLabel}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-xs uppercase text-slate-500 font-semibold">Status</p>
                                        <p className="text-lg font-semibold text-slate-900">{statusLabel}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-xs uppercase text-slate-500 font-semibold">Next billing</p>
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
                                        Manage billing
                                    </Button>

                                    {planLabel === 'Free' && (
                                        <Button asChild>
                                            <Link href="/pricing">Upgrade</Link>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Notifications</CardTitle>
                                <CardDescription>Control which email alerts you receive.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">Email alerts for price drops</p>
                                        <p className="text-sm text-slate-500">Get notified when tracked routes get cheaper.</p>
                                    </div>
                                    <Switch checked={priceDropAlerts} onChange={(e) => setPriceDropAlerts(e.target.checked)} />
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">Email alerts for flight disruptions</p>
                                        <p className="text-sm text-slate-500">Receive updates about delays and major changes.</p>
                                    </div>
                                    <Switch checked={disruptionAlerts} onChange={(e) => setDisruptionAlerts(e.target.checked)} />
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">Weekly price summary email</p>
                                        <p className="text-sm text-slate-500">A weekly digest of your tracked routes.</p>
                                    </div>
                                    <Switch checked={weeklySummary} onChange={(e) => setWeeklySummary(e.target.checked)} />
                                </div>

                                <Button onClick={onSavePreferences} disabled={savingPreferences}>
                                    {savingPreferences && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save preferences
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-red-200">
                            <CardHeader>
                                <CardTitle className="text-red-700">Account</CardTitle>
                                <CardDescription>Delete your account and all associated data.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={deletingAccount}>
                                            {deletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Delete account
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete account?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action is permanent. Your account, subscription access, and related data will be removed.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!deletingAccount) void onDeleteAccount();
                                                }}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                {deletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Yes, delete account
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
