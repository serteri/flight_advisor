import Navbar from '@/components/Navbar';

export default function BlogLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="pt-24">
                {children}
            </main>
        </div>
    );
}
