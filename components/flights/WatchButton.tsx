"use client";

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface WatchButtonProps {
    flightId: string;
    isWatched?: boolean;
    onWatch?: (flightId: string) => void;
}

export default function WatchButton({ flightId, isWatched = false, onWatch }: WatchButtonProps) {
    const [watching, setWatching] = useState(isWatched);
    const [loading, setLoading] = useState(false);

    const handleWatch = async () => {
        setLoading(true);

        try {
            // Call API to add/remove from watchlist
            const response = await fetch('/api/guardian/monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flightId,
                    action: watching ? 'remove' : 'add'
                })
            });

            if (response.ok) {
                setWatching(!watching);
                if (onWatch) onWatch(flightId);
                console.log(`${flightId} ${watching ? 'takipten çıkarıldı' : 'takibe alındı'}. Guardian nöbette!`);
            }
        } catch (error) {
            console.error('Watch button error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleWatch}
            disabled={loading}
            className={`p-2 rounded-full transition-all ${watching
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-blue-600'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={watching ? "Takipten Çıkar" : "Guardian'a Ekle"}
        >
            {watching ? (
                <Eye className="w-5 h-5" />
            ) : (
                <EyeOff className="w-5 h-5" />
            )}
        </button>
    );
}
