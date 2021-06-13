import FlexProgress from "@dinoabsoluto/flex-progress";
import { FplArguments } from "fpl-types.js";
import fs from "fs/promises";
import { MediaFile } from "models.js";
import ora from "ora";
import R from "ramda";
import yargs from "yargs";
import { walk } from "../walker.js";

export const command = "validate <directory>";

export const describe = `Validates that all files in passed directory are organizable. Checks only known types of files, checks directories recursively`;

export const builder = () => {};

async function* fileStatuses(files: ReturnType<typeof walk>): AsyncIterable<[boolean, MediaFile]> {
  for (const file of files) {
    await file.loadMetadata();
    yield [file.isValid(), file];
  }
}

interface ValidateArguments extends FplArguments {
  directory: string;
}
export const handler = async (argv: yargs.Arguments<ValidateArguments>) => {
  const { directory } = argv;

  try {
    await fs.stat(directory);
  } catch (e) {
    ora(`Cannot open directory: ${directory}`).fail();
    process.exit(1);
  }
  const spinner = ora("Collecting files").start();
  let files = walk(directory);
  spinner.succeed();

  let badFiles = [];

  const out = new FlexProgress.Output();
  const bar = new FlexProgress.Bar({ width: 25 });
  const filesCounter = new FlexProgress.Text();

  out.append(
    new FlexProgress.HideCursor(),
    new FlexProgress.Spinner(),
    1,
    "Validating files... ",
    1,
    "⸨",
    bar,
    "⸩",
    1,
    filesCounter,
    1,
    `of ${files.length}`,
  );

  let count = 0;
  for await (const [isValid, file] of fileStatuses(files)) {
    bar.ratio = (count++ % files.length) / (files.length - 1);
    filesCounter.text = count.toString();
    if (!isValid) {
      badFiles.push(file.filename);
    }
  }
  out.clear();

  if (!R.isEmpty(badFiles)) {
    ora("Validating files").fail();
    for (const f of badFiles) {
      process.stdout.write(f + "\n");
    }
    process.exit(1);
  } else {
    ora("Validating files").succeed();
    process.exit(0);
  }
};
