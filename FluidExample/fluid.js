// Fluid Interactive practice
// Stefan Cristache

// I mainly used Daniel Shiffman's Fluid Simulation code as a base and added Gyro controls to it. 
// The Gyro controls are used to change the direction of the fluid flow based on the device's orientation.

// References:
// Daniel Shiffman - Fluid Simulation
// https://thecodingtrain.com/CodingChallenges/132-fluid-simulation.html
// https://youtu.be/alhpH6ECFvQ

// Real-Time Fluid Dynamics for Games by Jos Stam
// http://www.dgp.toronto.edu/people/stam/reality/Research/pdf/GDC03.pdf
// Fluid Simulation for Dummies by Mike Ash
// https://mikeash.com/pyblog/fluid-simulation-for-dummies.html

// Base Code: 
// https://editor.p5js.org/codingtrain/sketches/9kVfB4BF2


// I would like to add that this was a practice project and currently I am not planning to do anything in particular with it. I just wanted to practice using the Gyro controls and fluid simulation.
// My interest was more on how to use the Gyro present in Phone devices mainly.

let fluid;
let t = 0;
const SCALE = 6;

class Fluid {
  constructor(width, height, dt = 0.2, diffusion = 0.0000001, viscosity = 0.0) {
    this.size = max(40, floor(min(width, height) / SCALE));
    this.N = this.size;
    this.dt = dt;
    this.diffusion = diffusion;
    this.viscosity = viscosity;
    this.iter = 3;

    const n = this.N + 2;
    const total = n * n;
    this.s = new Array(total).fill(0);
    this.density = new Array(total).fill(0);
    this.vx = new Array(total).fill(0);
    this.vy = new Array(total).fill(0);
    this.vx0 = new Array(total).fill(0);
    this.vy0 = new Array(total).fill(0);
  }

  step() {
    this.diffuse(1, this.vx0, this.vx, this.viscosity, this.dt);
    this.diffuse(2, this.vy0, this.vy, this.viscosity, this.dt);
    this.project(this.vx0, this.vy0, this.vx, this.vy);
    this.advect(1, this.vx, this.vx0, this.vx0, this.vy0, this.dt);
    this.advect(2, this.vy, this.vy0, this.vx0, this.vy0, this.dt);
    this.project(this.vx, this.vy, this.vx0, this.vy0);
    this.diffuse(0, this.s, this.density, this.diffusion, this.dt);
    this.advect(0, this.density, this.s, this.vx, this.vy, this.dt);
  }

  addDensity(x, y, amount) {
    const index = this.index(x, y);
    if (index >= 0 && index < this.density.length) {
      this.density[index] += amount;
    }
  }

  addVelocity(x, y, amountX, amountY) {
    const index = this.index(x, y);
    if (index >= 0 && index < this.vx.length) {
      this.vx[index] += amountX;
      this.vy[index] += amountY;
    }
  }

  renderD() {
    noStroke();
    for (let y = 1; y <= this.N; y++) {
      for (let x = 1; x <= this.N; x++) {
        const index = this.index(x, y);
        const d = this.density[index];
        if (d > 0.01) {
          const alpha = constrain(d * 0.06, 20, 180);
          fill(20, 80 + d * 0.08, 220, alpha);
          rect((x - 1) * SCALE, (y - 1) * SCALE, SCALE, SCALE);
        }
      }
    }
  }

  index(x, y) {
    if (x < 0 || x > this.N + 1 || y < 0 || y > this.N + 1) return -1;
    return x + y * (this.N + 2);
  }

  diffuse(b, x, x0, diff, dt) {
    const a = dt * diff * this.N * this.N;
    this.linSolve(b, x, x0, a, 1 + 6 * a);
  }

  linSolve(b, x, x0, a, c) {
    const cRecip = 1 / c;
    for (let k = 0; k < this.iter; k++) {
      for (let j = 1; j <= this.N; j++) {
        for (let i = 1; i <= this.N; i++) {
          const index = this.index(i, j);
          x[index] = (x0[index] + a * (x[this.index(i - 1, j)] + x[this.index(i + 1, j)] + x[this.index(i, j - 1)] + x[this.index(i, j + 1)])) * cRecip;
        }
      }
      this.setBounds(b, x);
    }
  }

