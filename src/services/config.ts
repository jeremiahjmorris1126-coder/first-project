export interface AppConfig {
  port: number;
  nodeEnv: string;
  gemini: {
    apiKey: string;
    model: string;
    isLive: boolean;
  };
  salesforce: {
    enabled: boolean;
    loginUrl: string;
    clientId: string;
    clientSecret: string;
    username: string;
    apiVersion: string;
  };
  telematics: {
    source: 'simulation' | 'hardware' | 'geotab' | 'samsara';
    webhookSecret: string;
    broadcastIntervalMs: number;
  };
}

export const appConfig: AppConfig = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    isLive: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
  },
  salesforce: {
    enabled: process.env.SALESFORCE_ENABLED === 'true',
    loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    username: process.env.SALESFORCE_USERNAME || '',
    apiVersion: process.env.SALESFORCE_API_VERSION || 'v60.0',
  },
  telematics: {
    source: (process.env.TELEMATICS_SOURCE as any) || 'simulation',
    webhookSecret: process.env.TELEMATICS_WEBHOOK_SECRET || '',
    broadcastIntervalMs: process.env.TELEMATICS_BROADCAST_INTERVAL_MS
      ? parseInt(process.env.TELEMATICS_BROADCAST_INTERVAL_MS, 10)
      : 3000,
  },
};
