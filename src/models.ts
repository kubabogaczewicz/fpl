import ef from "exiftool-vendored";
import path from "path";
import { regexpTest } from "./utils.js";

const exiftool = ef.exiftool;

export abstract class MediaFile {
  dirpath: string;
  filename: string;
  filepath: string;
  metadata?: ef.Tags;

  constructor(dirpath: string, filename: string) {
    this.dirpath = dirpath;
    this.filename = filename;
    this.filepath = path.join(dirpath, filename);
  }

  async loadMetadata() {
    this.metadata = await exiftool.read(this.filepath);
  }

  abstract isValid(): boolean;
}

export class ImageFile extends MediaFile {
  static match = regexpTest(/\.(jpe?g|heic)$/i);

  constructor(dirpath: string, filename: string) {
    super(dirpath, filename);
  }

  isValid() {
    return !!this.metadata?.GPSPosition;
  }
}

export class MovieFile extends MediaFile {
  static match = regexpTest(/\.(mov|mp4)$/i);

  constructor(dirpath: string, filename: string) {
    super(dirpath, filename);
  }

  isValid() {
    return true;
  }
}
