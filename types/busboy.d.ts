declare module "busboy" {
  import { Readable, Writable } from "stream"

  interface BusboyConfig {
    headers: Record<string, string>
    limits?: {
      fileSize?: number
      files?: number
    }
  }

  interface FileInfo {
    filename: string
    encoding: string
    mimeType: string
  }

  interface Busboy extends Writable {
    on(event: "file", callback: (fieldname: string, file: Readable, info: FileInfo) => void): this
    on(event: "finish", callback: () => void): this
    on(event: "error", callback: (err: Error) => void): this
    on(event: string, callback: (...args: unknown[]) => void): this
  }

  function busboy(config: BusboyConfig): Busboy

  export = busboy
}
