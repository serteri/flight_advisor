"use client";

import { useTranslations } from 'next-intl';
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { Menu, X, Plane, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();
    const tNav = useTranslations('Navbar');
    const { data: session } = useSession();

    const navLinks = [
        { name: tNav('home'), href: "/" },
        { name: "Guardian", href: "/dashboard/guardian" },
        { name: tNav('pricing'), href: "/pricing" },
    ];

    return (
        <div className="fixed top-0 left-0 right-0 z-[120] px-3 sm:px-6 pt-3">
            <nav className="max-w-7xl mx-auto rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm">
                <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center shrink-0">
                        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
                            <div className="bg-gradient-to-br from-sky-500 to-blue-700 p-1.5 rounded-full text-white shadow-sm shadow-blue-500/30">
                                <Plane size={16} fill="currentColor" />
                            </div>
                            <span>
                                Flight<span className="text-sky-600">Agent</span>
                            </span>
                        </Link>
                    </div>

                    <div className="hidden lg:flex flex-1 justify-center items-center gap-8 px-10">
                        {navLinks.map((link) => {
                            const isActive = link.href === "/"
                                ? pathname === "/"
                                : pathname === link.href || pathname.startsWith(`${link.href}/`);

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "text-sm font-medium whitespace-nowrap transition-colors duration-200",
                                        isActive
                                            ? "text-sky-600"
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    {link.name}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="hidden md:flex items-center gap-3 shrink-0">
                        <LanguageSwitcher />

                        {!session ? (
                            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                                {tNav('login')}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await signOut({ callbackUrl: '/', redirect: true });
                                    } catch (error) {
                                        console.error('[LOGOUT ERROR]', error);
                                        window.location.href = '/';
                                    }
                                }}
                                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                <LogOut size={14} />
                                {tNav('logout')}
                            </button>
                        )}

                        <Link href="/dashboard">
                            <Button className="h-10 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-semibold px-4 py-2 shadow-sm shadow-blue-500/30">
                                {tNav('dashboard')}
                            </Button>
                        </Link>
                    </div>

                    <div className="md:hidden">
                        <button
                            type="button"
                            className="p-2 text-slate-600 hover:text-slate-900 transition rounded-lg hover:bg-slate-100"
                            onClick={() => setMobileOpen((v) => !v)}
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </nav>

            {mobileOpen && (
                <div className="md:hidden mt-2 max-w-7xl mx-auto rounded-2xl bg-white/95 border border-slate-200/80 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-4 flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium py-2.5 px-3 rounded-lg transition-colors",
                                    (link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`))
                                        ? "bg-sky-50 text-sky-600"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-sky-600"
                                )}
                                onClick={() => setMobileOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}

                        <div className="h-px bg-slate-100 my-2" />

                        <div className="flex items-center justify-between px-1">
                            <LanguageSwitcher />
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        {session ? (
                            <>
                                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                                    <Button className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-semibold px-4 py-2">
                                        {tNav('dashboard')}
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    className="w-full rounded-xl justify-start gap-2 mt-1"
                                    onClick={async () => {
                                        setMobileOpen(false);
                                        try {
                                            await signOut({ callbackUrl: '/', redirect: true });
                                        } catch (error) {
                                            console.error('[LOGOUT ERROR]', error);
                                            window.location.href = '/';
                                        }
                                    }}
                                >
                                    <LogOut size={15} /> {tNav('logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" onClick={() => setMobileOpen(false)}>
                                    <Button variant="ghost" className="w-full rounded-xl justify-start font-medium text-slate-700 hover:bg-slate-100">
                                        {tNav('login')}
                                    </Button>
                                </Link>
                                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                                    <Button className="w-full rounded-xl mt-1 bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-semibold px-4 py-2">
                                        {tNav('dashboard')}
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
