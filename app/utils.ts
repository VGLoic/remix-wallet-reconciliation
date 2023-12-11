export function shortHex(v: string) {
  return v.substring(0, 6) + "..." + v.substring(v.length - 4);
}
