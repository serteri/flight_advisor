import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';

import {
  FEATURE_DISPLAY_NAMES,
  type FreemiumFeature,
} from '@/lib/freemium/limits';

type UpgradePromptProps = {
  feature: FreemiumFeature;
  current?: number;
  limit?: number;
  onDismiss?: () => void;
};

export default function UpgradePrompt({
  feature,
  current,
  limit,
  onDismiss,
}: UpgradePromptProps) {
  const featureName = FEATURE_DISPLAY_NAMES[feature] ?? feature;
  const isBooleanFeature = typeof limit === 'number' && limit <= 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            {isBooleanFeature ? <Lock className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">You&apos;ve reached your free limit</h2>
            <p className="text-xs text-slate-500">Free tier usage cap reached</p>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-700">
          {isBooleanFeature
            ? `${featureName} is available on Pro plan.`
            : `You have used ${current ?? 0} of ${limit ?? 0} ${featureName} this month.`}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Maybe later
          </button>
          <Link
            href="/pricing"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
