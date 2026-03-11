import * as winston from 'winston';

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, context, stack }) => {
    const ctx = context ? ` [${context}]` : '';
    return `${ts} ${level}${ctx}: ${stack ?? message}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export function createLoggerConfig(): winston.LoggerOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    level: isProduction ? 'info' : 'debug',
    format: isProduction ? prodFormat : devFormat,
    transports: [
      new winston.transports.Console(),
      ...(isProduction
        ? [
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
              maxsize: 10 * 1024 * 1024,
              maxFiles: 10,
            }),
          ]
        : []),
    ],
  };
}
