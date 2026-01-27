"use client";

import { useState, useEffect } from "react";

interface AirlineLogoProps {
    carrierCode: string; // IATA Code e.g. "TK"
    airlineName?: string; // Optional name for alt text
    className?: string;
}

export function AirlineLogo({ carrierCode, airlineName, className = "w-10 h-10 object-contain" }: AirlineLogoProps) {
    // Mapping for common names or mis-formatted codes found in DB
    const codeMap: Record<string, string> = {
        "TURKISH AIRLINES": "TK",
        "THY": "TK",
        "TURK HAVA YOLLARI": "TK",
        "PEGASUS": "PC",
        "PEGASUS AIRLINES": "PC",
        "AJET": "VF",
        "ANADOLUJET": "VF",
        "SUNEXPRESS": "XQ",
        "LUFTHANSA": "LH",
        "EMIRATES": "EK",
        "QANTAS": "QF",
        "JETSTAR": "JQ",
        "BRITISH AIRWAYS": "BA",
        "AMERICAN AIRLINES": "AA",
        "UNITED AIRLINES": "UA",
        "DELTA": "DL",
        "AIR FRANCE": "AF",
        "KLM": "KL",
        "SINGAPORE AIRLINES": "SQ",
        "QATAR AIRWAYS": "QR"
    };

    // Normalize: Uppercase and check map
    const code = codeMap[carrierCode.toUpperCase()] || carrierCode;

    // 1. Try fetching from generic reliable source (avs.io) using IATA
    const initialSrc = `https://pics.avs.io/200/200/${code}.png`;
    const [src, setSrc] = useState(initialSrc);

    // Reset source if carrierCode changes (important for list rendering)
    useEffect(() => {
        const newCode = codeMap[carrierCode.toUpperCase()] || carrierCode;
        setSrc(`https://pics.avs.io/200/200/${newCode}.png`);
    }, [carrierCode]);

    return (
        <img
            src={src}
            alt={airlineName || carrierCode}
            className={className}
            onError={(e) => {
                // Prevent infinite loop if default also fails
                if (src !== '/airlines/default.png') {
                    setSrc('/airlines/default.png');
                }
            }}
        />
    );
}
