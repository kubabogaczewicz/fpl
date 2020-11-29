const noop = () => {};
const log = console.log.bind(console);

export const logger = (verbosityLevel: number) => {
  return {
    v: verbosityLevel >= 1 ? log : noop,
    vv: verbosityLevel >= 2 ? log : noop,
    vvv: verbosityLevel >= 3 ? log : noop,
  };
};
