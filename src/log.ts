const noop = () => {};
const error = console.error.bind(console);

export const logger = (verbosityLevel: number) => {
  const result = (...msg: any[]) => verbosityLevel >= 1 && error(...msg);
  result.v = verbosityLevel >= 2 ? error : noop;
  result.vv = verbosityLevel >= 3 ? error : noop;
  return result;
};