  project(vx, vy, p, div) {
    for (let j = 1; j <= this.N; j++) {
      for (let i = 1; i <= this.N; i++) {
        const index = this.index(i, j);
        div[index] = -0.5 * (vx[this.index(i + 1, j)] - vx[this.index(i - 1, j)] + vy[this.index(i, j + 1)] - vy[this.index(i, j - 1)]) / this.N;
        p[index] = 0;
      }
    }

    this.setBounds(0, div);
    this.setBounds(0, p);
    this.linSolve(0, p, div, 1, 6);

    for (let j = 1; j <= this.N; j++) {
      for (let i = 1; i <= this.N; i++) {
        const index = this.index(i, j);
        vx[index] -= 0.5 * this.N * (p[this.index(i + 1, j)] - p[this.index(i - 1, j)]);
        vy[index] -= 0.5 * this.N * (p[this.index(i, j + 1)] - p[this.index(i, j - 1)]);
      }
    }

    this.setBounds(1, vx);
    this.setBounds(2, vy);
  }

  advect(b, d, d0, du, dv, dt) {
    const dt0 = dt * this.N;
    for (let j = 1; j <= this.N; j++) {
      for (let i = 1; i <= this.N; i++) {
        const index = this.index(i, j);
        let x = i - dt0 * du[index];
        let y = j - dt0 * dv[index];

        x = constrain(x, 0.5, this.N + 0.5);
        y = constrain(y, 0.5, this.N + 0.5);

        const i0 = floor(x);
        const i1 = i0 + 1;
        const j0 = floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1 - s1;
        const t1 = y - j0;
        const t0 = 1 - t1;

        const i0Index = this.index(i0, j0);
        const i1Index = this.index(i1, j0);
        const i2Index = this.index(i0, j1);
        const i3Index = this.index(i1, j1);

        d[index] = s0 * (t0 * d0[i0Index] + t1 * d0[i2Index]) + s1 * (t0 * d0[i1Index] + t1 * d0[i3Index]);
      }
    }
    this.setBounds(b, d);
  }

  setBounds(b, x) {
    for (let i = 1; i <= this.N; i++) {
      x[this.index(0, i)] = b === 1 ? -x[this.index(1, i)] : x[this.index(1, i)];
      x[this.index(this.N + 1, i)] = b === 1 ? -x[this.index(this.N, i)] : x[this.index(this.N, i)];
      x[this.index(i, 0)] = b === 2 ? -x[this.index(i, 1)] : x[this.index(i, 1)];
      x[this.index(i, this.N + 1)] = b === 2 ? -x[this.index(i, this.N)] : x[this.index(i, this.N)];
    }

    x[this.index(0, 0)] = 0.5 * (x[this.index(1, 0)] + x[this.index(0, 1)]);
    x[this.index(0, this.N + 1)] = 0.5 * (x[this.index(1, this.N + 1)] + x[this.index(0, this.N)]);
    x[this.index(this.N + 1, 0)] = 0.5 * (x[this.index(this.N, 0)] + x[this.index(this.N + 1, 1)]);
    x[this.index(this.N + 1, this.N + 1)] = 0.5 * (x[this.index(this.N, this.N + 1)] + x[this.index(this.N + 1, this.N)]);
  }
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  pixelDensity(1);
  frameRate(30);
  setupGyroControls();
  fluid = new Fluid(width, height);
  background(6, 10, 22);
}

function draw() {
  background(6, 10, 22, 30);

  const gx = map(gyroX, 0, width, -1, 1);
  const gy = map(gyroY, 0, height, -1, 1);
  const sourceX = constrain(int(width * 0.5 + gx * width * 0.25), 0, width - 1);
  const sourceY = constrain(int(height * 0.5 + gy * height * 0.25), 0, height - 1);

  const gridX = floor(sourceX / SCALE);
  const gridY = floor(sourceY / SCALE);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      fluid.addDensity(gridX + i, gridY + j, random(90, 160));
    }
  }

  fluid.addVelocity(gridX, gridY, gx * 0.5, gy * 0.5);
  fluid.step();
  fluid.renderD();

  t += 0.05;
}