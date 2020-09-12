import ef from "exiftool-vendored";
import path from "path";
import { notEmpty, regexpTest } from "./utils.js";

const exiftool = ef.exiftool;

class MediaFile {
  constructor(dirpath, filename) {
    this.dirpath = dirpath;
    this.filename = filename;
    this.filepath = path.join(dirpath, filename);
  }

  async loadMetadata() {
    this.metadata = await exiftool.read(this.filepath);
  }
}

export class ImageFile extends MediaFile {
  static match = regexpTest(/\.(jpe?g|heic)$/i);

  constructor(dirpath, filename) {
    super(dirpath, filename);
  }

  isValid() {
    return true;
  }
}

export class MovieFile extends MediaFile {
  static match = regexpTest(/\.(mov|mp4)$/i);

  constructor(dirpath, filename) {
    super(dirpath, filename);
  }

  isValid() {
    return notEmpty(this.metadata?.GPSPosition);
  }
}
