declare module "dotenv" {
  export function config(options?: {
    path?: string;
    encoding?: string;
    debug?: boolean;
    override?: boolean;
  }): {
    error?: Error;
    parsed?: { [key: string]: string };
  };

  export function parse(
    src: string | Buffer,
    options?: {
      debug?: boolean;
    }
  ): { [key: string]: string };
}
