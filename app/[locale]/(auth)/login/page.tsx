import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Link, routing } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { use } from "react";

type LoginPageProps = {
    params: Promise<{ locale: string }>;
    searchParams?: { callbackUrl?: string };
};

function withLocalePrefix(path: string, locale: string) {
    return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

function resolveCallbackUrl(raw: string | undefined, locale: string) {
    const defaultDashboard = withLocalePrefix("/dashboard", locale);

    if (!raw) return defaultDashboard;
    if (!raw.startsWith("/")) return defaultDashboard;

    if (/^\/[a-z]{2}(?:\/|$)/i.test(raw)) {
        return raw;
    }

    if (raw === "/dashboard" || raw.startsWith("/dashboard?")) {
        return withLocalePrefix(raw, locale);
    }

    return raw;
}

export default function LoginPage(props: LoginPageProps) {
    const params = use(props.params);
    const t = useTranslations("Auth");
    const callbackUrl = resolveCallbackUrl(props.searchParams?.callbackUrl, params.locale);

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -z-10"></div>

            <div className="w-full max-w-md space-y-8 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 ring-1 ring-slate-900/5">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("title")}</h1>
                    <p className="text-slate-500">
                        {t("subtitle")}
                    </p>
                </div>

                <div className="space-y-4">
                    <form
                        action={async (formData) => {
                            "use server"
                            const email = formData.get("email");
                            const password = formData.get("password");
                            await signIn("credentials", {
                                email: typeof email === "string" ? email : "",
                                password: typeof password === "string" ? password : "",
                                redirectTo: callbackUrl,
                            });
                        }}
                        className="space-y-4 border-b pb-6 border-slate-200"
                    >
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">{t("email")}</label>
                            <input name="email" type="email" required className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">{t("password")}</label>
                            <input name="password" type="password" required className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm" />
                        </div>
                        <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 text-md rounded-lg transition-all hover:scale-[1.02]">
                            {t("signIn")}
                        </Button>
                    </form>

                    <div className="space-y-3">
                        <form
                            action={async () => {
                                "use server"
                                await signIn("google", { redirectTo: callbackUrl })
                            }}
                        >
                            <Button type="submit" variant="outline" className="w-full relative gap-2">
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" /></svg>
                                {t("signInWithGoogle")}
                            </Button>
                        </form>

                        <form
                            action={async () => {
                                "use server"
                                await signIn("microsoft-entra-id", { redirectTo: callbackUrl })
                            }}
                        >
                            <Button type="submit" variant="outline" className="w-full gap-2">
                                <svg viewBox="0 0 23 23" className="h-5 w-5" fill="currentColor"><path d="M0 0h11.31v11.31H0V0zm11.31 11.31v11.31H0V11.31h11.31zm11.31-11.31v11.31h-11.31V0h11.31zm0 22.62H11.31v-11.31h11.31v11.31z" /></svg>
                                {t("signInWithMicrosoft")}
                            </Button>
                        </form>
                    </div>
                </div>

                <div className="text-center text-sm">
                    <span className="text-slate-500">{t("dontHaveAccount")} </span>
                    <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500">
                        {t("register")}
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
