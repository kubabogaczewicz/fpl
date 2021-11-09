#!/usr/bin/env node

import ef from "exiftool-vendored";
import yargs from "yargs";
import organize from "./commands/organize.js";
import validate from "./commands/validate.js";

const exiftool = ef.exiftool;

await yargs(process.argv.slice(2))
  .command(validate)
  .command(organize)
  .demandCommand(1, "You must provide a command to use that tool")
  .completion("completion", false)
  .strict()
  .wrap(120)
  .parse();

exiftool.end();
