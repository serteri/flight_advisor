
'use client';
import { useState } from 'react';
import { Armchair, CheckCircle, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Props kısmını güncelle
interface SeatAssignmentModalProps {
    tripId?: string; // Optional (logging etc.)
    segmentId: string;
    flightCode: string; // e.g., "SQ236"
    onClose: () => void;
}

export function SeatAssignmentModal({ tripId, segmentId, flightCode, onClose }: SeatAssignmentModalProps) {
    const [seat, setSeat] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        setLoading(true);

        // Veriyi Büyük Harfe Çevir (24a -> 24A)
        const formattedSeat = seat.toUpperCase();

        const res = await fetch('/api/trips/update-seat', {
            method: 'POST',
            body: JSON.stringify({ segmentId, seatNumber: formattedSeat })
        });

        if (res.ok) {
            router.refresh(); // Sayfayı yenile ki yeni veriyi görsün
            onClose();
        } else {
            alert("Hata: Lütfen geçerli bir koltuk girin (Örn: 12F)");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Armchair className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900">Koltuk Seçimi</h3>
                    <p className="text-sm font-bold text-blue-600 mb-1">{flightCode}</p>
                    <p className="text-sm text-slate-500">
                        Yan koltuğunuzun (Empty Seat) boş kalıp kalmadığını takip edebilmemiz için koltuk numaranızı bilmeliyiz.
                    </p>

                    {/* Koltuk Giriş Inputu */}
                    <div className="mt-6 relative max-w-[120px] mx-auto">
                        <input
                            type="text"
                            placeholder="24A"
                            maxLength={4}
                            value={seat}
                            onChange={(e) => setSeat(e.target.value)}
                            className="w-full text-center text-3xl font-black text-slate-800 border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 uppercase placeholder:text-slate-200"
                            autoFocus
                        />
                        <span className="text-xs text-slate-400 font-bold mt-1 block">KOLTUK NO</span>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || seat.length < 2}
                        className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Kaydet ve İzlemeye Başla
                    </button>
                </div>
            </div>
        </div>
    );
}
