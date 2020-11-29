import R from "ramda";

export const notEmpty = R.compose(R.not, R.isEmpty);
export const regexpTest = (regexp: RegExp) => R.compose(notEmpty, R.match(regexp));

export const executeIf = (run: boolean) => (func: () => void) => run && func();
