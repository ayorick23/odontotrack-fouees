/**
 * Curva suave que pasa por cada punto sin inventar picos ni valles
 * (interpolación monótona de Fritsch-Carlson). `points` en orden de x.
 */
export function smoothPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n === 0) {
    return "";
  }
  if (n < 3) {
    return points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  }
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0];
    slope[i] = (points[i + 1][1] - points[i][1]) / (dx[i] || 1);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] =
      slope[i - 1] * slope[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) /
          ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
  }
  tangent[n - 1] = slope[n - 2];
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d += ` C${x0 + h} ${y0 + h * tangent[i]} ${x1 - h} ${y1 - h * tangent[i + 1]} ${x1} ${y1}`;
  }
  return d;
}
