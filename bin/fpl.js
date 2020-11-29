#!/usr/bin/env node

import yargs from "yargs";
import * as organize from "../dist/commands/organize.js";
import * as validate from "../dist/commands/validate.js";

yargs(process.argv.slice(2))
  .command(validate)
  .command(organize)
  .demandCommand(1, "You must provide a command to use that tool")
  .option("verbose", {
    alias: "v",
    type: "count",
    description: "Run with verbose logging",
  })
  .parse();
