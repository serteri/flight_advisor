// components/dashboard/ScenarioCard.tsx
import { FlightStory } from '@/lib/flightInsights';

interface ScenarioCardProps {
    story: FlightStory;
}

export default function ScenarioCard({ story }: ScenarioCardProps) {
    return (
        <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-slate-900 text-white p-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    🎥 Yolculuk Senaryosu
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                    Senin için bu uçuşun nasıl geçeceğini simüle ettik.
                </p>
            </div>

            <div className="divide-y divide-slate-100">
                {story.chapters.map((chapter, index) => (
                    <div key={index} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                                {chapter.emoji}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                        {chapter.timeOfDay}
                                    </span>
                                    <h4 className="font-bold text-slate-900">{chapter.title}</h4>
                                </div>
                                <p className="text-slate-600 leading-relaxed">
                                    {chapter.description}
                                </p>
                                {chapter.tip && (
                                    <div className="mt-3 flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-xl">
                                        <span className="shrink-0">💡</span>
                                        <span>{chapter.tip}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 p-4 text-center border-t">
                <p className="text-sm font-medium text-slate-800">
                    Sonuç: <span className="text-blue-600">{story.summary}</span>
                </p>
            </div>
        </div>
    );
}
