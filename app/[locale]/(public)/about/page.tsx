import { useTranslations } from 'next-intl';

export default function AboutPage() {
    const t = useTranslations('AboutPage');

    return (
        <div className="min-h-screen pt-32 pb-20 bg-slate-50">
            <div className="container mx-auto px-4 md:px-6 max-w-3xl">
                <h1 className="text-4xl font-bold text-slate-900 mb-6">{t('title')}</h1>
                <p className="text-2xl text-slate-500 mb-12">{t('subtitle')}</p>

                <div className="space-y-12">
                    <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">{t('mission.title')}</h2>
                        <p className="text-lg text-slate-700 leading-relaxed">
                            {t('mission.content')}
                        </p>
                    </section>

                    <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">{t('story.title')}</h2>
                        <p className="text-lg text-slate-700 leading-relaxed">
                            {t('story.content')}
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
