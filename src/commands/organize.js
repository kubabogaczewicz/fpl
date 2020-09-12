import FlexProgress from "@dinoabsoluto/flex-progress";
import { execFileSync } from "child_process";
import fs from "fs";
import ora from "ora";
import path from "path";
import R from "ramda";
import yargs from "yargs";
import { regexpTest } from "../utils.js";
import { walk } from "../walker.js";

export const command = "organize <srcDirectory> <targetDirectory";

export const describe = `Organizes all files from srcDirectory (recursively) into targetDirectory`;

export const builder = (yargs) => {
  yargs
    .option("yes", {
      alias: "y",
      type: "boolean",
      description: "Assume default answer to any possible question",
    })
    .option("createTarget", {
      type: "boolean",
      default: "false",
      description: "Create targetDirectory if it does not exist",
    });
};

const normalizeExtension = R.cond([
  [regexpTest(/\.jpe?g/i), R.always(".jpg")],
  [R.T, R.toLower],
]);

function ensureSubfolderExists(parentDirPath, subfolderName) {
  const subfolderPath = path.join(parentDirPath, subfolderName);
  try {
    fs.accessSync(subfolderPath, fs.constants.F_OK);
  } catch (e) {
    fs.mkdirSync(subfolderPath);
  }
}

export const handler = async (argv) => {
  console.log("verbose: ", argv.verbose);
  const srcPath = argv.srcDirectory;
  const dstPath = argv.targetDirectory;

  try {
    fs.accessSync(srcPath, fs.constants.R_OK | fs.constants.X_OK);
  } catch (e) {
    ora(`Cannot open directory: ${srcPath}`).fail();
    yargs.exit(1, e);
  }
  const spinner = ora("Collecting files").start();
  let files = await walk(srcPath);
  spinner.succeed(`Collected ${files.length} files`);

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

  const fileExtension = R.pipe(R.prop("filename"), path.extname, normalizeExtension);
  let count = 0;
  let loaders = files.map(async (file) => {
    await file.loadMetadata();
    bar.ratio = (count++ % files.length) / (files.length - 1);
    filesCounter.text = count.toString();

    const createDateTime = file.metadata.CreateDate?.toDateTime().toUTC();
    let processed = false;
    const year = createDateTime.toFormat("yyyy");
    ensureSubfolderExists(dstPath, year);
    const formattedDate = createDateTime.toFormat("yyyy-LL-dd HH-mm-ss");
    let exclusiveSuffix = "";
    let retryCount = 0;
    const ext = fileExtension(file);
    let maybeFilename = `${formattedDate}${exclusiveSuffix}${ext}`;
    let fullDstFilepath = path.join(dstPath, year, maybeFilename);
    while (!processed) {
      try {
        fs.accessSync(fullDstFilepath, fs.constants.F_OK);
        exclusiveSuffix = ` (${++retryCount})`;
        maybeFilename = `${formattedDate}${exclusiveSuffix}${ext}`;
        fullDstFilepath = path.join(dstPath, year, maybeFilename);
      } catch (e) {
        // doesn't exists, we can copy!
        execFileSync(`cp`, ["-c", file.filepath, fullDstFilepath]);
        processed = true;
      }
    }
  });
  await Promise.all(loaders);
  out.clear();
  ora(`Processed ${files.length} files`).succeed();
  yargs.exit(0, null);
};
