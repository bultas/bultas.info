const N_DESKTOP = 260;
const N_MOBILE = 140;
const MAX_MORTALS_DESKTOP = 120;
const MAX_MORTALS_MOBILE = 60;
const MOBILE_BREAKPOINT = 700;

const K = 5;
const PALETTE = ['#e8e8e8', '#a8d8ff', '#ffd6a5', '#caffbf', '#ffadad'];

const LIFESPAN = 360;
const ALPHA_BUCKETS = 24;

const NET_RADIUS = 95;
const AURA_RADIUS = 130;
const HIT_RADIUS = 28;

const DAMPING = 0.94;
const BOUNCE = 0.72;
const PADDING = 2;
const CENTROID_PULL = 0.0008;
const AURA_PUSH = 0.35;
const NOISE = 0.5;
const CENTROID_BLEND = 0.14;
const CENTROID_INERTIA = 0.86;
const CENTROID_INTERVAL = 18;

const TRAIL_FILL = 'rgba(10,10,10,0.14)';
const NET_MAX_ALPHA = 0.22;
const AURA_MAX_ALPHA = 0.40;
const FLASH_MAX_ALPHA = 0.70;

const FLASH_DECAY = 0.035;
const FLASH_RADIUS = 44;
const FLASH_LINE_WIDTH = 1.4;

const PUSH_FORCE = 140;
const PUSH_CAP = 10;

const isMobile = () => innerWidth < MOBILE_BREAKPOINT;

const cnv = document.getElementById('c');
const ctx = cnv.getContext('2d');

let W = 0;
let H = 0;
let DPR = 1;

const resize = () => {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = cnv.width = innerWidth * DPR;
  H = cnv.height = innerHeight * DPR;
};
resize();
addEventListener('resize', resize);

const N = isMobile() ? N_MOBILE : N_DESKTOP;
const MAX_MORTALS = isMobile() ? MAX_MORTALS_MOBILE : MAX_MORTALS_DESKTOP;

const buildStrokeBuckets = (maxAlpha) => {
  const out = new Array(ALPHA_BUCKETS);
  for (let i = 0; i < ALPHA_BUCKETS; i++) {
    const t = (i + 1) / ALPHA_BUCKETS;
    out[i] = `rgba(232,232,232,${t * maxAlpha})`;
  }
  return out;
};

const NET_STROKE = buildStrokeBuckets(NET_MAX_ALPHA);
const AURA_STROKE = buildStrokeBuckets(AURA_MAX_ALPHA);
const FLASH_STROKE = buildStrokeBuckets(FLASH_MAX_ALPHA);

const netBuckets = Array.from({ length: ALPHA_BUCKETS }, () => []);
const auraBuckets = Array.from({ length: ALPHA_BUCKETS }, () => []);

const bucketIndex = (t) => (t >= 1 ? ALPHA_BUCKETS - 1 : (t * ALPHA_BUCKETS) | 0);

const createParticle = (x, y, vx, vy, c, life) => ({
  x, y, vx, vy, c, aura: 0, life,
});

const particles = Array.from({ length: N }, () =>
  createParticle(Math.random() * W, Math.random() * H, 0, 0, 0, null),
);

let mortalCount = 0;

let centroids = [];
const seedCentroids = () => {
  centroids = Array.from({ length: K }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
  }));
};
seedCentroids();

const flashes = [];

let hover = false;
let mx = 0;
let my = 0;

cnv.addEventListener('pointermove', (e) => {
  hover = true;
  mx = e.clientX * DPR;
  my = e.clientY * DPR;
});
cnv.addEventListener('pointerleave', () => {
  hover = false;
});

const decayMortals = () => {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.life === null) continue;
    p.life -= 1 / LIFESPAN;
    if (p.life <= 0) {
      particles.splice(i, 1);
      mortalCount--;
    }
  }
};

