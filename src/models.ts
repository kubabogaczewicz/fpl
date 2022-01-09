import ef from "exiftool-vendored";
import { regexpTest } from "./utils.js";

const exiftool = ef.exiftool;

export abstract class MediaFile {
  metadata?: ef.Tags;

  constructor(public filepath: string) {}

  async loadMetadata() {
    this.metadata = await exiftool.read(this.filepath);
  }

  abstract isValid(): boolean;
}

export class ImageFile extends MediaFile {
  static match = regexpTest(/\.(jpe?g|heic|arw|dng)$/i);

  constructor(filepath: string) {
    super(filepath);
  }

  isValid() {
    return !!this.metadata?.GPSPosition;
  }
}

export class MovieFile extends MediaFile {
  static match = regexpTest(/\.(mov|mp4)$/i);

  constructor(filepath: string) {
    super(filepath);
  }

  isValid() {
    return true;
  }
}
