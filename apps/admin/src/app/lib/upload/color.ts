const NEUTRAL = "#ededea";

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** Average colour of the visible pixels in RGBA data, used as the placeholder behind an image while it loads. */
export function dominantColor(data: Uint8ClampedArray): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    count++;
  }
  return count === 0 ? NEUTRAL : `#${hex(r / count)}${hex(g / count)}${hex(b / count)}`;
}
