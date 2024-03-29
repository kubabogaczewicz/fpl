import FlexProgress from "@dinoabsoluto/flex-progress";
import fs from "fs/promises";
import logSymbols from "log-symbols";
import ora from "ora";
import R from "ramda";
import yargs from "yargs";
import { logger } from "../log.js";
import { ImageFile, MediaFile } from "../models.js";
import { collectMediaFiles } from "../utils.js";
import { walk } from "../walker.js";

const command = "validate <directory>";

const describe = `Validates that all files in passed directory are organizable. Checks only known types of files, checks directories recursively`;

async function* fileStatuses(files: ReturnType<typeof walk>): AsyncIterable<MediaFile> {
  for (const file of files) {
    await file.loadMetadata();
    yield file;
  }
}

interface ValidateArguments {
  directory: string;
}
const handler = async (argv: yargs.Arguments<ValidateArguments>) => {
  const { directory } = argv;
  const log = logger(1);

  try {
    await fs.stat(directory);
  } catch (e) {
    log(`${logSymbols.error} Cannot open directory: ${directory}`);
    process.exit(1);
  }

  const spinner = ora("Collecting files").start();
  let files = await collectMediaFiles(directory, [ImageFile], log, Infinity);
  spinner.succeed(`Collected ${files.length} files`);

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
  for await (const file of fileStatuses(files)) {
    bar.ratio = (count++ % files.length) / (files.length - 1);
    filesCounter.text = count.toString();
    if (!file.isValid()) {
      badFiles.push(file.filepath);
    }
  }
  out.clear();

  if (!R.isEmpty(badFiles)) {
    log(`${logSymbols.error} Validating failed for ${badFiles.length} of ${files.length} files`);
    for (const f of badFiles) {
      process.stdout.write(f + "\n");
    }
    throw "Not all files pass validation";
  } else {
    log(`${logSymbols.success} Validating files`);
  }
};

const validateCommand: yargs.CommandModule<{}, ValidateArguments> = {
  command,
  describe,
  handler,
};

export default validateCommand;
