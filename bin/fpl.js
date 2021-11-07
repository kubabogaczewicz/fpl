#!/usr/bin/env node

// @ts-check

import yargs from "yargs";
import * as organize from "../dist/commands/organize.js";
import * as validate from "../dist/commands/validate.js";

yargs(process.argv.slice(2))
  .command(validate)
  .command(organize)
  .demandCommand(1, "You must provide a command to use that tool")
  .completion("completion")
  .strict()
  .wrap(120)
  .parse();
