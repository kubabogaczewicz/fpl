import fs from "fs";
import path from "path";
import R from "ramda";
import { ImageFile, MovieFile } from "./models.js";

const processDirent = (cwd) =>
  R.cond([
    [(e) => e.isDirectory(), R.pipe(R.prop("name"), R.partial(path.join, [cwd]), walk)],
    [
      (e) => e.isFile(),
      R.pipe(
        R.prop("name"),
        R.cond([
          [ImageFile.match, R.partial(R.construct(ImageFile), [cwd])],
          [MovieFile.match, R.partial(R.construct(MovieFile), [cwd])],
        ]),
      ),
    ],
  ]);

const processRecursively = (cwd) => R.compose(R.chain(processDirent(cwd)), R.filter(Boolean));

export function walk(dirpath) {
  const dirents = fs.readdirSync(dirpath, { withFileTypes: true });

  return R.into([], processRecursively(dirpath), dirents);
};
