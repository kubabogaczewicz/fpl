import FlexProgress from "@dinoabsoluto/flex-progress";
import fs from "fs/promises";
import ora from "ora";
import R from "ramda";
import yargs from "yargs";
import { walk } from "../walker.js";

export const command = "validate <fileOrDirectory..>";

export const describe = `Validates that all passed files or directories are organizable. Checks only known types of files, checks directories recursively`;

export const builder = (yargs) => {};

async function* fileStatuses(files) {
  for (const file of files) {
    await file.loadMetadata();
    yield [file.isValid(), file];
  }
}

export const handler = async (argv) => {
  const dirpath = argv.fileOrDirectory[0];

  try {
    await fs.stat(dirpath);
  } catch (e) {
    ora(`Cannot open directory: ${dirpath}`).fail();
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
  for await (const [isValid, filename] of fileStatuses(files)) {
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
