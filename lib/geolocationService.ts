/**
 * Geolocation Service
 * 
 * Browser-based geolocation detection
 * Gets user's current location (reverse geocoding done via API)
 */

export interface GeolocationCoordinates {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export interface GeolocationResult {
    coordinates: GeolocationCoordinates;
    city?: string;
    iataCode?: string;
    country?: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface GeolocationError {
    error: true;
    code: 'permission-denied' | 'position-unavailable' | 'timeout' | 'unknown';
    message: string;
}

/**
 * Get user's current geolocation with timeout
 * Non-blocking - prompts user for permission
 */
export async function getUserGeolocation(
    timeoutMs: number = 10000
): Promise<GeolocationResult | GeolocationError | null> {
    // Check browser support
    if (typeof window === 'undefined' || !navigator.geolocation) {
        return {
            error: true,
            code: 'position-unavailable',
            message: 'Geolocation not available in this browser'
        };
    }

    return new Promise((resolve) => {
        // Timeout after specified duration
        const timeoutId = setTimeout(() => {
            resolve({
                error: true,
                code: 'timeout',
                message: 'Location request timed out'
            });
        }, timeoutMs);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                clearTimeout(timeoutId);
                const { latitude, longitude, accuracy } = position.coords;

                resolve({
                    coordinates: {
                        latitude,
                        longitude,
                        accuracy,
                        timestamp: position.timestamp
                    },
                    confidence: accuracy < 1000 ? 'high' : accuracy < 5000 ? 'medium' : 'low'
                });
            },
            (error) => {
                clearTimeout(timeoutId);

                let errorCode: 'permission-denied' | 'position-unavailable' | 'timeout' | 'unknown' = 'unknown';
                let message = 'Unknown geolocation error';

                if (error.code === 1) {
                    errorCode = 'permission-denied';
                    message = 'Location permission denied. Enable location in settings.';
                } else if (error.code === 2) {
                    errorCode = 'position-unavailable';
                    message = 'Your location could not be determined.';
                } else if (error.code === 3) {
                    errorCode = 'timeout';
                    message = 'Location request timed out.';
                }

                resolve({
                    error: true,
                    code: errorCode,
                    message
                });
            },
            {
                enableHighAccuracy: false, // Don't wait for GPS, use cell tower is fine
                timeout: timeoutMs,
                maximumAge: 300000 // Cache result for 5 minutes
            }
        );
    });
}

/**
 * Try to get user's location silently
 * If permission already granted, returns location
 * If permission not granted, returns null (doesn't prompt)
 */
export async function tryGetMemoizedGeolocation(): Promise<GeolocationResult | null> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
        return null;
    }

    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            resolve(null);
        }, 3000); // Quick 3-second timeout

        navigator.geolocation.getCurrentPosition(
            (position) => {
                clearTimeout(timeoutId);
                const { latitude, longitude, accuracy } = position.coords;

                resolve({
                    coordinates: {
                        latitude,
                        longitude,
                        accuracy,
                        timestamp: position.timestamp
                    },
                    confidence: accuracy < 1000 ? 'high' : accuracy < 5000 ? 'medium' : 'low'
                });
            },
            () => {
                // Silent failure - just resolve with null
                clearTimeout(timeoutId);
                resolve(null);
            },
            {
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: 300000 // 5 min cache
            }
        );
    });
}

/**
 * Format geolocation result for display
 */
export function formatGeolocationForDisplay(result: GeolocationResult): string {
    if (!result.city) {
        return `${result.coordinates.latitude.toFixed(2)}, ${result.coordinates.longitude.toFixed(2)}`;
    }

    if (result.iataCode) {
        return `${result.city} (${result.iataCode})`;
    }

    return result.city;
}
