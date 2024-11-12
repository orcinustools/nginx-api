// Dependencies replaced with Deno standard library
import { resolve, dirname } from "https://deno.land/std/path/mod.ts";
import { expandGlob } from "https://deno.land/std/fs/expand_glob.ts";

/**
 * Type definitions for parser options and data structures 
 */
interface ParserOptions {
  parseIncludes?: boolean;
  includesRoot?: string;
  ignoreIncludeErrors?: boolean;
}

type ConfigValue = string | object | Array<string | object>;
type ConfigObject = Record<string, ConfigValue>;

/**
 * Converts ! in back to .
 */
function unsafeKey(key: string): string {
  return key.replace(/(!)/g, '.');
}

/**
 * Converts all . in key to !. We need the dot for array access.
 */
function safeKey(key: string): string {
  return key.replace(/(\.)/g, '!');
}

class IncludeResolutionError extends ReferenceError {}

export class Parser {
  private fileName: string | null = null;
  private serverRoot: string | null = null;

  /**
   * To support including sub-configs, we need to get server root
   */
  private setFileName(fileName: string): void {
    this.fileName = fileName;
    // Get the server root only if not set
    if (this.serverRoot === null) {
      this.serverRoot = dirname(fileName);
    }
  }

  /**
   * Retrieves a value from within an object using a dot-notation path
   */
  private resolve(obj: ConfigObject, path: string): ConfigValue | undefined {
    return path.split('.').reduce((prev: any, curr: string) => {
      return (typeof prev === 'object' && prev) ? prev[unsafeKey(curr)] : undefined;
    }, obj);
  }

  /**
   * Sets a value within an object using a dot-notation path
   */
  private resolveSet(obj: ConfigObject, path: string, val: ConfigValue): boolean {
    const components = path.split('.');
    let current: any = obj;

    while (components.length > 0) {
      if (typeof current !== 'object') break;

      if (components.length === 1) {
        current[unsafeKey(components[0])] = val;
        return true;
      } else {
        const key = unsafeKey(components.shift()!);
        current = current[key];
      }
    }
    return false;
  }

