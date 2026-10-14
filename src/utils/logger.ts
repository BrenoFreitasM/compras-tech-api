import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Retorna o timestamp formatado no fuso horário de Brasília/São Paulo (America/Sao_Paulo - UTC-3).
 * Garante o horário correto mesmo se o servidor/container Docker estiver em UTC.
 */
function getSaoPauloTimestamp(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';

  if (isProduction) {
    // Formato ISO-8601 com offset de fuso para produção estruturada
    const iso = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond')}-03:00`;
    return `,"time":"${iso}"`;
  }

  // Formato legível para pino-pretty em desenvolvimento
  const readable = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond')}`;
  return `,"time":"${readable}"`;
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: getSaoPauloTimestamp,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'password'],
    censor: '[REDACTED]',
  },
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: false,
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default logger;
