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

export const handler = (argv) => {};
