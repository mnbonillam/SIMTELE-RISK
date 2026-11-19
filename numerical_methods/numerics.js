export const normInf = x => Math.max(...x.map(Math.abs));
const dot = (x, y) => x.reduce((sum, v, i) => sum + v * y[i], 0);
export const matvec = (A, x) => A.map(row => dot(row, x));
const sub = (x, y) => x.map((v, i) => v - y[i]);
export const residual = (A, b, x) => normInf(sub(b, matvec(A, x)));
export function errors(approximation, reference) {
  const abs = Array.isArray(reference) ? normInf(sub(approximation, reference)) : Math.abs(approximation - reference);
  const scale = Array.isArray(reference) ? normInf(reference) : Math.abs(reference);
  const rel = scale ? abs / scale : null;
  return {abs, rel, percent: rel === null ? null : rel * 100};
}

export function solveIterative(method, A, b, tolerance = 1e-10, max = 200, reference) {
  const threshold = tolerance * Math.max(1, normInf(b));
  let x = b.map(() => 0), r = [...b], direction = [...r];
  const rows = [];
  for (let k = 0; k <= max; k++) {
    const res = residual(A, b, x);
    rows.push({k, value: [...x], res, ...(reference && errors(x, reference))});
    if (res <= threshold || k === max) return {x, rows, threshold, converged: res <= threshold};
    if (method === 'CG') {
      const product = matvec(A, direction), denom = dot(direction, product);
      if (denom <= 0) return {x, rows, threshold, converged: false};
      const rr = dot(r, r), alpha = rr / denom;
      x = x.map((v, i) => v + alpha * direction[i]);
      r = r.map((v, i) => v - alpha * product[i]);
      const beta = dot(r, r) / rr;
      direction = r.map((v, i) => v + beta * direction[i]);
    } else {
      const next = [...x];
      for (let i = 0; i < b.length; i++) {
        const off = A[i].reduce((sum, v, j) => sum + (j === i ? 0 : v * (method === 'Jacobi' ? x[j] : next[j])), 0);
        next[i] = (b[i] - off) / A[i][i];
      }
      x = next;
    }
  }
}

export function lu(A, b) {
  const M = A.map(row => [...row]), rhs = [...b], n = b.length;
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
    if (M[pivot][k] === 0) throw new Error('Matriz singular');
    [M[k], M[pivot]] = [M[pivot], M[k]];
    [rhs[k], rhs[pivot]] = [rhs[pivot], rhs[k]];
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / M[k][k];
      M[i][k] = factor;
      for (let j = k + 1; j < n; j++) M[i][j] -= factor * M[k][j];
      rhs[i] -= factor * rhs[k];
    }
  }
  const x = b.map(() => 0);
  for (let i = n - 1; i >= 0; i--) {
    let value = rhs[i];
    for (let j = i + 1; j < n; j++) value -= M[i][j] * x[j];
    x[i] = value / M[i][i];
  }
  return x;
}

export function root(method, f, df, a, b, tolerance = 1e-10, reference, max = 100) {
  const rows = [];
  let fa = f(a), fb = f(b);
  if (method === 'Bisección' && fa * fb > 0) throw new Error('Intervalo sin cambio de signo');
  let x = Math.abs(fa) <= tolerance ? a : b;
  for (let k = 1; k <= max; k++) {
    if (Math.abs(f(x)) > tolerance) {
      if (method === 'Bisección') x = (a + b) / 2;
      else if (method === 'Secante') {
        if (fb === fa) break;
        x = b - fb * (b - a) / (fb - fa);
      } else {
        if (!df(x)) break;
        x -= f(x) / df(x);
      }
    }
    const fx = f(x);
    if (!Number.isFinite(fx)) break;
    rows.push({k, value: x, res: Math.abs(fx), ...errors(x, reference)});
    if (Math.abs(fx) <= tolerance) break;
    if (method === 'Bisección') {
      if (fa * fx <= 0) { b = x; fb = fx; } else { a = x; fa = fx; }
    } else if (method === 'Secante') {
      a = b; fa = fb; b = x; fb = fx;
    }
  }
  return {x, rows, converged: rows.at(-1)?.res <= tolerance};
}

