"use client";

import { useTranslations } from 'next-intl';
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Menu, X, Plane, User, LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const t = useTranslations('Navbar');
    const tCommon = useTranslations('common');
    const { data: session } = useSession();

    const navLinks = [
        { name: t('home'), href: "/" },
        { name: t('search'), href: "/flight-search" },
        { name: 'Pricing', href: "/pricing" },
        { name: t('blog'), href: "/blog" },
    ];

    return (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
            {/* Floating pill navbar */}
            <nav className="max-w-7xl mx-auto rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-slate-700/40 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.6)]">
                <div className="px-4 md:px-6">
                    <div className="flex items-center justify-between h-14">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
                            <div className="bg-gradient-to-br from-sky-500 to-blue-700 p-1.5 rounded-full text-white shadow-md shadow-blue-500/30">
                                <Plane size={16} fill="currentColor" />
                            </div>
                            <span className="text-slate-900 dark:text-white">
                                Flight<span className="text-sky-600">Agent</span>
                            </span>
                        </Link>

                        {/* Center nav links */}
                        <div className="hidden md:flex items-center gap-6">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "text-sm font-medium transition-all duration-200 hover:text-sky-600",
                                        pathname === link.href
                                            ? "text-sky-600"
                                            : "text-slate-600 dark:text-slate-300"
                                    )}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>

                        {/* Right side */}
                        <div className="hidden md:flex items-center gap-3">
                            {/* AI Mode badge */}
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200/70 text-sky-700 text-[10px] font-bold tracking-wider select-none">
                                <Zap size={10} className="fill-sky-500 text-sky-500" />
                                AI MODE
                            </div>

                            <LanguageSwitcher />

                            {/* Motto signature badge */}
                            <div className="hidden lg:flex items-center gap-2">
                                <div className="w-px h-4 bg-slate-200/60" />
                                <span className="px-3 py-1 rounded-full bg-sky-500/[0.08] border border-sky-300/20 text-[10px] font-medium italic tracking-wider text-sky-600/80 select-none cursor-default transition-all duration-300 hover:bg-sky-500/[0.15] hover:border-sky-300/40 hover:text-sky-600 hover:drop-shadow-[0_0_8px_rgba(14,165,233,0.45)] whitespace-nowrap">
                                    {tCommon('motto')}
                                </span>
                            </div>

                            {session ? (
                                <>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <User size={13} />
                                        <span className="max-w-[100px] truncate">
                                            {session.user?.name || session.user?.email}
                                        </span>
                                    </div>
                                    <Link href="/dashboard">
                                        <Button
                                            size="sm"
                                            className="h-8 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 btn-glow"
                                        >
                                            {t('dashboard')}
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 rounded-full text-xs text-slate-500 hover:text-slate-800"
                                        onClick={() => signOut({ callbackUrl: '/' })}
                                    >
                                        <LogOut size={13} className="mr-1" />
                                        {t('logout')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Link href="/login">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-full text-xs text-slate-600 hover:text-sky-600"
                                        >
                                            {t('login')}
                                        </Button>
                                    </Link>
                                    <Link href="/dashboard">
                                        <Button
                                            size="sm"
                                            className="h-8 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 btn-glow"
                                        >
                                            {t('dashboard')}
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition rounded-full hover:bg-slate-100"
                            onClick={() => setIsOpen(!isOpen)}
                        >
                            {isOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>

                    {/* Motto strip - desktop only, below main row */}
                </div>
            </nav>

            {/* Mobile dropdown - rounded card below the pill */}
            {isOpen && (
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
                                onClick={() => setIsOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}

                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />

                        <div className="flex items-center justify-between px-3">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200/70 text-sky-700 text-[10px] font-bold tracking-wider">
                                <Zap size={10} className="fill-sky-500 text-sky-500" />
                                AI MODE ACTIVE
                            </div>
                            <LanguageSwitcher />
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />

                        {session ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
                                    <User size={15} />
                                    <span className="truncate">{session.user?.name || session.user?.email}</span>
                                </div>
                                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                                    <Button className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-semibold btn-glow">
                                        {t('dashboard')}
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    className="w-full rounded-xl justify-start gap-2 mt-1"
                                    onClick={() => { setIsOpen(false); signOut({ callbackUrl: '/' }); }}
                                >
                                    <LogOut size={15} /> {t('logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" onClick={() => setIsOpen(false)}>
                                    <Button variant="outline" className="w-full rounded-xl justify-start gap-2">
                                        <User size={15} /> {t('login')}
                                    </Button>
                                </Link>
                                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                                    <Button className="w-full rounded-xl mt-1 bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-semibold btn-glow">
                                        {t('dashboard')}
                                    </Button>
                                </Link>
                            </>
                        )}

                        <p className="text-center text-[10px] italic text-slate-400/70 mt-3 pb-1 font-light">
                            {tCommon('motto')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
