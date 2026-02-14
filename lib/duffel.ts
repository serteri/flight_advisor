import { Duffel } from '@duffel/api';

// Return a Duffel client created at call time so it always reads the
// current `process.env.DUFFEL_ACCESS_TOKEN`. This avoids token being
// captured at module-import time (which caused 401s when env vars
// were not available yet).
export function getDuffel() {
    const token = process.env.DUFFEL_ACCESS_TOKEN;
    if (!token) throw new Error('DUFFEL_ACCESS_TOKEN is not set');
    return new Duffel({ token });
}
