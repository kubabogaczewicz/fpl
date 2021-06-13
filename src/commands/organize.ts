import FlexProgress from "@dinoabsoluto/flex-progress";
import { execFileSync } from "child_process";
import { ExifDateTime, Tags } from "exiftool-vendored";
import { FplArguments } from "fpl-types.js";
import fs from "fs";
import ora from "ora";
import path from "path";
import R from "ramda";
import yargs from "yargs";
import { logger } from "../log.js";
import { MediaFile } from "../models.js";
import { executeIf, regexpTest } from "../utils.js";
import { walk } from "../walker.js";

declare module "ramda" {
  export function propIs<Type, KeyName extends string, O extends Record<KeyName, Type>>(
    type: Type,
    name: KeyName,
  ): (obj: any) => obj is O;
}

export const command = "organize <srcDirectory> <targetDirectory";

export const describe = `Organizes all files from srcDirectory (recursively) into targetDirectory`;

export const builder = (yargs: yargs.Argv) => {
  yargs
    .option("dry-run", {
      type: "boolean",
      default: false,
      description: "Do not perform actual copying of files",
    })
    .option("operation", {
      choices: ["copy", "clone", "move"],
      default: "clone",
      description: "What to do with organized files.",
    })
    .option("subfolder-format", {
      choices: ["year", "year-month"],
      default: "year",
      description: "How to split files into subfolders.",
    });
};

const normalizeExtension = R.cond<string, string>([
  [regexpTest(/\.jpe?g/i), R.always(".jpg")],
  [R.T, R.toLower],
]);

interface OrganizeArguments extends FplArguments {
  srcDirectory: string;
  targetDirectory: string;
  dryRun: boolean;
  operation: "clone" | "copy" | "move";
  subfolderFormat: "year" | "year-month";
}
export const handler = async (argv: yargs.Arguments<OrganizeArguments>) => {
  const srcPath = argv.srcDirectory;
  const dstPath = argv.targetDirectory;
  const dryRun = argv.dryRun;
  const operation = argv.operation;
  const subfolderFormat = argv.subfolderFormat;
  const verbose = Math.max(argv.verbose, dryRun ? 1 : 0);
  const limit = argv.limit;

  const execUnlessDryRun = executeIf(!dryRun);
  const log = logger(verbose);

  log.vvv("Starting organize, argv: ", argv);

  const knownExistingFolders = new Set<string>();
  function ensureSubfolderExists(parentDirPath: string, subfolderName: string) {
    const subfolderPath = path.join(parentDirPath, subfolderName);
    if (knownExistingFolders.has(subfolderPath)) {
      return;
    }
    try {
      log.vvv(`Checking if target directory ${subfolderPath} exists`);
      fs.accessSync(subfolderPath, fs.constants.F_OK);
    } catch (e) {
      log.vv(`Creating target directory ${subfolderPath}`);
      execUnlessDryRun(() => {
        try {
          fs.mkdirSync(subfolderPath, { recursive: true });
        } catch (e) {
          ora(`Cannot create directory: ${ensureSubfolderExists}`).fail();
          throw e;
        }
      });
    } finally {
      knownExistingFolders.add(subfolderPath);
    }
  }

  try {
    log.vvv("Checking access to source directory...");
    fs.accessSync(srcPath, fs.constants.R_OK | fs.constants.X_OK);
    log.vvv(" => Access to source directory OK");
  } catch (e) {
    log.vvv(" => Access to source directory FAIL");
    ora(`Cannot open directory: ${srcPath}`).fail();
    throw e;
  }

  const spinner = ora("Collecting files").start();
  let files = walk(srcPath);
  spinner.succeed(`Collected ${files.length} files`);
  if (limit != null && files.length > limit) {
    log.v(`Limiting number of processed files to ${limit}`);
    files = R.take(limit, files);
  }

  const out = new FlexProgress.Output();
  const bar = new FlexProgress.Bar({ width: 25 });
  const filesCounter = new FlexProgress.Text();

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

  const fileExtension: (m: MediaFile) => string = R.pipe(R.prop("filename"), path.extname, normalizeExtension);
  let count = 0;
  filesCounter.text = count.toString();

  let loaders = files.map(async (file) => {
    await file.loadMetadata();
    bar.ratio = (count++ % files.length) / (files.length - 1);
    filesCounter.text = count.toString();

    const metadata = file.metadata!;
    const exifCreateDateTime = R.cond<Tags, ExifDateTime>([
      [R.propIs(ExifDateTime, "CreateDate"), R.prop("CreateDate") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "DateTimeOriginal"), R.prop("DateTimeOriginal") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "DateTimeCreated"), R.prop("DateTimeCreated") as (t: Tags) => ExifDateTime],
      [R.propIs(ExifDateTime, "FileModifyDate"), R.prop("FileModifyDate") as (t: Tags) => ExifDateTime],
    ])(metadata)!;
    const createDateTime = exifCreateDateTime.toDateTime().toUTC();
    let processed = false;
    const subfolderPath = createDateTime.toFormat(subfolderFormat === "year" ? "yyyy" : "yyyy/LL");
    ensureSubfolderExists(dstPath, subfolderPath);
    const formattedDate = createDateTime.toFormat("yyyy-LL-dd HH-mm-ss");
    let exclusiveSuffix = "";
    let retryCount = 0;
    const ext = fileExtension(file);
    let maybeFilename = `${formattedDate}${exclusiveSuffix}${ext}`;
    let fullDstFilepath = path.join(dstPath, subfolderPath, maybeFilename);
    while (!processed) {
      try {
        fs.accessSync(fullDstFilepath, fs.constants.F_OK);
        log.vvv(`File ${fullDstFilepath} already exists, try with bigger suffix`);
        exclusiveSuffix = ` (${++retryCount})`;
        maybeFilename = `${formattedDate}${exclusiveSuffix}${ext}`;
        fullDstFilepath = path.join(dstPath, subfolderPath, maybeFilename);
      } catch (e) {
        // doesn't exists, we can copy!
        log.v(`${operation} ${file.filepath} → ${fullDstFilepath}`);
        execUnlessDryRun(() => {
          switch (operation) {
            case "clone":
            case "copy": {
              execFileSync(`cp`, ["-c", file.filepath, fullDstFilepath]);
              break;
            }
            case "move": {
              fs.renameSync(file.filepath, fullDstFilepath);
              break;
            }
          }
        });
        processed = true;
      }
    }
  });
  await Promise.all(loaders);
  out.clear();
  ora(`Processed ${files.length} files`).succeed();
  process.exit(0);
};
