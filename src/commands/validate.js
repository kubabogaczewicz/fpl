import ef from "exiftool-vendored";
import fs from "fs/promises";
import path from "path";
import R from "ramda";
import yargs from "yargs";

const exiftool = ef.exiftool;

export const command = "validate <fileOrDirectory..>";

export const describe = `Validates that all passed files or directories are organizable. Checks only known types of files, checks directories recursively`;

export const builder = (yargs) => {};
let walk;
const processDirent = R.cond([
  [(e) => e.isDirectory(), R.pipe(R.prop("name"), walk)],
  [(e) => e.isFile(), R.identity],
  [R.T, R.always(null)],
]);
const knownFile = R.anyPass([R.match(/\.jpe?g$/i), R.match(/\.heic$/i), R.match(/(mov|mp4)$/i)]);
const transducer = R.compose(R.chain(processDirent), R.filter(R.identity), R.map(R.prop("name")), R.filter(knownFile));
walk = async (dirname) => {
  const dirents = await fs.readdir(dirname, { withFileTypes: true });

  return R.into([], transducer, dirents);
};

async function* fileStatuses(dirpath, files) {
  for (const file of files) {
    const exif = await exiftool.read(path.join(dirpath, file));
    if (!exif.GPSPosition) {
      yield [false, file];
    } else {
      yield [true, file];
    }
  }
}
export const handler = async (argv) => {
  const dirpath = argv.fileOrDirectory[0];

  try {
    await fs.stat(dirpath);
  } catch (e) {
    yargs.exit(1, e);
  }

  let files = await walk(dirpath);
  let badFiles = [];

  for await (const [isValid, filename] of fileStatuses(dirpath, files)) {
    if (!isValid) {
      badFiles.push(filename);
    }
  }
  if (R.isEmpty(badFiles)) {
    yargs.exit(1);
  }
  yargs.exit(0);
};
