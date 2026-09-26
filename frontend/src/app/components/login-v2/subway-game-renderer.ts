import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, Fog, Group,
  IcosahedronGeometry, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PerspectiveCamera, PlaneGeometry, PointLight, Points, PointsMaterial, Scene, SphereGeometry,
  TorusGeometry, Vector3, WebGLRenderer
} from 'three';
import type { LoginV2GameController } from './login-v2-game-renderer';

const COLORS = { ink: '#070913', rail: '#17213c', blue: '#0098ff', mint: '#b7ead1', gold: '#e9b96e', coral: '#ff8364', violet: '#8a7cff' };

function disposeObject(root: Object3D): void {
  root.traverse(child => {
    const item = child as Mesh & { geometry?: BufferGeometry; material?: Material | Material[] };
    item.geometry?.dispose();
    (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => material?.dispose());
  });
}

function createRunner(): Group {
  const runner = new Group();
  const body = new Mesh(new BoxGeometry(0.52, 0.78, 0.34), new MeshStandardMaterial({ color: COLORS.blue, emissive: COLORS.blue, emissiveIntensity: 0.28, roughness: 0.38 }));
  body.position.y = 0.78;
  runner.add(body);
  const head = new Mesh(new SphereGeometry(0.23, 12, 10), new MeshStandardMaterial({ color: '#d18e68', roughness: 0.72 }));
  head.position.y = 1.38;
  runner.add(head);
  const visor = new Mesh(new BoxGeometry(0.43, 0.12, 0.08), new MeshBasicMaterial({ color: COLORS.mint }));
  visor.position.set(0, 1.42, 0.18);
  runner.add(visor);
  const legGeometry = new BoxGeometry(0.14, 0.48, 0.16);
  for (const x of [-0.14, 0.14]) {
    const leg = new Mesh(legGeometry, new MeshStandardMaterial({ color: COLORS.violet, emissive: COLORS.violet, emissiveIntensity: 0.14, roughness: 0.62 }));
    leg.position.set(x, 0.24, 0);
    runner.add(leg);
  }
  const ring = new Mesh(new TorusGeometry(0.48, 0.025, 8, 24), new MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.75 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  runner.add(ring);
  return runner;
}

export function createSubwayGame(canvas: HTMLCanvasElement, onScore: (score: number) => void, onExit: () => void): LoginV2GameController {
  const fallback = () => {
    const controller = (() => {}) as LoginV2GameController;
    controller.playExit = onComplete => onComplete();
    return controller;
  };
  const parent = canvas.parentElement;
  if (!parent) return fallback();
  let renderer: WebGLRenderer;
  try {
    if (!canvas.getContext('webgl2', { alpha: false, antialias: true })) return fallback();
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch { return fallback(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(COLORS.ink);
  const scene = new Scene();
  scene.background = new Color(COLORS.ink);
  scene.fog = new Fog(COLORS.ink, 24, 100);
  const camera = new PerspectiveCamera(52, 1, 0.1, 120);
  camera.position.set(0, 5.2, -9);
  scene.add(new AmbientLight('#a6b7e0', 1.7));
  const light = new DirectionalLight('#edf4ff', 3.2);
  light.position.set(-8, 16, -4);
  scene.add(light);
  scene.add(new PointLight(COLORS.blue, 8, 32));

  const world = new Group();
  scene.add(world);
  const track = new Mesh(new BoxGeometry(9.5, 0.16, 120), new MeshStandardMaterial({ color: '#0d1427', roughness: 0.92, metalness: 0.08 }));
  track.position.set(0, -0.12, 36);
  world.add(track);
  const sideMaterial = new MeshStandardMaterial({ color: COLORS.rail, emissive: '#0b122c', emissiveIntensity: 0.3, roughness: 0.72 });
  for (const x of [-5.5, 5.5]) {
    const side = new Mesh(new BoxGeometry(1.2, 0.4, 120), sideMaterial);
    side.position.set(x, 0.08, 36);
    world.add(side);
  }
  const laneLine = new MeshBasicMaterial({ color: '#283f69', transparent: true, opacity: 0.8 });
  for (const x of [-1.1, 1.1]) {
    const line = new Mesh(new BoxGeometry(0.055, 0.025, 120), laneLine);
    line.position.set(x, 0.04, 36);
    world.add(line);
  }
  const archMaterial = new MeshStandardMaterial({ color: '#18233e', emissive: '#0a1430', emissiveIntensity: 0.36, roughness: 0.66 });
  for (let z = -12; z < 91; z += 12) {
    const left = new Mesh(new BoxGeometry(0.22, 6, 0.22), archMaterial);
    left.position.set(-5.15, 3, z);
    world.add(left);
    const right = left.clone();
    right.position.x = 5.15;
    world.add(right);
    const top = new Mesh(new BoxGeometry(10.5, 0.22, 0.22), archMaterial);
    top.position.set(0, 5.88, z);
    world.add(top);
  }

  const runner = createRunner();
  runner.position.set(0, 0.08, 0);
  world.add(runner);
  const lanePositions = [-2.2, 0, 2.2];
  let lane = 1;
  let laneTarget = 1;
  let jumpVelocity = 0;
  let score = 0;
  let distance = 0;
  let elapsed = 0;
  let frame = 0;
  let width = 0;
  let height = 0;
  let disposed = false;
  let contextLost = false;
  let lastTime = 0;
  let pointerLane = 1;
  let exitRequested = false;
  let exitStart = 0;
  let exitProgress = 0;
  let exitCallback: (() => void) | undefined;
  let exitTimer: number | undefined;
  const keys = new Set<string>();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const obstacles: { mesh: Mesh; lane: number; coin: boolean; z: number }[] = [];
  const obstacleGeometry = new BoxGeometry(1.35, 1.1, 0.9);
  const coinGeometry = new IcosahedronGeometry(0.26, 1);
  for (let index = 0; index < 13; index++) {
    const coin = index % 3 !== 1;
    const mesh = new Mesh(coin ? coinGeometry.clone() : obstacleGeometry.clone(), coin
      ? new MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.22 })
      : new MeshStandardMaterial({ color: COLORS.coral, emissive: COLORS.coral, emissiveIntensity: 0.42, roughness: 0.34 }));
    const objectLane = (index * 2 + 1) % 3;
    const z = 18 + index * 7.1;
    mesh.position.set(lanePositions[objectLane], coin ? 1.05 : 0.55, z);
    world.add(mesh);
    obstacles.push({ mesh, lane: objectLane, coin, z });
  }
  const particleGeometry = new BufferGeometry();
  const positions = new Float32Array(180 * 3);
  for (let index = 0; index < 180; index++) {
    positions[index * 3] = (Math.random() - 0.5) * 18;
    positions[index * 3 + 1] = 1 + Math.random() * 7;
    positions[index * 3 + 2] = Math.random() * 100 - 15;
  }
  particleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  world.add(new Points(particleGeometry, new PointsMaterial({ color: COLORS.mint, size: 0.035, transparent: true, opacity: 0.45 })));

  const resizeScene = (rect: DOMRectReadOnly | DOMRect) => {
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const draw = () => {
    renderer.render(scene, camera);
    canvas.dataset['ready'] = 'true';
    canvas.dataset['drawCalls'] = String(renderer.info.render.calls);
    canvas.dataset['obstacles'] = String(obstacles.length);
    canvas.dataset['lane'] = String(lane);
  };
  const resize = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect) resizeScene(rect); if (!frame && canRender()) resume(); });
  const canRender = () => !disposed && !contextLost && !document.hidden && width > 0 && height > 0;
  const completeExit = () => {
    const callback = exitCallback;
    if (!callback) return;
    exitCallback = undefined;
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    exitTimer = undefined;
    callback();
  };
  const tick = (now: number) => {
    frame = 0;
    if (!canRender()) return;
    const delta = Math.min((now - lastTime) / 1000 || 0, 0.05);
    lastTime = now;
    elapsed += delta;
    const shift = keys.has('a') || keys.has('arrowleft') ? -1 : keys.has('d') || keys.has('arrowright') ? 1 : 0;
    if (shift) laneTarget = Math.max(0, Math.min(2, laneTarget + shift));
    if (pointerLane !== lane) laneTarget = pointerLane;
    lane += (laneTarget - lane) * Math.min(1, delta * 10);
    runner.position.x = lanePositions[0] + lane * 2.2;
    const jumping = keys.has(' ') || keys.has('arrowup');
    if (jumping && runner.position.y <= 0.1 && jumpVelocity === 0) jumpVelocity = 7.4;
    jumpVelocity -= delta * 17;
    runner.position.y = Math.max(0.08, runner.position.y + jumpVelocity * delta);
    if (runner.position.y <= 0.08) jumpVelocity = 0;
    const speed = 11 + Math.min(8, elapsed * 0.06);
    distance += speed * delta;
    score = Math.max(score, Math.floor(distance));
    if (Math.floor(distance) % 10 === 0) onScore(score);
    runner.children.forEach((child, index) => { if (index > 1) child.rotation.x = Math.sin(elapsed * 12 + index) * 0.3; });
    for (const item of obstacles) {
      item.mesh.position.z -= speed * delta;
      item.mesh.rotation.y += delta * (item.coin ? 2.6 : 1.1);
      if (item.mesh.position.z < -7) {
        item.mesh.position.z = 78 + Math.random() * 12;
        item.lane = Math.floor(Math.random() * 3);
        item.mesh.position.x = lanePositions[item.lane];
      }
      const laneDistance = Math.abs(item.mesh.position.x - runner.position.x);
      if (item.mesh.position.z > -0.8 && item.mesh.position.z < 1.1 && laneDistance < 0.7 && Math.abs(runner.position.y - 0.08) < (item.coin ? 1.5 : 0.72)) {
        if (item.coin) { score += 20; onScore(score); item.mesh.position.z = 78; }
        else { score = Math.max(0, score - 18); onScore(score); item.mesh.position.z = 78; }
      }
    }
    camera.position.lerp(new Vector3(runner.position.x * 0.35, 5.1 + runner.position.y * 0.18, -9.5), 1 - Math.exp(-5 * delta));
    camera.lookAt(new Vector3(runner.position.x * 0.45, 0.9, 9));
    if (exitRequested) { exitProgress = Math.min(1, (performance.now() - exitStart) / 620); world.scale.setScalar(1 - exitProgress * 0.3); }
    draw();
    if (exitRequested && exitProgress >= 1) { completeExit(); return; }
    if (!reduced.matches || exitRequested) frame = requestAnimationFrame(tick);
  };
  function resume(): void { if (!canRender() || frame) return; if (reduced.matches) { draw(); return; } lastTime = performance.now(); frame = requestAnimationFrame(tick); }
  const pointer = (event: PointerEvent) => { if (coarse.matches) return; const rect = parent.getBoundingClientRect(); pointerLane = Math.max(0, Math.min(2, Math.round(((event.clientX - rect.left) / rect.width) * 2))); };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { onExit(); return; }
    const key = event.key.toLowerCase();
    if (['a', 'd', 'arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) { keys.add(key); event.preventDefault(); }
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const onVisibility = () => { if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; keys.clear(); } else resume(); };
  const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; if (frame) cancelAnimationFrame(frame); frame = 0; };
  const onContextRestored = () => { contextLost = false; resume(); };
  resize.observe(parent);
  parent.addEventListener('pointermove', pointer);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  onScore(0);
  const cleanup = (() => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    parent.removeEventListener('pointermove', pointer);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    disposeObject(scene);
    renderer.dispose();
  }) as LoginV2GameController;
  cleanup.playExit = onComplete => {
    if (disposed || reduced.matches) { onComplete(); return; }
    exitCallback = onComplete;
    exitRequested = true;
    exitStart = performance.now();
    exitProgress = 0;
    resume();
    exitTimer = window.setTimeout(completeExit, 920);
  };
  return cleanup;
}
