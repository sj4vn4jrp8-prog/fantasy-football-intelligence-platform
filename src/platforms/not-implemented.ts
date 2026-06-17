export function throwAdapterNotImplemented(platformName: string): never {
  throw new Error(`${platformName} platform adapter is not implemented yet.`);
}
