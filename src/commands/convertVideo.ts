import { exiftool } from "exiftool-vendored";
import fs from "fs/promises";
import { globby } from "globby";
import logSymbols from "log-symbols";
import ora from "ora";
import yargs from "yargs";
import { $ } from "zx";
import { logger } from "../log.js";

$.verbose = false;

const command = "convertVideo <directory>";

const describe = `Looks for any video file in given directory and converts all videos to HEVC (LOSSLY!).`;

interface ConvertArguments {
  directory: string;
}
const handler = async (argv: yargs.Arguments<ConvertArguments>) => {
  const { directory } = argv;
  const log = logger(1);

  try {
    await fs.stat(directory);
  } catch (e) {
    throw `${logSymbols.error} Cannot open directory: ${directory}`;
  }

  const files = await globby(["**/*.mov", "**/*.mp4"], { cwd: directory, absolute: true });
  log(`${logSymbols.info} Found ${files.length} files to process`);
  const videoInfoMatcher =
    /Track [\d]+: Video.*Format: (?<format>[^,]+), Dimensions: (?<dx>[\d]+) x (?<dy>[\d]+), (?<fps>[\d\.]+) fps/m;
  for (const file of files) {
    const mediaInfo = await $`avmediaInfo ${file} --brief --mediatype video`;
    const videoInfoMatch = mediaInfo.stdout.match(videoInfoMatcher);
    if (!videoInfoMatch) {
      log(`${logSymbols.error} Cannot get media info about ${file}, avmediainfo output`, mediaInfo);
      continue;
    }
    const { format, dx, dy, fps } = videoInfoMatch.groups!;
    log.v(`${logSymbols.info} Media info about ${file}: ${format}, dim: ${dx} x ${dy} @ ${fps} fps`);
    if (format !== "HEVC") {
      const convertedFile = file + ".converted.mov";
      const convertFiles = ["-s", file, "-o", convertedFile];
      const convertSettings = ["-p", "PresetHEVCHighestQuality", "--disableMetadataFilter"];
      const spinner = ora({ text: `Converting file ${file}` }).start();
      await $`avconvert ${convertFiles} ${convertSettings}`;
      spinner.succeed(`File ${file} successfully converted`);

      // fix dates after avmediainfo because for some reason using --preserve-metadata preserves all except dates
      const origExif = await exiftool.read(file);
      const createDate = origExif.CreateDate;
      if (createDate) {
        const exifDatetime = typeof createDate === "string" ? createDate : createDate.toExifString();
        log.v(`${logSymbols.info} Writing date ${exifDatetime} metadata to converted file`);
        await exiftool.write(convertedFile, { AllDates: exifDatetime, CreationDate: exifDatetime });
      } else {
        log.v(
          `${logSymbols.warning} Cannot find valid date in ${file}, will not transfer datetime information to converted file`,
        );
      }
    }
  }
  log(`${logSymbols.success} Done`);
};

const convertCommand: yargs.CommandModule<{}, ConvertArguments> = {
  command,
  describe,
  handler,
};

export default convertCommand;