export function rkStep(order, f, t, y, h) {
  const shift = (k, dt) => y.map((v, i) => v + dt * k[i]);
  const k1 = f(t, y);
  const k2 = f(t + h / 2, shift(k1, h / 2));
  if (order === 2) return shift(k2, h);
  const k3 = f(t + h / 2, shift(k2, h / 2));
  const k4 = f(t + h, shift(k3, h));
  return y.map((v, i) => v + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
}

export function integrateODE(order, f, initial, end, step) {
  if (!(step > 0)) throw new Error('El paso debe ser positivo');
  const samples = [{t: 0, y: initial}];
  for (let i = 1, t = 0, y = initial; t < end - 1e-12; i++) {
    const next = Math.min(end, i * step);
    y = rkStep(order, f, t, y, next - t);
    t = next;
    samples.push({t, y});
  }
  return samples;
}

export function lagrange(nodes) {
  const weights = nodes.map(([x], i) => 1 / nodes.reduce((p, [t], j) => i === j ? p : p * (x - t), 1));
  return x => {
    let top = 0, bottom = 0;
    for (let i = 0; i < nodes.length; i++) {
      const delta = x - nodes[i][0];
      if (!delta) return nodes[i][1];
      const term = weights[i] / delta;
      top += term * nodes[i][1];
      bottom += term;
    }
    return top / bottom;
  };
}

export function newtonInterpolation(nodes) {
  const coefficients = nodes.map(node => node[1]);
  for (let k = 1; k < nodes.length; k++) {
    for (let i = nodes.length - 1; i >= k; i--) coefficients[i] = (coefficients[i] - coefficients[i - 1]) / (nodes[i][0] - nodes[i - k][0]);
  }
  return x => coefficients.reduceRight((value, c, i) => i === nodes.length - 1 ? c : c + (x - nodes[i][0]) * value, 0);
}

export function spline(nodes) {
  const n = nodes.length, second = Array(n).fill(0), upper = Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const [x, y] = nodes[i], [a, ya] = nodes[i - 1], [b, yb] = nodes[i + 1];
    const left = x - a, right = b - x, d = 2 * (left + right) - left * upper[i - 1];
    upper[i] = right / d;
    second[i] = (6 * ((yb - y) / right - (y - ya) / left) - left * second[i - 1]) / d;
  }
  for (let i = n - 2; i > 0; i--) second[i] -= upper[i] * second[i + 1];
  return x => {
    let i = 0;
    while (i < n - 2 && x > nodes[i + 1][0]) i++;
    const [a, ya] = nodes[i], [b, yb] = nodes[i + 1], h = b - a;
    const u = (b - x) / h, v = (x - a) / h;
    return u * ya + v * yb + ((u ** 3 - u) * second[i] + (v ** 3 - v) * second[i + 1]) * h ** 2 / 6;
  };
}

export function quadrature(f, a, b, levels = 8) {
  const output = {'Trapecio': [], 'Simpson': [], 'Romberg': []};
  let previous = [];
  for (let k = 0; k < levels; k++) {
    const n = 2 ** k, h = (b - a) / n;
    let trap = h * (f(a) + f(b)) / 2, odd = 0, even = 0;
    for (let i = 1; i < n; i++) {
      const v = f(a + i * h);
      trap += h * v;
      if (i % 2) odd += v; else even += v;
    }
    const row = [trap];
    for (let j = 1; j <= k; j++) row.push(row[j - 1] + (row[j - 1] - previous[j - 1]) / (4 ** j - 1));
    output.Trapecio.push({k, n, value: trap});
    if (k > 0) output.Simpson.push({k, n, value: h * (f(a) + f(b) + 4 * odd + 2 * even) / 3});
    output.Romberg.push({k, n, value: row.at(-1), row});
    previous = row;
  }
  return output;
}
