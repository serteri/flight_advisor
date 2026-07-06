'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { CheckCircle2, FileText, Loader2, Plane, ShieldCheck, Upload } from 'lucide-react';
import { SignaturePad } from '@/components/claims/SignaturePad';

interface FlightSummary {
    routeLabel: string;
    flightNumber: string | null;
    origin: string | null;
    destination: string | null;
    departureDate: string | null;
}

interface ClaimProcessFormProps {
    tripId: string;
    flightSummary: FlightSummary;
    defaultEmail: string;
}

const STEP_COUNT = 3;

type ClaimFormErrors = {
    fullName?: string;
    email?: string;
    document?: string;
    signatureDataUrl?: string;
    consentGiven?: string;
};

export function ClaimProcessForm({ tripId, flightSummary, defaultEmail }: ClaimProcessFormProps) {
    const t = useTranslations('ClaimProcess');
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState(defaultEmail);
    const [file, setFile] = useState<File | null>(null);
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
    const [consentGiven, setConsentGiven] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [formState, setFormState] = useState<{ errors: ClaimFormErrors }>({ errors: {} });

    const canGoToStep2 = fullName.trim().length > 0 && email.trim().length > 0;
    const canGoToStep3 = file !== null;
    const canSubmit = consentGiven;

    const goBack = () => setStep((s) => Math.max(1, s - 1));

    const stepOneSchema = z.object({
        fullName: z.string().trim().min(2, { message: t('errors.fullNameRequired') }),
        email: z.string().trim().email({ message: t('errors.invalidEmail') }),
    });

    const stepTwoSchema = z.object({
        document: z.custom<File>((value) => value instanceof File && value.size > 0, {
            message: t('errors.documentRequired'),
        }),
    });

    const stepThreeSchema = z
        .object({
            signatureDataUrl: z.string().min(1, { message: t('errors.signatureRequired') }),
            consentGiven: z.boolean(),
        })
        .refine((value) => value.consentGiven, {
            message: t('errors.consentRequired'),
            path: ['consentGiven'],
        });

    const setValidationErrors = (errors: ClaimFormErrors) => {
        setFormState({ errors });
    };

    const validateCurrentStep = (): boolean => {
        if (step === 1) {
            const result = stepOneSchema.safeParse({ fullName, email });
            if (result.success) {
                setValidationErrors({});
                return true;
            }

            const nextErrors: ClaimFormErrors = {};
            for (const issue of result.error.issues) {
                const field = issue.path[0] as keyof ClaimFormErrors;
                if (field && !nextErrors[field]) {
                    nextErrors[field] = issue.message;
                }
            }
            setValidationErrors(nextErrors);
            return false;
        }

        if (step === 2) {
            const result = stepTwoSchema.safeParse({ document: file });
            if (result.success) {
                setValidationErrors({});
                return true;
            }

            setValidationErrors({ document: result.error.issues[0]?.message || t('errors.documentRequired') });
            return false;
        }

        const result = stepThreeSchema.safeParse({
            signatureDataUrl: signatureDataUrl || '',
            consentGiven,
        });

        if (result.success) {
            setValidationErrors({});
            return true;
        }

        const nextErrors: ClaimFormErrors = {};
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof ClaimFormErrors;
            if (field && !nextErrors[field]) {
                nextErrors[field] = issue.message;
            }
        }
        setValidationErrors(nextErrors);
        return false;
    };

    const submitClaim = async () => {
        if (isSubmitting || !canSubmit) return;
        setError(null);
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('tripId', tripId);
            formData.append('fullName', fullName);
            formData.append('email', email);
            formData.append('consentGiven', String(consentGiven));
            if (signatureDataUrl) formData.append('signatureDataUrl', signatureDataUrl);
            if (file) formData.append('document', file);

            const response = await fetch('/api/claims', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(data?.error || t('genericError'));
                setIsSubmitting(false);
                return;
            }

            setSubmitted(true);
        } catch {
            setError(t('genericError'));
            setIsSubmitting(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        const isValid = validateCurrentStep();
        if (!isValid) {
            return;
        }

        if (step < STEP_COUNT) {
            setStep((s) => Math.min(STEP_COUNT, s + 1));
            return;
        }

        await submitClaim();
    };

    if (submitted) {
        return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{t('submittedTitle')}</h2>
                <p className="text-sm text-slate-600">{t('submittedSubtitle')}</p>
                <button
                    type="button"
                    onClick={() => router.push(`/trip/${tripId}`)}
                    className="mt-2 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-800"
                >
                    {t('backToTrip')}
                </button>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleFormSubmit}
            noValidate
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6"
        >
            <div className="flex items-center gap-3">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                s <= step ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            {s}
                        </div>
                        {s < 3 && <div className={`h-0.5 flex-1 ${s < step ? 'bg-emerald-600' : 'bg-slate-100'}`} />}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Plane className="w-5 h-5 text-sky-600" />
                        {t('step1.title')}
                    </h2>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1 text-sm text-slate-700">
                        <div><strong>{t('step1.route')}:</strong> {flightSummary.routeLabel}</div>
                        {flightSummary.flightNumber && (
                            <div><strong>{t('step1.flightNumber')}:</strong> {flightSummary.flightNumber}</div>
                        )}
                        {flightSummary.departureDate && (
                            <div><strong>{t('step1.date')}:</strong> {new Date(flightSummary.departureDate).toLocaleDateString()}</div>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('step1.fullNameLabel')}</label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => {
                                    setFullName(e.target.value);
                                    if (formState.errors.fullName) {
                                        setValidationErrors({ ...formState.errors, fullName: undefined });
                                    }
                                }}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            {formState.errors.fullName && (
                                <p className="text-red-500 text-sm">{formState.errors.fullName}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('step1.emailLabel')}</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (formState.errors.email) {
                                        setValidationErrors({ ...formState.errors, email: undefined });
                                    }
                                }}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            {formState.errors.email && (
                                <p className="text-red-500 text-sm">{formState.errors.email}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-600" />
                        {t('step2.title')}
                    </h2>
                    <p className="text-sm text-slate-600">{t('step2.description')}</p>

                    <label
                        htmlFor="claim-document"
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                    >
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                            {file ? file.name : t('step2.uploadPrompt')}
                        </span>
                        <input
                            id="claim-document"
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                                setFile(e.target.files?.[0] || null);
                                if (formState.errors.document) {
                                    setValidationErrors({ ...formState.errors, document: undefined });
                                }
                            }}
                        />
                    </label>
                    {formState.errors.document && (
                        <p className="text-red-500 text-sm">{formState.errors.document}</p>
                    )}
                </div>
            )}

            {step === 3 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-sky-600" />
                        {t('step3.title')}
                    </h2>
                    <p className="text-sm text-slate-600">{t('step3.description')}</p>

                    <SignaturePad
                        onChange={(value) => {
                            setSignatureDataUrl(value);
                            if (formState.errors.signatureDataUrl) {
                                setValidationErrors({ ...formState.errors, signatureDataUrl: undefined });
                            }
                        }}
                    />
                    {formState.errors.signatureDataUrl && (
                        <p className="text-red-500 text-sm">{formState.errors.signatureDataUrl}</p>
                    )}

                    <label className="flex items-start gap-2.5 text-sm text-slate-600">
                        <input
                            type="checkbox"
                            required
                            checked={consentGiven}
                            onChange={(e) => {
                                setConsentGiven(e.target.checked);
                                if (formState.errors.consentGiven) {
                                    setValidationErrors({ ...formState.errors, consentGiven: undefined });
                                }
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{t('step3.consentText')}</span>
                    </label>
                    {formState.errors.consentGiven && (
                        <p className="text-red-500 text-sm">{formState.errors.consentGiven}</p>
                    )}
                </div>
            )}

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <div className="flex items-center justify-between pt-2">
                <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 1}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-0"
                >
                    {t('back')}
                </button>

                {step < STEP_COUNT ? (
                    <button
                        type="submit"
                        disabled={(step === 1 && !canGoToStep2) || (step === 2 && !canGoToStep3)}
                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
                    >
                        {t('next')}
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!canSubmit || isSubmitting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('submit')}
                    </button>
                )}
            </div>
        </form>
    );
}
