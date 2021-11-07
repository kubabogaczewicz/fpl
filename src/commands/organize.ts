import FlexProgress from "@dinoabsoluto/flex-progress";
import { execFileSync } from "child_process";
import ef, { ExifDateTime, Tags } from "exiftool-vendored";
import fs from "fs";
import logSymbols from "log-symbols";
import ora from "ora";
import path from "path";
import R from "ramda";
import yargs from "yargs";
import { logger } from "../log.js";
import { ImageFile, MediaFile, MovieFile } from "../models.js";
import { collectMediaFiles, regexpTest } from "../utils.js";

const exiftool = ef.exiftool;

declare module "ramda" {
  export function propIs<Type, KeyName extends string, O extends Record<KeyName, Type>>(
    type: Type,
    name: KeyName,
  ): (obj: any) => obj is O;
}

export const command = "organize <srcDirectory> <targetDirectory>";

export const describe = `Organizes all files from srcDirectory (recursively) into targetDirectory`;

export const builder = (yargs: yargs.Argv) => {
  return yargs
    .option("dry-run", {
      type: "boolean",
      default: false,
      description: "Do not perform actual copying of files, instead print what would happen to stdout.",
    })
    .option("limit", {
      type: "number",
      default: Infinity,
      description: "Process at max n number of files. Useful for tests. -1 turns off limit.",
    })
    .option("operation", {
      choices: ["copy", "clone", "move"],
      default: "clone",
      description: "What to do with organized files. Clone is possible only within the same apfs volume.",
    })
    .option("subfolder-format", {
      choices: ["year", "year-month"],
      default: "year",
      description: "How to split files into subfolders.",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      conflicts: ["silent", "debug"],
      description: "Run with verbose logging",
    })
    .option("debug", {
      type: "boolean",
      conflicts: ["silent", "verbose"],
      description: "Run with debug-level logging",
    })
    .option("silent", {
      alias: "s",
      type: "boolean",
      conflicts: ["verbose", "debug"],
      description: "Run with minimal logging",
    });
};

const normalizeExtension = R.cond<string, string>([
  [regexpTest(/\.jpe?g/i), R.always(".jpg")],
  [R.T, R.toLower],
]);

type OrganizeArguments = {
  srcDirectory: string;
  targetDirectory: string;
  dryRun: boolean;
  limit: number;
  operation: "clone" | "copy" | "move";
  subfolderFormat: "year" | "year-month";
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
};

type FeedbackType = "silent" | "standard" | "verbose";

