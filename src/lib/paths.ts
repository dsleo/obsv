const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function sitePath(path: string) {
  if (!path.startsWith("/")) return `${basePath}/${path}`;
  return `${basePath}${path}` || "/";
}
