'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface SignaturePadProps {
    onChange: (dataUrl: string | null) => void;
}

export function SignaturePad({ onChange }: SignaturePadProps) {
    const t = useTranslations('ClaimProcess.step3');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    const getContext = () => canvasRef.current?.getContext('2d') || null;

    const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const ctx = getContext();
        if (!ctx) return;
        drawingRef.current = true;
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const ctx = getContext();
        if (!ctx) return;
        const { x, y } = getCoords(e);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        const canvas = canvasRef.current;
        if (canvas) {
            onChange(canvas.toDataURL('image/png'));
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasDrawn(false);
        onChange(null);
    };

    return (
        <div className="space-y-2">
            <canvas
                ref={canvasRef}
                width={480}
                height={160}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="w-full rounded-xl border border-slate-200 bg-white touch-none"
            />
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('signatureHint')}</span>
                {hasDrawn && (
                    <button
                        type="button"
                        onClick={clear}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                        {t('clearSignature')}
                    </button>
                )}
            </div>
        </div>
    );
}
