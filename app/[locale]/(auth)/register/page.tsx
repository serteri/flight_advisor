"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerUser } from "@/app/actions/register";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function RegisterPage() {
    const t = useTranslations("Auth");
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(event.currentTarget);
        const result = await registerUser(formData);

        if (result.success) {
            router.push("/login"); // Redirect to login after success
        } else {
            setError(result.error || "Registration failed");
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -z-10"></div>

            <div className="w-full max-w-md space-y-8 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 ring-1 ring-slate-900/5">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t("registerTitle")}</h2>
                    <p className="text-slate-500">
                        {t("registerSubtitle")}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">{t("name")}</label>
                            <Input name="name" required className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">{t("surname")}</label>
                            <Input name="surname" required className="mt-1" />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700">{t("email")}</label>
                        <Input name="email" type="email" required className="mt-1" />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700">{t("password")}</label>
                        <Input name="password" type="password" required minLength={6} className="mt-1" />
                    </div>

                    <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 text-md rounded-lg transition-all hover:scale-[1.02]" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : t("register")}
                    </Button>
                </form>

                <div className="text-center text-sm">
                    <span className="text-slate-500">{t("alreadyHaveAccount")} </span>
                    <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                        {t("signIn")}
                    </Link>
                </div>

                <div className="text-center">
                    <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                        ← {t("backToHome")}
                    </Link>
                </div>
            </div>
        </div>
    );
}
