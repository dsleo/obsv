import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
const privateAddress = (a) =>
  /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(a) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(a);
export async function fetchText(
  url,
  { maxBytes = 5_000_000, timeout = 30_000, headers = {}, ...options } = {},
) {
  let current = new URL(url);
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!["https:", "http:"].includes(current.protocol) || current.username || current.password)
      throw new Error("Unsupported source URL");
    const addresses = isIP(current.hostname)
      ? [{ address: current.hostname }]
      : await lookup(current.hostname, { all: true });
    if (!addresses.length || addresses.some((x) => privateAddress(x.address)))
      throw new Error("Private source addresses are not allowed");
    const response = await fetch(current, {
      ...options,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      const next = new URL(response.headers.get("location"), current);
      // Credentials belong only to the requested origin.
      if (
        next.origin !== current.origin &&
        Object.keys(headers).some((k) => /authorization|api.key/i.test(k))
      )
        throw new Error("Authenticated source redirected to another origin");
      await response.body?.cancel();
      current = next;
      continue;
    }
    if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > maxBytes) {
      await response.body?.cancel();
      throw new Error("Source response too large");
    }
    const reader = response.body?.getReader();
    if (!reader) return "";
    let size = 0;
    const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new Error("Source response too large");
        chunks.push(value);
      }
    } catch (e) {
      await reader.cancel();
      throw e;
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many source redirects");
}
export async function fetchJson(url, options) {
  return JSON.parse(await fetchText(url, options));
}
