// Code 39 barcode as inline SVG (digits and capital letters, which covers NITT0000009-style barcodes).
// Each pattern is 9 elements, bar/space alternating, n = narrow, w = wide.
const P = {
  0: "nnnwwnwnn", 1: "wnnwnnnnw", 2: "nnwwnnnnw", 3: "wnwwnnnnn", 4: "nnnwwnnnw", 5: "wnnwwnnnn", 6: "nnwwwnnnn", 7: "nnnwnnwnw", 8: "wnnwnnwnn", 9: "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "*": "nwnnwnwnn",
};

export default function Barcode({ value, height = 40 }) {
  const chars = `*${String(value).toUpperCase()}*`.split("").filter((c) => P[c]);
  const narrow = 1.4, wide = 3.4;
  let x = 0;
  const bars = [];
  chars.forEach((c) => {
    [...P[c]].forEach((w, i) => {
      const width = w === "w" ? wide : narrow;
      if (i % 2 === 0) bars.push(<rect key={bars.length} x={x} y={0} width={width} height={height} />);
      x += width;
    });
    x += narrow; // inter-character gap
  });
  return <svg viewBox={`0 0 ${x} ${height}`} width={Math.min(x, 220)} height={height} role="img" aria-label={`Barcode ${value}`} fill="#000">{bars}</svg>;
}
