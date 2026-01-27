export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-lg border border-slate-200">
                {children}
            </div>
        </div>
    )
}
