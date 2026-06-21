
import type { Metadata } from 'next';
import { getBlogPostBySlug, type BlogLocale } from '@/app/lib/blog-data';
import { Link } from '@/i18n/routing';
import { ChevronRight, Clock, Calendar, Share2, Facebook, Twitter, Linkedin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

function normalizeLocale(locale: string): BlogLocale {
    return locale === 'tr' || locale === 'de' ? locale : 'en';
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
    const { slug, locale } = await params;
    const currentLocale = normalizeLocale(locale);
    const post = getBlogPostBySlug(currentLocale, slug);

    if (!post) {
        return {};
    }

    return {
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.excerpt,
        alternates: {
            canonical: `/${currentLocale}/blog/${slug}`,
            languages: {
                en: `/en/blog/${slug}`,
                tr: `/tr/blog/${slug}`,
                de: `/de/blog/${slug}`,
                'x-default': `/en/blog/${slug}`,
            },
        },
        keywords: post.keywordFocus,
        openGraph: {
            title: post.seoTitle || post.title,
            description: post.seoDescription || post.excerpt,
            type: 'article',
            locale: currentLocale,
            images: post.coverImage ? [post.coverImage] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: post.seoTitle || post.title,
            description: post.seoDescription || post.excerpt,
            images: post.coverImage ? [post.coverImage] : undefined,
        },
    };
}

export default async function BlogPost({
    params,
}: {
    params: Promise<{ slug: string; locale: string }>;
}) {
    const { slug, locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('BlogPage');
    const currentLocale = normalizeLocale(locale);
    const post = getBlogPostBySlug(currentLocale, slug);

    if (!post) {
        return notFound();
    }

    const faqSchema = post.faq?.length
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: currentLocale,
            mainEntity: post.faq.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                },
            })),
        }
        : null;

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.seoDescription || post.excerpt,
        image: post.coverImage,
        inLanguage: currentLocale,
        datePublished: post.date,
        author: {
            '@type': 'Person',
            name: post.author.name,
        },
        publisher: {
            '@type': 'Organization',
            name: 'FlightAgent.io',
        },
    };

    return (
        <div className="min-h-screen bg-white pb-20">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
            {faqSchema && (
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
            )}
            {/* HEADER IMAGE */}
            <div className="h-[400px] w-full relative">
                <div className="absolute inset-0 bg-black/40 z-10"></div>
                <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />

                <div className="absolute bottom-0 left-0 w-full z-20 bg-gradient-to-t from-black/80 to-transparent pt-32 pb-10 px-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-6 flex items-center gap-2 text-xs text-white/80">
                            <Link href="/" locale={locale} className="hover:text-white transition-colors">Home</Link>
                            <ChevronRight className="w-3 h-3" />
                            <Link href="/blog" locale={locale} className="hover:text-white transition-colors">Blog</Link>
                            <ChevronRight className="w-3 h-3" />
                            <span className="text-white truncate max-w-[280px] sm:max-w-[420px]">{post.title}</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                            {post.title}
                        </h1>

                        <div className="flex items-center gap-6 text-white/90">
                            <div className="flex items-center gap-3">
                                <img src={post.author.avatar} alt={post.author.name} className="w-10 h-10 rounded-full border-2 border-white/30" />
                                <div>
                                    <p className="font-bold text-sm">{post.author.name}</p>
                                    <p className="text-xs opacity-70">{post.author.role}</p>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-white/20"></div>
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4" />
                                <span>{post.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4" />
                                <span>{post.readTime}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 mt-12 grid grid-cols-12 gap-12">
                {/* SIDEBAR (Share) */}
                <div className="hidden md:block col-span-1">
                    <div className="sticky top-32 flex flex-col gap-4">
                        <button className="p-3 rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                            <Share2 className="w-5 h-5" />
                        </button>
                        <div className="w-full h-px bg-slate-100 my-2"></div>
                        <button className="p-3 rounded-full bg-slate-50 text-slate-400 hover:text-[#1877F2] hover:bg-blue-50 transition-colors">
                            <Facebook className="w-5 h-5" />
                        </button>
                        <button className="p-3 rounded-full bg-slate-50 text-slate-400 hover:text-[#1DA1F2] hover:bg-blue-50 transition-colors">
                            <Twitter className="w-5 h-5" />
                        </button>
                        <button className="p-3 rounded-full bg-slate-50 text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 transition-colors">
                            <Linkedin className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="col-span-12 md:col-span-11">
                    <article className="prose prose-lg prose-slate prose-headings:font-black prose-p:text-slate-600 prose-a:text-blue-600 hover:prose-a:text-blue-700 max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: post.content }} />
                    </article>

                    {/* CTA */}
                    <div className="mt-16 bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('ctaTitle')}</h3>
                        <p className="text-slate-600 mb-6">{t('ctaDesc')}</p>
                        <Link href="/" locale={locale} className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                            {t('ctaButton')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
