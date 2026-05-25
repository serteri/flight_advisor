import { useState } from 'react';

import type { FreemiumFeature } from '@/lib/freemium/limits';

type PromptData = {
  current: number;
  limit: number;
};

export function useFreemiumGate(feature: FreemiumFeature) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptData, setPromptData] = useState<PromptData | null>(null);

  const check = async (): Promise<boolean> => {
    const response = await fetch(`/api/freemium/check?feature=${encodeURIComponent(feature)}`);

    if (response.status === 402) {
      const data = (await response.json()) as {
        current?: number;
        limit?: number;
      };

      setPromptData({
        current: data.current ?? 0,
        limit: data.limit ?? 0,
      });
      setShowPrompt(true);
      return false;
    }

    if (!response.ok) {
      return false;
    }

    return true;
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  return {
    check,
    showPrompt,
    promptData,
    dismissPrompt,
  };
}
