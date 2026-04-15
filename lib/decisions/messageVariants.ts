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
        shortMessage: '⚪ Decent Price',
        fullMessage: 'Weak signal: This price is lower than average, but the signal is not strong. Consider if you\'re comfortable with the price.',
        ctaLabel: 'Book',
        urgencyLevel: 'LOW',
        confidence: 'LOW',
        tone: 'NEUTRAL',  \n      };\n    }\n  }\n\n  /**\n   * Get message variants for WAIT decision\n   */\n  static getWaitMessaging(confidence: number): MessageVariant {\n    if (confidence >= 75) {\n      return {\n        shortMessage: '⬇️ Likely to Drop - Track It',\n        fullMessage: 'Strong signal: Based on pricing trends, you could save significantly by waiting. We\\'ll monitor and alert you.',\n        ctaLabel: 'Track This Flight',\n        urgencyLevel: 'MEDIUM',\n        confidence: 'HIGH',\n        tone: 'POSITIVE',\n      };\n    } else if (confidence >= 50) {\n      return {\n        shortMessage: '📊 May Drop - Worth Tracking',\n        fullMessage: 'Moderate signal: Prices sometimes decrease, so waiting could pay off. Set a price alert to stay informed.',\n        ctaLabel: 'Track Price',\n        urgencyLevel: 'MEDIUM',\n        confidence: 'MEDIUM',\n        tone: 'CAUTIOUS',\n      };\n    } else {\n      return {\n        shortMessage: '⏳ Could Go Either Way',\n        fullMessage: 'Weak signal: Prices are uncertain. You might want to wait, but no strong case either way.',\n        ctaLabel: 'Track',\n        urgencyLevel: 'LOW',\n        confidence: 'LOW',\n        tone: 'NEUTRAL',\n      };\n    }\n  }\n\n  /**\n   * Get message variants for AVOID decision\n   */\n  static getAvoidMessaging(confidence: number): MessageVariant {\n    if (confidence >= 75) {\n      return {\n        shortMessage: '❌ Overpriced - Better Options Exist',\n        fullMessage: 'Strong signal: This price is significantly higher than typical. You\\'ll almost certainly find better options above.',\n        ctaLabel: 'See Better Options',\n        urgencyLevel: 'HIGH',\n        confidence: 'HIGH',\n        tone: 'URGENT',\n      };\n    } else if (confidence >= 50) {\n      return {\n        shortMessage: '⚠️ High Price - Consider Alternatives',\n        fullMessage: 'Moderate signal: This is priced above average. There are likely better deals available.',\n        ctaLabel: 'Browse Others',\n        urgencyLevel: 'MEDIUM',\n        confidence: 'MEDIUM',\n        tone: 'CAUTIOUS',\n      };\n    } else {\n      return {\n        shortMessage: '💭 Pricey - Check Others',\n        fullMessage: 'Weak signal: This is a bit pricier than usual, but may still be reasonable depending on your preferences.',\n        ctaLabel: 'See More Options',\n        urgencyLevel: 'LOW',\n        confidence: 'LOW',\n        tone: 'NEUTRAL',\n      };\n    }\n  }\n\n  /**\n   * Get messaging for any decision + confidence combo\n   */\n  static getMessaging(\n    decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID',\n    confidence: number\n  ): MessageVariant {\n    switch (decisionType) {\n      case 'BUY_NOW':\n        return this.getBuyNowMessaging(confidence);\n      case 'WAIT':\n        return this.getWaitMessaging(confidence);\n      case 'AVOID':\n        return this.getAvoidMessaging(confidence);\n      default:\n        return {\n          shortMessage: 'No Strong Signal',\n          fullMessage: 'The data doesn\\'t give a clear recommendation. Choose based on your preferences.',\n          ctaLabel: 'View Details',\n          urgencyLevel: 'LOW',\n          confidence: 'LOW',\n          tone: 'NEUTRAL',\n        };\n    }\n  }\n\n  /**\n   * Get CSS classes based on confidence + decision\n   */\n  static getStyleClasses(\n    decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID',\n    confidence: number\n  ): {\n    containerBg: string;\n    badgeBg: string;\n    textColor: string;\n    icon: string;\n  } {\n    const confLevel = confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low';\n\n    const styles: Record<string, any> = {\n      BUY_NOW: {\n        high: {\n          containerBg: 'bg-emerald-50 border-emerald-300',\n          badgeBg: 'bg-emerald-500 text-white',\n          textColor: 'text-emerald-900',\n          icon: '🔴',\n        },\n        medium: {\n          containerBg: 'bg-green-50 border-green-300',\n          badgeBg: 'bg-green-500 text-white',\n          textColor: 'text-green-900',\n          icon: '🟢',\n        },\n        low: {\n          containerBg: 'bg-gray-50 border-gray-300',\n          badgeBg: 'bg-gray-500 text-white',\n          textColor: 'text-gray-900',\n          icon: '⚪',\n        },\n      },\n      WAIT: {\n        high: {\n          containerBg: 'bg-blue-50 border-blue-300',\n          badgeBg: 'bg-blue-500 text-white',\n          textColor: 'text-blue-900',\n          icon: '⬇️',\n        },\n        medium: {\n          containerBg: 'bg-cyan-50 border-cyan-300',\n          badgeBg: 'bg-cyan-500 text-white',\n          textColor: 'text-cyan-900',\n          icon: '📊',\n        },\n        low: {\n          containerBg: 'bg-slate-50 border-slate-300',\n          badgeBg: 'bg-slate-500 text-white',\n          textColor: 'text-slate-900',\n          icon: '⏳',\n        },\n      },\n      AVOID: {\n        high: {\n          containerBg: 'bg-red-50 border-red-300',\n          badgeBg: 'bg-red-600 text-white',\n          textColor: 'text-red-900',\n          icon: '❌',\n        },\n        medium: {\n          containerBg: 'bg-orange-50 border-orange-300',\n          badgeBg: 'bg-orange-500 text-white',\n          textColor: 'text-orange-900',\n          icon: '⚠️',\n        },\n        low: {\n          containerBg: 'bg-amber-50 border-amber-300',\n          badgeBg: 'bg-amber-500 text-white',\n          textColor: 'text-amber-900',\n          icon: '💭',\n        },\n      },\n    };\n\n    return styles[decisionType]?.[confLevel] || styles.WAIT.low;\n  }\n\n  /**\n   * Get confidence level label\n   */\n  static getConfidenceLabel(confidence: number): string {\n    if (confidence >= 75) return 'High Confidence';\n    if (confidence >= 50) return 'Moderate Confidence';\n    return 'Low Confidence';\n  }\n\n  /**\n   * Get confidence visual indicator (0-5 stars or bars)\n   */\n  static getConfidenceBars(confidence: number): string {\n    const bars = Math.ceil((confidence / 100) * 5);\n    return '█'.repeat(bars) + '░'.repeat(5 - bars);\n  }\n}\n\nexport default MessageVariants;\n