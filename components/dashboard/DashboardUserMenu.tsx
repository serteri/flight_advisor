'use client';

import { LogOut, UserCircle2 } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

export function DashboardUserMenu() {
    const { data: session } = useSession();
    const name = session?.user?.name || 'Account';
    const email = session?.user?.email || '';

    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <UserCircle2 className="h-8 w-8 text-slate-500" />
            <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{name}</p>
                {email && <p className="text-xs text-slate-500 leading-tight">{email}</p>}
            </div>
            <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
                <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
        </div>
    );
}
