"use client";

import { useTranslations } from 'next-intl';
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { Menu, X, Plane, User, LogOut, Zap, LayoutDashboard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const t = useTranslations('common');
    const tNav = useTranslations('Navbar');
    const { data: session } = useSession();

    // Close user dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent | Event) {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        }
        // Use 'click' instead of 'mousedown' to allow item handlers to complete first
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, []);

    const navLinks = [
        { name: tNav('home'), href: "/" },
        { name: tNav('search'), href: "/flight-search" },
        { name: tNav('pricing'), href: "/pricing" },
        { name: tNav('blog'), href: "/blog" },
    ];

    const displayName = session?.user?.name || session?.user?.email || '';

    return (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
            {/* Floating pill navbar */}
            <nav className="max-w-7xl mx-auto rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-slate-700/40 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.6)]">
                <div className="px-5 md:px-7">
                    <div className="flex items-center justify-between h-14">

                        {/* ── LEFT: Brand ─────────────────────────────── */}
                        <div className="flex items-center shrink-0 mr-8">
                            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                                <div className="bg-gradient-to-br from-sky-500 to-blue-700 p-1.5 rounded-full text-white shadow-md shadow-blue-500/30">
                                    <Plane size={16} fill="currentColor" />
                                </div>
                                <span className="text-slate-900 dark:text-white">
                                    Flight<span className="text-sky-600">Agent</span>
                                </span>
                            </Link>
                        </div>

                        {/* ── MIDDLE: Nav links ────────────────────────── */}
                        <div className="hidden md:flex flex-1 items-center gap-x-6">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "text-sm font-medium whitespace-nowrap transition-colors duration-200 hover:text-sky-600",
                                        pathname === link.href
                                            ? "text-sky-600"
                                            : "text-slate-600 dark:text-slate-300"
                                    )}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>

                        {/* ── RIGHT: Actions ───────────────────────────── */}
                        <div className="hidden md:flex items-center gap-x-3 shrink-0">

                            {/* AI Mode pill */}
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200/70 text-sky-700 text-[10px] font-bold tracking-wider select-none whitespace-nowrap">
                                <Zap size={10} className="fill-sky-500 text-sky-500" />
                                {tNav('aiMode')}
                            </div>

                            <LanguageSwitcher />

                            {/* Motto — only when logged out and on wide screens */}
                            {!session && (
                                <span className="hidden lg:block px-3 py-1 rounded-full bg-sky-500/[0.08] border border-sky-300/20 text-[10px] font-medium italic tracking-wider text-sky-600/80 select-none whitespace-nowrap">
                                    {t('motto')}
                                </span>
                            )}

                            {session ? (
                                /* ── Logged-in: compact user dropdown ──── */
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setUserMenuOpen((v) => !v)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-xs text-slate-600 font-medium"
                                    >
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                                            <User size={12} />
                                        </span>
                                        <span className="hidden lg:block max-w-[90px] truncate">
                                            {displayName}
                                        </span>
                                        <ChevronDown size={12} className={cn("transition-transform duration-200", userMenuOpen && "rotate-180")} />
                                    </button>

                                    {/* Dropdown */}
                                    {userMenuOpen && (
                                        <div className="absolute right-0 top-[calc(100%+8px)] w-48 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150" onClick={(e) => e.stopPropagation()}>
                                            <div className="px-3 py-2 border-b border-slate-100 mb-1">
                                                <p className="text-[11px] text-slate-400 font-medium truncate">{displayName}</p>
                                            </div>
                                            <Link
                                                href="/dashboard"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setUserMenuOpen(false);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors rounded-lg mx-1"
                                            >
                                                <LayoutDashboard size={14} />
                                                {tNav('dashboard')}
                                            </Link>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setUserMenuOpen(false);
                                                    signOut({ callbackUrl: '/' });
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors rounded-lg mx-1"
                                            >
                                                <LogOut size={14} />
                                                {tNav('logout')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Logged-out: login + dashboard CTA ── */
                                <>
                                    <Link href="/login">
                                        <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs text-slate-600 hover:text-sky-600">
                                            {tNav('login')}
                                        </Button>
                                    </Link>
                                    <Link href="/dashboard">
                                        <Button size="sm" className="h-8 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/30 btn-glow transition-all duration-200">
                                            {tNav('dashboard')}
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition rounded-full hover:bg-slate-100"
                            onClick={() => setMobileOpen((v) => !v)}
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── Mobile dropdown ──────────────────────────────────── */}
            {mobileOpen && (
                <div className="md:hidden mt-2 max-w-7xl mx-auto rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-700/40 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-5 py-4 flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium py-2.5 px-3 rounded-xl transition-colors",
                                    pathname === link.href
                                        ? "bg-sky-50 text-sky-600"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-sky-600"
                                )}
                                onClick={() => setMobileOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}

                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />

                        <div className="flex items-center justify-between px-3">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200/70 text-sky-700 text-[10px] font-bold tracking-wider">
                                <Zap size={10} className="fill-sky-500 text-sky-500" />
                                {tNav('aiModeActive')}
                            </div>
                            <LanguageSwitcher />
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />

                        {session ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 shrink-0">
                                        <User size={14} />
                                    </span>
                                    <span className="truncate text-xs">{displayName}</span>
                                </div>
                                <Link href="/dashboard" onClick={(e) => { e.stopPropagation(); setMobileOpen(false); }}>
                                    <Button className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-semibold btn-glow">
                                        {tNav('dashboard')}
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    className="w-full rounded-xl justify-start gap-2 mt-1"
                                    onClick={(e) => { e.stopPropagation(); setMobileOpen(false); signOut({ callbackUrl: '/' }); }}
                                >
                                    <LogOut size={15} /> {tNav('logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" onClick={() => setMobileOpen(false)}>
                                    <Button variant="outline" className="w-full rounded-xl justify-start gap-2">
                                        <User size={15} /> {tNav('login')}
                                    </Button>
                                </Link>
                                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                                    <Button className="w-full rounded-xl mt-1 bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-semibold btn-glow">
                                        {tNav('dashboard')}
                                    </Button>
                                </Link>
                            </>
                        )}

                        <p className="text-center text-[10px] italic text-slate-400/70 mt-3 pb-1 font-light">
                            {t('motto')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