  /**
   * Read and parse a file from the filesystem
   */
  async readConfigFile(fileName: string, options?: ParserOptions): Promise<ConfigObject> {
    this.setFileName(fileName);

    if (!options) {
      options = {
        parseIncludes: true
      };
    }

    try {
      const fileInfo = await Deno.stat(fileName);
      if (!fileInfo.isFile) {
        throw new ReferenceError('File does not exist');
      }

      const configString = await Deno.readTextFile(fileName);
      return this.parse(configString, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Write a config object to a file on the filesystem
   */
  async writeConfigFile(
    fileName: string, 
    data: ConfigObject | string, 
    overwrite = false
  ): Promise<boolean> {
    this.setFileName(fileName);

    try {
      const fileInfo = await Deno.stat(fileName);
      if (fileInfo.isFile && !overwrite) {
        throw new Error('File already exists, to overwrite, set `overwrite = true`');
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    const content = typeof data === 'object' ? this.toConf(data) : data;
    await Deno.writeTextFile(fileName, content);
    return true;
  }

  /**
   * Parse wrapper function which determines the input type
   */
  parse(mixed: ConfigObject | string | Uint8Array, options?: ParserOptions): ConfigObject {
    if (mixed instanceof Uint8Array) {
      mixed = new TextDecoder().decode(mixed);
    }
    if (typeof mixed === 'object') {
      return this.toConf(mixed);
    } else if (typeof mixed === 'string') {
      return this.toJSON(mixed, options);
    } else {
      throw new TypeError(`Expected an Object or String, but got "${typeof mixed}"`);
    }
  }

  /**
   * Converts a config string into a JS object
   */
  private toJSON(conf: string, options: ParserOptions = {}): ConfigObject {
    const lines = conf.replace('\t', '').split('\n');
    const json: ConfigObject = {};
    let parent = '';
    let chunkedLine: string | null = null;
    let innerLines: string[] = [];
    let countOfParentsThatAreArrays = 0;
    let isInLuaBlock = false;
    let luaBlockValue: string[] = [];

    lines.forEach(lineRaw => {
      lineRaw = lineRaw.trim();

      if (!lineRaw || lineRaw.startsWith('#')) return;
      lineRaw = lineRaw.split('#')[0].trim();

      innerLines = lineRaw
        .replace(/(\s+{)/g, '\n$1\n')
        .replace(/(;\s*)}/g, '$1\n}\n')
        .replace(/;\s*?$/g, ';\n')
        .split(/\n/);

      innerLines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (isInLuaBlock && !line.endsWith('}')) {
          luaBlockValue.push(line);
          return;
        }

        chunkedLine && (line = chunkedLine + ' ' + line);

        if (line.endsWith('{')) {
          chunkedLine = null;
          const key = safeKey(line.slice(0, line.length - 1).trim());
          if (key.endsWith('by_lua_block')) {
            isInLuaBlock = true;
          }

          if (parent) parent += '.' + key;
          else parent = key;

          if (this.appendValue(json, parent, {})) {
            parent += '.' + (this.resolve(json, parent) as any[]).length - 1;
            countOfParentsThatAreArrays += 1;
          }
        } else if (line.startsWith('include') && options.parseIncludes) {
          this.handleInclude(line, json, parent, options);
        } else if (line.endsWith(';')) {
          this.handlePropertyLine(line, json, parent);
          chunkedLine = null;
        } else if (line.endsWith('}')) {
          this.handleClosingBrace(json, parent, isInLuaBlock, luaBlockValue);
          chunkedLine = null;
          
          parent = parent.split('.');
          if (countOfParentsThatAreArrays > 0 && !isNaN(parseInt(parent[parent.length - 1], 10))) {
            parent.pop();
            countOfParentsThatAreArrays -= 1;
          }
          parent.pop();
          parent = parent.join('.');
          
          isInLuaBlock = false;
          luaBlockValue = [];
        } else {
          chunkedLine = line;
        }
      });
    });

    return json;
  }

  /**
   * Handle include directives in config
   */
  private async handleInclude(
    line: string, 
    json: ConfigObject, 
    parent: string, 
    options: ParserOptions
  ): Promise<void> {
    const findFiles = resolve(
      this.serverRoot || options.includesRoot || Deno.cwd(),
      line.replace('include ', '').replace(';', '').trim()
    );

    const files: string[] = [];
    for await (const file of expandGlob(findFiles)) {
      files.push(file.path);
    }

    for (const file of files) {
      const parser = new Parser();
      parser.serverRoot = this.serverRoot;
      const config = await parser.readConfigFile(file);

      for (const [key, val] of Object.entries(config)) {
        this.appendValue(json, key, val, parent);
      }
    }

    if (!files.length && !options.ignoreIncludeErrors) {
      throw new IncludeResolutionError(
        `Unable to resolve include statement: "${line}".\nSearched in ${
          this.serverRoot || options.includesRoot || Deno.cwd()
        }`
      );
    }
  }

  /**
   * Handle property lines in config
   */
  private handlePropertyLine(line: string, json: ConfigObject, parent: string): void {
    const parts = line.split(' ');
    let key = safeKey(parts[0]);
    let val = parts.slice(1).join(' ').trim();

    if (key.endsWith(';')) key = key.slice(0, key.length - 1);
    val = val.slice(0, val.length - 1);

    this.appendValue(json, key, val, parent);
  }

  /**
   * Handle closing braces in config
   */
  private handleClosingBrace(
    json: ConfigObject, 
    parent: string, 
    isInLuaBlock: boolean, 
    luaBlockValue: string[]
  ): void {
    if (isInLuaBlock) {
      this.appendValue(json, '_lua', luaBlockValue, parent);
    }
  }

  /**
   * Resolve setting value with merging existing value and converting it to array
   */
  private resolveAppendSet(json: ConfigObject, key: string, val: ConfigValue): boolean {
    let isInArray = false;
    const existingVal = this.resolve(json, key);
    
    if (existingVal !== undefined) {
      let mergedValues: ConfigValue[] = [];

      if (Array.isArray(existingVal)) {
        mergedValues = existingVal;
      } else if (existingVal !== undefined) {
        mergedValues.push(existingVal);
      }

      if (Array.isArray(val)) {
        mergedValues.push(...val);
      } else {
        mergedValues.push(val);
      }

      val = mergedValues;
      isInArray = true;
    }

    this.resolveSet(json, key, val);
    return isInArray;
  }

  /**
   * Appends given value into json with parent detection
   */
  private appendValue(
    json: ConfigObject, 
    key: string, 
    val: ConfigValue, 
    parent?: string
  ): boolean {
    if (parent) {
      return this.resolveAppendSet(json, parent + '.' + key, val);
    }
    return this.resolveAppendSet(json, key, val);
  }

  /**
   * Converts a JS object into a config string
   */
  toConf(json: ConfigObject): string {
    const recurse = (obj: ConfigObject, depth: number): string => {
      let retVal = '';
      let longestKeyLen = 1;
      const indent = '    '.repeat(depth);

      for (const key in obj) {
        longestKeyLen = Math.max(longestKeyLen, key.length);
      }

      for (const [key, val] of Object.entries(obj)) {
        const keyValSpacing = longestKeyLen - key.length + 4;
        const keyValIndent = ' '.repeat(keyValSpacing);

        if (Array.isArray(val)) {
          if (key === '_lua') {
            retVal += val.length > 0 ? indent : '';
            retVal += val.join('\n' + indent);
            retVal += '\n';
          } else {
            val.forEach(subVal => {
              let block = false;
              if (typeof subVal === 'object') {
                block = true;
                subVal = ' {\n' + recurse(subVal as ConfigObject, depth + 1) + indent + '}\n\n';
              }
              const spacing = block ? ' ' : keyValIndent;
              retVal += indent + (key + spacing + subVal).trim();
              block ? retVal += '\n' : retVal += ';\n';
            });
          }
        } else if (typeof val === 'object') {
          retVal += indent + key + ' {\n';
          retVal += recurse(val as ConfigObject, depth + 1);
          retVal += indent + '}\n\n';
        } else {
          retVal += indent + (key + keyValIndent + val).trim() + ';\n';
        }
      }

      return retVal;
    };

    return recurse(json, 0);
  }
}
