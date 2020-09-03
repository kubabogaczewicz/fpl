import FlexProgress from "@dinoabsoluto/flex-progress";
import ef from "exiftool-vendored";
import fs from "fs/promises";
import ora from "ora";
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

const knownFile = R.anyPass([
  R.compose(R.not, R.isEmpty, R.match(/\.jpe?g$/i)),
  R.compose(R.not, R.isEmpty, R.match(/\.heic$/i)),
  R.compose(R.not, R.isEmpty, R.match(/(mov|mp4)$/i)),
]);
const transducer = R.compose(R.chain(processDirent), R.filter(R.identity), R.map(R.prop("name")), R.filter(knownFile));
walk = async (dirname) => {
  const dirents = await fs.readdir(dirname, { withFileTypes: true });

  return R.into([], transducer, dirents);
};

async function* fileStatuses(dirpath, files) {
  for (const file of files) {
    const exif = await exiftool.read(path.join(dirpath, file));
    if (exif.GPSPosition == null) {
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
  const spinner = ora("Collecting files").start();
  let files = await walk(dirpath);
  spinner.succeed();

  let badFiles = [];

  const out = new FlexProgress.Output();
  const bar = new FlexProgress.Bar({ width: 25 });

  out.append(new FlexProgress.HideCursor(), new FlexProgress.Spinner(), 1, "Validating files... ", 1, "⸨", bar, "⸩");

  let count = 0;
  for await (const [isValid, filename] of fileStatuses(dirpath, files)) {
    bar.ratio = (count++ % files.length) / (files.length - 1);
    if (!isValid) {
      badFiles.push(filename);
    }
  }
  out.clear();

  if (!R.isEmpty(badFiles)) {
    ora("Validating files").fail();
    for (const f of badFiles) {
      process.stdout.write(f + "\n");
    }
    yargs.exit(1);
  } else {
    ora("Validating files").succeed();
    yargs.exit(0);
  }
};
