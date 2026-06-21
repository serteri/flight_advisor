import { Plane } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function Footer() {
    const t = await getTranslations('Footer');
    const year = new Date().getFullYear();

    const links = [
        { name: t('links.home'), href: '/' },
        { name: t('links.guardian'), href: '/dashboard/guardian' },
        { name: t('links.pricing'), href: '/pricing' },
        { name: t('links.blog'), href: '/blog' },
        { name: t('links.about'), href: '/about' },
    ];

    return (
        <footer className="border-t border-slate-200 bg-white">
            <div className="container mx-auto px-4 md:px-6 py-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
                <div className="flex flex-col items-center md:items-start gap-2">
                    <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
                        <div className="bg-gradient-to-br from-sky-500 to-blue-700 p-1.5 rounded-full text-white shadow-sm shadow-blue-500/30">
                            <Plane size={16} fill="currentColor" />
                        </div>
                        <span>
                            Flight<span className="text-sky-600">Agent</span>
                        </span>
                    </Link>
                    <p className="text-sm text-slate-500 max-w-xs text-center md:text-left">{t('tagline')}</p>
                </div>

                <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="border-t border-slate-100">
                <div className="container mx-auto px-4 md:px-6 py-4 text-center text-xs text-slate-400">
                    {t('copyright', { year })}
                </div>
            </div>
        </footer>
    );
}
