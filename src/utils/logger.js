const logger = {
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  info: (...args) => {
    console.info('[INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  debug: (...args) => {
    console.debug('[DEBUG]', ...args);
  }
};

module.exports = logger;