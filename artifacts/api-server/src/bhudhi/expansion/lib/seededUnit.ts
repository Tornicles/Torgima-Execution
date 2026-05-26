export function seededUnit(seed: string, salt = ""): number {
  let h = 0;
  const s = `${seed}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 10000) / 10000;
}
