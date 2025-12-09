export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLogLevel = LogLevel.INFO;

function formatLog(level: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] ${message}${dataStr}`;
}

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(formatLog('DEBUG', message, data));
    }
  },
  info: (message: string, data?: unknown) => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(formatLog('INFO', message, data));
    }
  },
  warn: (message: string, data?: unknown) => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(formatLog('WARN', message, data));
    }
  },
  error: (message: string, error?: unknown) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      const errorData =
        error instanceof Error ? { message: error.message, stack: error.stack } : error;
      console.error(formatLog('ERROR', message, errorData));
    }
  },
};
