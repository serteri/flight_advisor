import { useTranslations } from 'next-intl';

export default function SettingsPage() {
    const t = useTranslations('Dashboard');

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">{t('settings')}</h1>
            <p>Settings page content goes here.</p>
        </div>
    );
}
