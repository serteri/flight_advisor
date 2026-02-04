'use client';
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">

            {/* SOL TARA: Marka & Vaat */}
            <div className="bg-slate-900 text-white p-12 flex flex-col justify-between relative overflow-hidden">
                <div className="z-10">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="bg-emerald-500 p-2 rounded-lg">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Travel Guardian</span>
                    </div>

                    <h1 className="text-5xl font-black mb-6 leading-tight">
                        Seyahatinizi <br />
                        <span className="text-emerald-400">Şansa Bırakmayın.</span>
                    </h1>
                    <p className="text-slate-400 text-lg max-w-md">
                        7/24 arkanızda çalışan yapay zeka ile tazminatlarınızı alın, fiyat düşüşlerini yakalayın ve lüks seyahat edin.
                    </p>
                </div>

                {/* Alt Bilgi */}
                <div className="z-10 text-sm text-slate-500">
                    © 2026 Travel Guardian Inc. • Brisbane, AU
                </div>

                {/* Dekoratif Arkaplan Efekti */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>

            {/* SAĞ TARAF: Giriş Formu */}
            <div className="bg-white p-12 flex items-center justify-center">
                <div className="w-full max-w-md space-y-8">

                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-slate-900">Hesabınıza Giriş Yapın</h2>
                        <p className="text-slate-500 mt-2">Kontrol paneline erişmek için devam edin.</p>
                    </div>

                    <button
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
                    >
                        {/* Google Logo SVG */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google ile Devam Et
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-slate-400">Güvenli Giriş</span>
                        </div>
                    </div>

                    <p className="text-xs text-center text-slate-400">
                        Devam ederek Hizmet Şartları ve Gizlilik Politikasını kabul etmiş olursunuz.
                    </p>
                </div>
            </div>

        </div>
    );
}
