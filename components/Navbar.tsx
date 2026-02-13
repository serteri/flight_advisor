"use client";

import { useTranslations } from 'next-intl';
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Menu, X, Plane, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const t = useTranslations('Navbar');
    const { data: session, status } = useSession();

    const navLinks = [
        { name: t('home'), href: "/" },
        { name: t('search'), href: "/flight-search" },
        { name: t('blog'), href: "/blog" },
        { name: t('features'), href: "/#features" },
    ];

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                        <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                            <Plane size={20} fill="currentColor" />
                        </div>
                        <span>Flight<span className="text-blue-600">Advisor</span></span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-blue-600",
                                    pathname === link.href ? "text-blue-600" : "text-slate-600"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* CTA Buttons & Lang */}
                    <div className="hidden md:flex items-center gap-4">
                        <LanguageSwitcher />
                        {session ? (
                            <>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <User size={16} />
                                    <span>{session.user?.name || session.user?.email}</span>
                                </div>
                                <Link href="/dashboard">
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                                        {t('dashboard')}
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => signOut({ callbackUrl: '/' })}
                                >
                                    <LogOut size={16} className="mr-2" />
                                    {t('logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login">
                                    <Button variant="ghost" size="sm">{t('login')}</Button>
                                </Link>
                                <Link href="/dashboard">
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                                        {t('dashboard')}
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 text-slate-600 hover:text-slate-900 transition"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden border-t bg-white">
                    <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm font-medium text-slate-600 hover:text-blue-600 py-2"
                                onClick={() => setIsOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="py-2 flex justify-center">
                            <LanguageSwitcher />
                        </div>
                        <div className="h-px bg-slate-100 my-2" />
                        {session ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
                                    <User size={16} />
                                    <span>{session.user?.name || session.user?.email}</span>
                                </div>
                                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                        {t('dashboard')}
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={() => {
                                        setIsOpen(false);
                                        signOut({ callbackUrl: '/' });
                                    }}
                                >
                                    <LogOut size={16} /> {t('logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" onClick={() => setIsOpen(false)}>
                                    <Button variant="outline" className="w-full justify-start gap-2">
                                        <User size={16} /> {t('login')}
                                    </Button>
                                </Link>
                                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                        {t('dashboard')}
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}
