// M-18: this is everything a `detect` rule can ask of the machine, and it is deliberately small. There is no method that runs a
// command or reads a file, so no adapter of this port can run component code, whatever a manifest says.

/**
 * What the installer may look at to propose a variable value: one environment variable, and whether one folder exists.
 *
 * Both answers are only proposals (A-10): nothing found here is stored, rendered or used until V runs `set`.
 */
export interface DetectProbe {
  /**
   * Reads one environment variable of the installer's own process.
   *
   * @param name - the variable name (checked: letters, digits, underscore, not credential-like)
   * @returns its value, or `undefined` when it is not set
   */
  environmentValue(name: string): string | undefined;

  /**
   * Tells whether a folder exists, following links (a link to a folder counts), reading nothing inside it.
   *
   * @param absolutePath - an absolute path below the user's home
   * @returns true only when the path is a folder; false for anything else, including every error
   */
  directoryExists(absolutePath: string): Promise<boolean>;
}
