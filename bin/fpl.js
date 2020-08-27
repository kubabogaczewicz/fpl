#!/usr/bin/env node

import yargs from "yargs";
import * as organize from "../src/commands/organize.js";
import * as validate from "../src/commands/validate.js";

yargs
  .command(validate)
  .command(organize)
  .demandCommand()
  .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Run with verbose logging",
  })
  .parse();
