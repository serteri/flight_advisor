import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const t = useTranslations('Dashboard');
    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar Placeholder */}
            <aside className="w-64 bg-white border-r hidden md:block p-6">
                <div className="font-bold text-xl mb-8">FlightAdvisor</div>
                <nav className="space-y-2">
                    <Link href="/dashboard" className="block px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">{t('routes')}</Link>
                    <Link href="/dashboard/settings" className="block px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">{t('settings')}</Link>
                    <Link href="/" className="block px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg mt-4 border-t pt-4">{t('home')}</Link>
                </nav>
            </aside>

            <div className="flex-1 flex flex-col">
                <header className="h-16 bg-white border-b flex items-center px-6 justify-between">
                    <h1 className="font-semibold text-lg">Dashboard</h1>
                    <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                </header>
                <main className="flex-1 p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
