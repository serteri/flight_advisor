import type { ChannelResponse, PushRequest } from '../types';

export class PushProvider {
    async sendPush(_request: PushRequest): Promise<ChannelResponse> {
        return {
            success: false,
            channel: 'PUSH',
            error: 'Push provider not configured yet',
        };
    }
}
