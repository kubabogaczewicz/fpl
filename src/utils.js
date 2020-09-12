import R from "ramda";

export const notEmpty = R.compose(R.not, R.isEmpty);
export const regexpTest = (regexp) => R.compose(notEmpty, R.match(regexp));
