// const winston = require('winston');

// const logger = winston.createLogger({
//   level: (process.env.LOG_LEVEL).toLowerCase() || 'info',
//   format: winston.format.json(),
//   //   defaultMeta: { service: 'user-service' },
//   transports: [
//     //
//     // - Write all logs with level `error` and below to `error.log`
//     // - Write all logs with level `info` and below to `combined.log`
//     //
//     // new winston.transports.File({ filename: 'error.log', level: 'error' }),
//     // new winston.transports.File({ filename: 'combined.log' }),
//   ],
// });

// //
// // If we're not in production then log to the `console` with the format:
// // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// //
// if (process.env.NODE_ENV !== 'production') {
//   logger.add(new winston.transports.Console({
//     format: winston.format.simple(),
//   }));
// }


/* ********************* MANUAL LOGGING ********************* */

const logLevels = {
  error: 0,
  warning: 1,
  info: 2,
  debug: 3
};

const configLevel = logLevels[(process.env.LOG_LEVEL).toLowerCase()];
if (configLevel === undefined) throw new Error('ERROR: Got undefined log level!');


const _log = (level, ...msgs) => {
  if (level <= configLevel) {
    console.log(...msgs);
  }
};


const log = {
  debug: (...msgs) => { _log(logLevels.debug, ...msgs); },
  info: (...msgs) => { _log(logLevels.info, ...msgs); },
  error: (...msgs) => { _log(logLevels.error, ...msgs); }
};

module.exports = log;
// module.exports = {
//   debug,
//   info,
//   error
// };