export const handler = async (argv: yargs.Arguments<OrganizeArguments>) => {
  const srcPath = argv.srcDirectory;
  const dstPath = argv.targetDirectory;
  const dryRun = argv.dryRun;
  const operation = argv.operation;
  const subfolderFormat = argv.subfolderFormat;
  const feedbackType =
    argv.verbose === true || argv.debug === true ? "verbose" : argv.silent === true ? "silent" : "standard";
  const feedbackLevel = argv.silent === true ? 0 : argv.verbose === true ? 2 : argv.debug === true ? 3 : 1;
  const limit = argv.limit > 0 ? argv.limit : Infinity;

  const execUnlessDryRun = (perform: () => void, describe: string | (() => void)) => {
    if (dryRun) {
      console.log(typeof describe === "function" ? describe() : describe);
    } else {
      perform();
    }
  };
  const log = logger(feedbackLevel);
  log.vv(`Starting organize, argv: `, argv);

  const knownExistingFolders = new Set<string>();
  function ensureSubfolderExists(parentDirPath: string, subfolderName: string) {
    const subfolderPath = path.join(parentDirPath, subfolderName);
    if (knownExistingFolders.has(subfolderPath)) {
      return;
    }
    try {
      log.vv(`Checking if target directory ${subfolderPath} exists`);
      fs.accessSync(subfolderPath, fs.constants.F_OK);
    } catch (e) {
      log.v(`Creating target directory ${subfolderPath}`);
      execUnlessDryRun(() => {
        try {
          fs.mkdirSync(subfolderPath, { recursive: true });
        } catch (e) {
          log(`${logSymbols.error} Cannot create directory: ${ensureSubfolderExists}`);
          process.exit(1);
        }
      }, `mkdir -r ${subfolderPath}`);
    } finally {
      knownExistingFolders.add(subfolderPath);
    }
  }

  try {
    fs.accessSync(srcPath, fs.constants.R_OK | fs.constants.X_OK);
  } catch (e) {
    log(`${logSymbols.error} Cannot open directory: ${srcPath}`);
    process.exit(1);
  }

  const spinner = ora({ text: "Collecting files", isSilent: feedbackType === "silent" }).start();
  let files = await collectMediaFiles(srcPath, [ImageFile, MovieFile], log, limit);
  spinner.succeed(`Collected ${files.length} files`);

  const out = new FlexProgress.Output();
  const bar = new FlexProgress.Bar({ width: 25 });
  const filesCounter = new FlexProgress.Text();

  if (feedbackType === "standard") {
    out.append(
      new FlexProgress.HideCursor(),
      new FlexProgress.Spinner(),
      1,
      "Processing files... ",
      1,
      "⸨",
      bar,
      "⸩",
      1,
      filesCounter,
      1,
      `of ${files.length}`,
    );
  }

  const fileExtension: (m: MediaFile) => string = R.pipe(R.prop("filepath"), path.extname, normalizeExtension);
  let processedCounter = 0;
  filesCounter.text = processedCounter.toString();

  let loaders = files.map(async (file) => {
    await file.loadMetadata();
    bar.ratio = (processedCounter++ % files.length) / (files.length - 1);
    filesCounter.text = processedCounter.toString();

    const metadata = file.metadata!;
    const exifCreateDateTime = R.cond<Tags, ExifDateTime>([
      [R.propIs(ExifDateTime, "CreationDate"), R.prop("CreationDate") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "CreateDate"), R.prop("CreateDate") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "DateTimeOriginal"), R.prop("DateTimeOriginal") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "DateTimeCreated"), R.prop("DateTimeCreated") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "FileModifyDate"), R.prop("FileModifyDate") as (t: Tags) => ExifDateTime],
    ])(metadata)!;
    const createDateTime = exifCreateDateTime.toDateTime();
    let processed = false;
    const subfolderPath = createDateTime.toFormat(subfolderFormat === "year" ? "yyyy" : "yyyy/LL");
    ensureSubfolderExists(dstPath, subfolderPath);
    const formattedDate = createDateTime.toFormat("yyyy-LL-dd'T'HHmmssZZZ");
    let exclusiveSuffix = "";
    let retryCount = 0;
    const ext = fileExtension(file);
    let maybeFilename = `${formattedDate}${exclusiveSuffix}${ext}`;
    let fullDstFilepath = path.join(dstPath, subfolderPath, maybeFilename);
    while (!processed) {
      try {
        fs.accessSync(fullDstFilepath, fs.constants.F_OK);
        log.vv(`File ${fullDstFilepath} already exists, try with bigger suffix`);
        exclusiveSuffix = `--${++retryCount}`;
        maybeFilename = `${formattedDate}${exclusiveSuffix}${ext}`;
        fullDstFilepath = path.join(dstPath, subfolderPath, maybeFilename);
      } catch (e) {
        // doesn't exists, we can copy!
        log.v(`${operation} ${path.relative(srcPath, file.filepath)} → ${path.relative(dstPath, fullDstFilepath)}`);
        execUnlessDryRun(
          () => {
            switch (operation) {
              case "copy": {
                fs.copyFileSync(file.filepath, fullDstFilepath);
                break;
              }
              case "clone": {
                execFileSync(`cp`, ["-c", file.filepath, fullDstFilepath]);
                break;
              }
              case "move": {
                fs.renameSync(file.filepath, fullDstFilepath);
                break;
              }
            }
          },
          () => {
            switch (operation) {
              case "copy":
                return `cp '${file.filepath}' '${fullDstFilepath}'`;
              case "clone":
                return `cp -c '${file.filepath}' '${fullDstFilepath}'`;
              case "move":
                return `mv '${file.filepath}' '${fullDstFilepath}'`;
            }
          },
        );
        processed = true;
      }
    }
  });
  await Promise.all(loaders);
  out.clear();
  log(`${logSymbols.success} Processed ${files.length} files`);
  exiftool.end();
};
