#!/usr/bin/env node

// @ts-check

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
  .option("limit", {
    type: "number",
    description: "Process at max n number of files. Useful for tests.",
  })
  .strict()
  .wrap(120)
  .parse();
