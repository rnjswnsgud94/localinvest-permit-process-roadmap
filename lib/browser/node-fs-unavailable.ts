function browserOnlyError(): never {
  throw new Error("Node filesystem access is unavailable in the browser build.");
}

export function createWriteStream(): never {
  return browserOnlyError();
}

export async function readFile(): Promise<never> {
  return browserOnlyError();
}

export async function writeFile(): Promise<never> {
  return browserOnlyError();
}
