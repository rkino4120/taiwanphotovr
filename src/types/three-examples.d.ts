declare module 'three/examples/jsm/loaders/EXRLoader' {
  import { Loader } from 'three';
  import { DataTexture } from 'three';
  export class EXRLoader extends Loader {
    constructor();
    load(
      url: string,
      onLoad: (texture: DataTexture) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
  }
}
