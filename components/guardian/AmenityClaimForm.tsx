'use client';
import { useState } from 'react';
import { Wifi, Tv, Utensils, Armchair, Frown, CheckCircle, Send } from 'lucide-react';

export function AmenityClaimForm({ airline, pnr }: { airline: string, pnr: string }) {
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    const [sent, setSent] = useState(false);

    const issues = [
        { id: 'WIFI', label: 'Wi-Fi Bozuktu', icon: <Wifi className="w-6 h-6" />, value: '2.000 Mil' },
        { id: 'IFE', label: 'Ekran/TV Bozuktu', icon: <Tv className="w-6 h-6" />, value: '3.000 Mil' },
        { id: 'FOOD', label: 'Yemek Kötü/Yoktu', icon: <Utensils className="w-6 h-6" />, value: '1.500 Mil' },
        { id: 'SEAT', label: 'Koltuk Kırıktı', icon: <Armchair className="w-6 h-6" />, value: '5.000 Mil' },
        { id: 'CREW', label: 'Kaba Personel', icon: <Frown className="w-6 h-6" />, value: 'Voucher' },
    ];

    const toggleIssue = (id: string) => {
        if (selectedIssues.includes(id)) {
            setSelectedIssues(selectedIssues.filter(i => i !== id));
        } else {
            setSelectedIssues([...selectedIssues, id]);
        }
    };

    const handleSend = async () => {
        // In a real app, send to server: /api/actions/amenity-complaint
        // For demo, just show success state
        setSent(true);
    };

    if (sent) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Şikayet İletildi!</h3>
                <p className="text-slate-600 mt-2">
                    {airline} Müşteri İlişkileri'ne resmi bir "Goodwill Compensation" (İyi Niyet Tazminatı) talebi gönderdik.
                    Genellikle 7 gün içinde mil veya hediye çeki tanımlarlar.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-2xl mx-auto">
            <div className="bg-slate-900 p-6 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Frown className="text-amber-400" /> Hizmet Kusuru Bildirimi
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                    Yolculukta bir şeyler ters mi gitti? İşaretleyin, tazminat isteyelim.
                </p>
            </div>

            <div className="p-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    {issues.map((issue) => (
                        <button
                            key={issue.id}
                            onClick={() => toggleIssue(issue.id)}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${selectedIssues.includes(issue.id)
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-100 hover:border-slate-300 text-slate-600'
                                }`}
                        >
                            {issue.icon}
                            <div className="font-bold text-sm">{issue.label}</div>
                            {selectedIssues.includes(issue.id) && (
                                <div className="text-[10px] bg-white px-2 py-1 rounded-full font-bold text-emerald-600 shadow-sm">
                                    Hedef: {issue.value}
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl mb-6 text-sm text-slate-600 border border-slate-200">
                    <strong>Oluşturulacak Talep Özeti:</strong>
                    <p className="mt-1 italic opacity-80">
                        "Sayın {airline}, {pnr} PNR kodlu uçuşumda yaşadığım
                        {selectedIssues.length > 0 ? selectedIssues.join(', ') : '...'} sorunları nedeniyle mağdur oldum.
                        Müşteri memnuniyeti kapsamında Star Alliance Milleri veya hediye çeki talep ediyorum."
                    </p>
                </div>

                <button
                    onClick={handleSend}
                    disabled={selectedIssues.length === 0}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Send className="w-5 h-5" />
                    Tazminat Talebini Gönder
                </button>
            </div>
        </div>
    );
}
