import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { use } from "react";

type LoginPageProps = {
    params: Promise<{ locale: string }>;
    searchParams?: { callbackUrl?: string };
};

function resolveCallbackUrl(raw: string | undefined, locale: string) {
    const defaultDashboard = `/${locale}/dashboard`;

    if (!raw) return defaultDashboard;
    if (!raw.startsWith("/")) return defaultDashboard;

    if (/^\/[a-z]{2}(?:\/|$)/i.test(raw)) {
        return raw;
    }

    if (raw === "/dashboard" || raw.startsWith("/dashboard?")) {
        return `/${locale}${raw}`;
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
                                await signIn("github", { redirectTo: callbackUrl })
                            }}
                        >
                            <Button type="submit" variant="outline" className="w-full gap-2">
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                {t("signInWithGithub")}
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
