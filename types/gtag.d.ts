// types/gtag.d.ts
// Manual gtag type declaration — do NOT install @types/gtag alongside this.

type GtagConsentArg = {
  analytics_storage?: 'granted' | 'denied';
  ad_storage?: 'granted' | 'denied';
  ad_user_data?: 'granted' | 'denied';
  ad_personalization?: 'granted' | 'denied';
  wait_for_update?: number;
  [key: string]: string | number | boolean | undefined;
};

type GtagConfigParams = {
  page_path?: string;
  page_title?: string;
  send_page_view?: boolean;
  [key: string]: string | number | boolean | undefined;
};

type GtagEventParams = {
  [key: string]: string | number | boolean | undefined;
};

declare function gtag(command: 'js', date: Date): void;
declare function gtag(
  command: 'config',
  targetId: string,
  params?: GtagConfigParams,
): void;
declare function gtag(
  command: 'event',
  eventName: string,
  params?: GtagEventParams,
): void;
declare function gtag(
  command: 'consent',
  action: 'default' | 'update',
  params: GtagConsentArg,
): void;
declare function gtag(command: 'set', params: Record<string, unknown>): void;

// eslint-disable-next-line no-var
declare var dataLayer: unknown[];
