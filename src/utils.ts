import R from "ramda";
import { logger } from "./log.js";
import { MediaFile } from "./models.js";
import { asyncWalk } from "./walker.js";

export const notEmpty = R.compose(R.not, R.isEmpty);
export const regexpTest = (regexp: RegExp) => R.compose(notEmpty, R.match(regexp));

export const executeIf = (run: boolean) => (func: () => void) => run && func();

type MediaClass = { new (a: string): MediaFile; match: (a: string) => boolean };
export const getMediaFile = (mediaClasses: MediaClass[]) =>
  R.cond(mediaClasses.map((cls) => [cls.match, R.construct(cls)]));

export async function collectMediaFiles(
  dirPath: string,
  mediaClasses: MediaClass[],
  log: ReturnType<typeof logger>,
  limit: number,
) {
  let files: MediaFile[] = [];
  for await (const filePath of asyncWalk(dirPath)) {
    if (files.length >= limit) {
      log.v("Already collected ${limit} number of files, halting further collection");
      break;
    }
    const media = getMediaFile(mediaClasses)(filePath);
    if (media) {
      log.vv("File %s is recognized as %s", filePath, media.constructor.name);
      files.push(media);
    } else {
      log.vv("File %s is omited", filePath);
    }
  }
  return files;
}
