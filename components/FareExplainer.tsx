export function FareExplainer({ restrictions }: { restrictions: any }) {
    if (!restrictions) return null;

    return (
        <div className="mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-sm text-blue-800">
            <div className="font-bold mb-2 font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">i</span>
                Flight Agent Analizi
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`flex items-center gap-2 ${restrictions.baggageIncluded === false ? 'text-red-600' : 'text-emerald-700'}`}>
                    {restrictions.baggageIncluded === false ? (
                        <>
                            <span className="text-lg">🎒</span>
                            <span>Sadece El Bagajı (Ek ücret gerekir)</span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg">✅</span>
                            <span>23kg+ Bagaj Dahil</span>
                        </>
                    )}
                </div>
                <div className={`flex items-center gap-2 ${restrictions.refundable ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {restrictions.refundable ? (
                        <>
                            <span className="text-lg">🛡️</span>
                            <span>İade Edilebilir Bilet</span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg">⚠️</span>
                            <span>Dikkat: İade Yok (Para Yanar)</span>
                        </>
                    )}
                </div>
                <div className={`flex items-center gap-2 ${restrictions.changeable ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {restrictions.changeable ? (
                        <>
                            <span className="text-lg">🔄</span>
                            <span>Tarih Değişimi Esnek</span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg">🔒</span>
                            <span>Tarih Değişimi Ücretli/Kapalı</span>
                        </>
                    )}
                </div>
            </div>
            <p className="mt-3 text-xs opacity-70 border-t border-blue-100 pt-2">
                *Bu analiz havayolu kurallarına göre yapılmıştır. Lütfen satın almadan önce detayları kontrol edin.
            </p>
        </div>
    );
}
