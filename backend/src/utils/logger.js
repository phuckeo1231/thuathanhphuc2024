const C = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', debug: '\x1b[90m', reset: '\x1b[0m' };

function ts() { return new Date().toISOString(); }

export default {
  info:  (msg, ...a) => console.log(`${C.info}[INFO]${C.reset}  ${ts()} ${msg}`, ...a),
  warn:  (msg, ...a) => console.log(`${C.warn}[WARN]${C.reset}  ${ts()} ${msg}`, ...a),
  error: (msg, ...a) => console.error(`${C.error}[ERROR]${C.reset} ${ts()} ${msg}`, ...a),
  debug: (msg, ...a) => console.log(`${C.debug}[DEBUG]${C.reset} ${ts()} ${msg}`, ...a),
};
