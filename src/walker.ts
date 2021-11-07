import fs from "fs";
import path from "path";
import R from "ramda";
import { ImageFile, MediaFile, MovieFile } from "./models.js";

type MaybeMedia = MediaFile | undefined;
type NestedMaybeMedia = MaybeMedia | MaybeMedia[];

const processDirent = (cwd: string): ((e: fs.Dirent) => NestedMaybeMedia) =>
  R.cond<fs.Dirent, NestedMaybeMedia>([
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

function deepWalk(dirpath: string): NestedMaybeMedia[] {
  const dirents = fs.readdirSync(dirpath, { withFileTypes: true });

  return R.map(processDirent(dirpath), dirents);
}

function properMediaFiles(aFile: MaybeMedia): aFile is MediaFile {
  return aFile != null;
}

declare module "ramda" {
  interface Filter {
    <S extends T, T = any>(predicate: (x: T) => x is S): (list: readonly T[]) => S[];
  }
}
export const walk: (x: string) => MediaFile[] = R.pipe(deepWalk, R.flatten, R.filter(properMediaFiles));

export async function* asyncWalk(dirpath: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dirpath)) {
    const entry = path.join(dirpath, d.name);
    if (d.isDirectory()) yield* await asyncWalk(entry);
    else if (d.isFile()) yield entry;
  }
}
