/**
 * 💭 MESSAGE VARIANTS - Confidence-driven messaging system
 * 
 * Generates messaging with varying urgency and confidence language
 * based on decisionConfidence score (0-100).
 */

export interface MessageVariant {
  shortMessage: string; // For cards/badges
  fullMessage: string; // For detailed view
  ctaLabel: string; // Call-to-action text
  urgencyLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  tone: 'URGENT' | 'POSITIVE' | 'CAUTIOUS' | 'NEUTRAL';
}

class MessageVariants {
  /**
   * Get message variants for BUY_NOW decision
   */
  static getBuyNowMessaging(confidence: number): MessageVariant {
    if (confidence >= 75) {
      return {
        shortMessage: '🔴 Book Now - Prices are rising',
        fullMessage: 'Strong signal: This price is very attractive right now and prices tend to increase from here. Booking soon would likely save you money.',
        ctaLabel: 'Book Now',
        urgencyLevel: 'HIGH',
        confidence: 'HIGH',
        tone: 'URGENT',
      };
    } else if (confidence >= 50) {
      return {
        shortMessage: '🟡 Consider Booking Soon',
        fullMessage: 'Moderate signal: This price looks good compared to typical prices. Waiting could cost you more.',
        ctaLabel: 'Book',
        urgencyLevel: 'MEDIUM',
        confidence: 'MEDIUM',
        tone: 'POSITIVE',
      };
    } else {
      return {
        shortMessage: 'Decent Price',
        fullMessage:
          'Weak signal: This price is lower than average, but the signal is not strong. Consider if you are comfortable with the price.',
        ctaLabel: 'Book',
        urgencyLevel: 'LOW',
        confidence: 'LOW',
        tone: 'NEUTRAL',
      };
    }
  }

  static getWaitMessaging(confidence: number): MessageVariant {
    if (confidence >= 75) {
      return {
        shortMessage: 'Likely to Drop - Track It',
        fullMessage:
          'Strong signal: Based on pricing trends, you could save significantly by waiting. We will monitor and alert you.',
        ctaLabel: 'Track This Flight',
        urgencyLevel: 'MEDIUM',
        confidence: 'HIGH',
        tone: 'POSITIVE',
      };
    }

    if (confidence >= 50) {
      return {
        shortMessage: 'May Drop - Worth Tracking',
        fullMessage:
          'Moderate signal: Prices sometimes decrease, so waiting could pay off. Set a price alert to stay informed.',
        ctaLabel: 'Track Price',
        urgencyLevel: 'MEDIUM',
        confidence: 'MEDIUM',
        tone: 'CAUTIOUS',
      };
    }

    return {
      shortMessage: 'Could Go Either Way',
      fullMessage: 'Weak signal: Prices are uncertain. You might want to wait, but there is no strong case either way.',
      ctaLabel: 'Track',
      urgencyLevel: 'LOW',
      confidence: 'LOW',
      tone: 'NEUTRAL',
    };
  }

  static getAvoidMessaging(confidence: number): MessageVariant {
    if (confidence >= 75) {
      return {
        shortMessage: 'Overpriced - Better Options Exist',
        fullMessage:
          'Strong signal: This price is significantly higher than typical. You will likely find better options above.',
        ctaLabel: 'See Better Options',
        urgencyLevel: 'HIGH',
        confidence: 'HIGH',
        tone: 'URGENT',
      };
    }

    if (confidence >= 50) {
      return {
        shortMessage: 'High Price - Consider Alternatives',
        fullMessage: 'Moderate signal: This is priced above average. There are likely better deals available.',
        ctaLabel: 'Browse Others',
        urgencyLevel: 'MEDIUM',
        confidence: 'MEDIUM',
        tone: 'CAUTIOUS',
      };
    }

    return {
      shortMessage: 'Pricey - Check Others',
      fullMessage:
        'Weak signal: This is a bit pricier than usual, but may still be reasonable depending on your preferences.',
      ctaLabel: 'See More Options',
      urgencyLevel: 'LOW',
      confidence: 'LOW',
      tone: 'NEUTRAL',
    };
  }

  static getMessaging(
    decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID',
    confidence: number
  ): MessageVariant {
    if (decisionType === 'BUY_NOW') return this.getBuyNowMessaging(confidence);
    if (decisionType === 'WAIT') return this.getWaitMessaging(confidence);
    if (decisionType === 'AVOID') return this.getAvoidMessaging(confidence);

    return {
      shortMessage: 'No Strong Signal',
      fullMessage: 'The data does not give a clear recommendation. Choose based on your preferences.',
      ctaLabel: 'View Details',
      urgencyLevel: 'LOW',
      confidence: 'LOW',
      tone: 'NEUTRAL',
    };
  }

  static getStyleClasses(
    decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID',
    confidence: number
  ): {
    containerBg: string;
    badgeBg: string;
    textColor: string;
    icon: string;
  } {
    const confLevel = confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low';

    const styles: Record<string, Record<string, { containerBg: string; badgeBg: string; textColor: string; icon: string }>> = {
      BUY_NOW: {
        high: { containerBg: 'bg-emerald-50 border-emerald-300', badgeBg: 'bg-emerald-500 text-white', textColor: 'text-emerald-900', icon: 'B' },
        medium: { containerBg: 'bg-green-50 border-green-300', badgeBg: 'bg-green-500 text-white', textColor: 'text-green-900', icon: 'B' },
        low: { containerBg: 'bg-gray-50 border-gray-300', badgeBg: 'bg-gray-500 text-white', textColor: 'text-gray-900', icon: 'B' },
      },
      WAIT: {
        high: { containerBg: 'bg-blue-50 border-blue-300', badgeBg: 'bg-blue-500 text-white', textColor: 'text-blue-900', icon: 'W' },
        medium: { containerBg: 'bg-cyan-50 border-cyan-300', badgeBg: 'bg-cyan-500 text-white', textColor: 'text-cyan-900', icon: 'W' },
        low: { containerBg: 'bg-slate-50 border-slate-300', badgeBg: 'bg-slate-500 text-white', textColor: 'text-slate-900', icon: 'W' },
      },
      AVOID: {
        high: { containerBg: 'bg-red-50 border-red-300', badgeBg: 'bg-red-600 text-white', textColor: 'text-red-900', icon: 'A' },
        medium: { containerBg: 'bg-orange-50 border-orange-300', badgeBg: 'bg-orange-500 text-white', textColor: 'text-orange-900', icon: 'A' },
        low: { containerBg: 'bg-amber-50 border-amber-300', badgeBg: 'bg-amber-500 text-white', textColor: 'text-amber-900', icon: 'A' },
      },
    };

    return styles[decisionType][confLevel] || styles.WAIT.low;
  }

  static getConfidenceLabel(confidence: number): string {
    if (confidence >= 75) return 'High Confidence';
    if (confidence >= 50) return 'Moderate Confidence';
    return 'Low Confidence';
  }

  static getConfidenceBars(confidence: number): string {
    const bars = Math.ceil((confidence / 100) * 5);
    return '#'.repeat(bars) + '-'.repeat(5 - bars);
  }
}

export default MessageVariants;