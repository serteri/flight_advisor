
import { blogPosts } from '@/app/lib/blog-data';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BlogIndex() {
    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* HERO */}
            <div className="bg-blue-900 text-white py-16 px-6 text-center">
                <h1 className="text-4xl font-black mb-4">Travel Guides & Tips</h1>
                <p className="text-blue-200 text-lg max-w-2xl mx-auto">
                    Expert advice on finding the best flight deals, hidden gems, and travel hacks from the FlightAdvisor team.
                </p>
            </div>

            <div className="max-w-6xl mx-auto px-6 -mt-10">
                <Link href="/" className="inline-flex items-center text-white mb-6 hover:text-blue-200 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogPosts.map((post) => (
                        <Link href={`/en/blog/${post.slug}`} key={post.slug} className="group">
                            <article className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden h-full flex flex-col border border-slate-100 group-hover:border-blue-200">
                                {/* IMAGE */}
                                <div className="h-48 overflow-hidden relative">
                                    <img
                                        src={post.coverImage}
                                        alt={post.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-800">
                                        Travel Tips
                                    </div>
                                </div>

                                {/* CONTENT */}
                                <div className="p-6 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                                        <span>{post.date}</span>
                                        <span>•</span>
                                        <span>{post.readTime}</span>
                                    </div>

                                    <h2 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                                        {post.title}
                                    </h2>

                                    <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-1">
                                        {post.excerpt}
                                    </p>

                                    <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-50">
                                        <img src={post.author.avatar} alt={post.author.name} className="w-8 h-8 rounded-full" />
                                        <div className="text-xs">
                                            <p className="font-bold text-slate-700">{post.author.name}</p>
                                            <p className="text-slate-400">{post.author.role}</p>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