const assignClusters = () => {
  for (const p of particles) {
    let best = 0;
    let bestDist = Infinity;
    for (let k = 0; k < K; k++) {
      const dx = p.x - centroids[k].x;
      const dy = p.y - centroids[k].y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    p.c = best;
  }
};

const updateCentroids = () => {
  const sums = Array.from({ length: K }, () => ({ x: 0, y: 0, n: 0 }));
  for (const p of particles) {
    sums[p.c].x += p.x;
    sums[p.c].y += p.y;
    sums[p.c].n++;
  }
  for (let k = 0; k < K; k++) {
    if (sums[k].n === 0) continue;
    centroids[k].x = centroids[k].x * CENTROID_INERTIA + (sums[k].x / sums[k].n) * CENTROID_BLEND;
    centroids[k].y = centroids[k].y * CENTROID_INERTIA + (sums[k].y / sums[k].n) * CENTROID_BLEND;
  }
};

const integrate = () => {
  const auraR = AURA_RADIUS * DPR;
  const auraR2 = auraR * auraR;
  const pad = PADDING * DPR;
  const noiseAmp = NOISE * DPR;
  const xMax = W - pad;
  const yMax = H - pad;

  for (const p of particles) {
    const c = centroids[p.c];
    p.vx = p.vx * DAMPING + (c.x - p.x) * CENTROID_PULL;
    p.vy = p.vy * DAMPING + (c.y - p.y) * CENTROID_PULL;

    if (hover) {
      const mdx = p.x - mx;
      const mdy = p.y - my;
      const md2 = mdx * mdx + mdy * mdy;
      p.aura = md2 < auraR2 ? 1 - md2 / auraR2 : 0;
      if (p.aura > 0) {
        const md = Math.sqrt(md2) + 0.001;
        p.vx += (mdx / md) * p.aura * AURA_PUSH;
        p.vy += (mdy / md) * p.aura * AURA_PUSH;
      }
    } else {
      p.aura = 0;
    }

    p.x += p.vx + (Math.random() - 0.5) * noiseAmp;
    p.y += p.vy + (Math.random() - 0.5) * noiseAmp;

    if (p.x < pad) {
      p.x = pad;
      p.vx = -p.vx * BOUNCE;
    } else if (p.x > xMax) {
      p.x = xMax;
      p.vx = -p.vx * BOUNCE;
    }
    if (p.y < pad) {
      p.y = pad;
      p.vy = -p.vy * BOUNCE;
    } else if (p.y > yMax) {
      p.y = yMax;
      p.vy = -p.vy * BOUNCE;
    }
  }
};

const drawTrail = () => {
  ctx.fillStyle = TRAIL_FILL;
  ctx.fillRect(0, 0, W, H);
};

const drawBuckets = (buckets, palette) => {
  for (let b = 0; b < ALPHA_BUCKETS; b++) {
    const arr = buckets[b];
    if (arr.length === 0) continue;
    ctx.strokeStyle = palette[b];
    ctx.beginPath();
    for (let k = 0; k < arr.length; k += 4) {
      ctx.moveTo(arr[k], arr[k + 1]);
      ctx.lineTo(arr[k + 2], arr[k + 3]);
    }
    ctx.stroke();
    arr.length = 0;
  }
};

const drawNetwork = () => {
  ctx.lineWidth = 1;
  const R = NET_RADIUS * DPR;
  const R2 = R * R;
  const len = particles.length;
  for (let i = 0; i < len; i++) {
    const pi = particles[i];
    for (let j = i + 1; j < len; j++) {
      const pj = particles[j];
      if (pi.c !== pj.c) continue;
      const dx = pi.x - pj.x;
      const dy = pi.y - pj.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R2) continue;
      netBuckets[bucketIndex(1 - d2 / R2)].push(pi.x, pi.y, pj.x, pj.y);
    }
  }
  drawBuckets(netBuckets, NET_STROKE);
};

const drawAuraField = () => {
  if (!hover) return;
  for (const p of particles) {
    if (p.aura <= 0.05) continue;
    auraBuckets[bucketIndex(p.aura)].push(mx, my, p.x, p.y);
  }
  drawBuckets(auraBuckets, AURA_STROKE);
};

const drawParticles = () => {
  for (const p of particles) {
    const lifeAlpha = p.life === null ? 1 : p.life;
    ctx.fillStyle = PALETTE[p.c % PALETTE.length];
    ctx.globalAlpha = (0.75 + p.aura * 0.25) * lifeAlpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (1.5 + p.aura * 2.2) * DPR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const drawFlashes = () => {
  if (flashes.length === 0) return;
  ctx.lineWidth = FLASH_LINE_WIDTH;
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.life -= FLASH_DECAY;
    if (f.life <= 0) {
      flashes.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = FLASH_STROKE[bucketIndex(f.life)];
    ctx.beginPath();
    ctx.arc(f.x, f.y, (1 - f.life) * FLASH_RADIUS * DPR, 0, Math.PI * 2);
    ctx.stroke();
  }
};

let frame = 0;
const tick = () => {
  decayMortals();
  assignClusters();
  if (frame % CENTROID_INTERVAL === 0) updateCentroids();
  integrate();
  drawTrail();
  drawNetwork();
  drawAuraField();
  drawParticles();
  drawFlashes();
  frame++;
  requestAnimationFrame(tick);
};
tick();

const evictOldestMortal = () => {
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].life !== null) {
      particles.splice(i, 1);
      mortalCount--;
      return;
    }
  }
};

const explode = (px, py, pc, hitIndex, parentMortal) => {
  flashes.push({ x: px, y: py, life: 1 });

  if (parentMortal) {
    particles.splice(hitIndex, 1);
    mortalCount--;
  }

  const children = 5;
  for (let k = 0; k < children; k++) {
    if (mortalCount >= MAX_MORTALS) evictOldestMortal();
    const angle = (k / children) * Math.PI * 2 + Math.random() * 0.6;
    const speed = (3 + Math.random() * 4) * DPR;
    particles.push(
      createParticle(px, py, Math.cos(angle) * speed, Math.sin(angle) * speed, pc, 1),
    );
    mortalCount++;
  }
};

const reseed = (cx, cy) => {
  seedCentroids();
  for (const p of particles) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy) + 0.001;
    const f = Math.min((PUSH_FORCE * DPR) / d, PUSH_CAP);
    p.vx += (dx / d) * f;
    p.vy += (dy / d) * f;
  }
};

cnv.addEventListener('pointerdown', (e) => {
  const cx = e.clientX * DPR;
  const cy = e.clientY * DPR;
  const hitR = HIT_RADIUS * DPR;
  const hitR2 = hitR * hitR;

  let hit = -1;
  let bestDist = hitR2;
  for (let i = 0; i < particles.length; i++) {
    const dx = particles[i].x - cx;
    const dy = particles[i].y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      hit = i;
    }
  }

  if (hit >= 0) {
    const parent = particles[hit];
    explode(parent.x, parent.y, parent.c, hit, parent.life !== null);
  } else {
    reseed(cx, cy);
  }
});
