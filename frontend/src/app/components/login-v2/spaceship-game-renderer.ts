import {
  AdditiveBlending, AmbientLight, BoxGeometry, BufferGeometry, Color, DirectionalLight,
  Float32BufferAttribute, Fog, Group, IcosahedronGeometry, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene, SphereGeometry,
  TorusGeometry, Vector3, WebGLRenderer
} from 'three';
import type { LoginV2GameController } from './login-v2-game-renderer';

const COLORS = { ink: '#030914', blue: '#0098ff', mint: '#b7ead1', gold: '#e9b96e', coral: '#ff8364', violet: '#8a7cff' };

function disposeObject(root: Object3D): void {
  root.traverse(child => {
    const item = child as Mesh & { geometry?: BufferGeometry; material?: Material | Material[] };
    item.geometry?.dispose();
    (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => material?.dispose());
  });
}

function createShip(): Group {
  const ship = new Group();
  const hull = new Mesh(new IcosahedronGeometry(0.58, 1), new MeshStandardMaterial({ color: COLORS.blue, emissive: COLORS.blue, emissiveIntensity: 1.05, metalness: 0.68, roughness: 0.24 }));
  hull.scale.set(0.7, 0.42, 1.5);
  ship.add(hull);
  const wing = new Mesh(new BoxGeometry(1.65, 0.08, 0.35), new MeshStandardMaterial({ color: COLORS.violet, emissive: COLORS.violet, emissiveIntensity: 0.45, metalness: 0.48, roughness: 0.34 }));
  wing.position.z = -0.12;
  ship.add(wing);
  const cockpit = new Mesh(new SphereGeometry(0.22, 12, 8), new MeshBasicMaterial({ color: COLORS.mint }));
  cockpit.position.set(0, 0.2, 0.38);
  ship.add(cockpit);
  const ring = new Mesh(new TorusGeometry(0.82, 0.026, 8, 28), new MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.72, blending: AdditiveBlending }));
  ring.rotation.x = Math.PI / 2;
  ship.add(ring);
  return ship;
}

export function createSpaceshipGame(canvas: HTMLCanvasElement, onScore: (score: number) => void, onExit: () => void): LoginV2GameController {
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
  scene.fog = new Fog(COLORS.ink, 18, 95);
  const camera = new PerspectiveCamera(55, 1, 0.1, 130);
  camera.position.set(0, 2.8, 8.5);
  scene.add(new AmbientLight('#a8c1f4', 1.35));
  const sun = new DirectionalLight('#ecf4ff', 3.3);
  sun.position.set(-6, 9, 8);
  scene.add(sun);
  const playerLight = new PointLight(COLORS.blue, 12, 20);
  scene.add(playerLight);
  const world = new Group();
  scene.add(world);
  const planet = new Mesh(new SphereGeometry(3.6, 24, 18), new MeshStandardMaterial({ color: '#162d4b', emissive: '#071d37', emissiveIntensity: 0.7, roughness: 0.76, metalness: 0.12 }));
  planet.position.set(-12, -4, -27);
  world.add(planet);
  const planetRing = new Mesh(new TorusGeometry(5.4, 0.04, 8, 64), new MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.64, blending: AdditiveBlending }));
  planetRing.rotation.set(0.4, 0.2, -0.32);
  planetRing.position.copy(planet.position);
  world.add(planetRing);
  const starPositions = new Float32Array(680 * 3);
  for (let index = 0; index < 680; index++) {
    starPositions[index * 3] = (Math.random() - 0.5) * 80;
    starPositions[index * 3 + 1] = (Math.random() - 0.5) * 42;
    starPositions[index * 3 + 2] = -Math.random() * 100;
  }
  const starsGeometry = new BufferGeometry();
  starsGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  world.add(new Points(starsGeometry, new PointsMaterial({ color: COLORS.mint, size: 0.045, transparent: true, opacity: 0.72 })));

  const ship = createShip();
  ship.position.set(0, 0, 1.4);
  world.add(ship);
  type SpaceObject = { mesh: Mesh; kind: 'signal' | 'asteroid'; x: number; y: number; z: number };
  const objects: SpaceObject[] = [];
  const lanes = [-3.1, -1.55, 0, 1.55, 3.1];
  for (let index = 0; index < 18; index++) {
    const signal = index % 4 !== 0;
    const mesh = new Mesh(signal ? new IcosahedronGeometry(0.3, 1) : new IcosahedronGeometry(0.58, 0), signal
      ? new MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.4, metalness: 0.5, roughness: 0.2 })
      : new MeshStandardMaterial({ color: COLORS.coral, emissive: COLORS.coral, emissiveIntensity: 0.55, roughness: 0.44 }));
    const x = lanes[index % lanes.length];
    const y = ((index * 3) % 5 - 2) * 0.95;
    const z = -12 - index * 5.2;
    mesh.position.set(x, y, z);
    world.add(mesh);
    objects.push({ mesh, kind: signal ? 'signal' : 'asteroid', x, y, z });
  }

  let score = 0;
  let elapsed = 0;
  let frame = 0;
  let width = 0;
  let height = 0;
  let disposed = false;
  let contextLost = false;
  let lastTime = 0;
  let targetX = 0;
  let targetY = 0;
  let exitRequested = false;
  let exitStart = 0;
  let exitProgress = 0;
  let exitCallback: (() => void) | undefined;
  let exitTimer: number | undefined;
  const keys = new Set<string>();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const canRender = () => !disposed && !contextLost && !document.hidden && width > 0 && height > 0;
  const resizeScene = (rect: DOMRectReadOnly | DOMRect) => { width = Math.max(1, rect.width); height = Math.max(1, rect.height); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const draw = () => { renderer.render(scene, camera); canvas.dataset['ready'] = 'true'; canvas.dataset['drawCalls'] = String(renderer.info.render.calls); canvas.dataset['signals'] = String(objects.length); };
  const resize = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect) resizeScene(rect); if (!frame && canRender()) resume(); });
  const completeExit = () => { const callback = exitCallback; if (!callback) return; exitCallback = undefined; if (exitTimer !== undefined) window.clearTimeout(exitTimer); exitTimer = undefined; callback(); };
  const tick = (now: number) => {
    frame = 0;
    if (!canRender()) return;
    const delta = Math.min((now - lastTime) / 1000 || 0, 0.05);
    lastTime = now;
    elapsed += delta;
    const horizontal = (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    const vertical = (keys.has('w') || keys.has('arrowup') ? 1 : 0) + (keys.has('s') || keys.has('arrowdown') ? -1 : 0);
    targetX = Math.max(-3.7, Math.min(3.7, targetX + horizontal * delta * 4.6));
    targetY = Math.max(-2.5, Math.min(2.5, targetY + vertical * delta * 4.2));
    ship.position.x += (targetX - ship.position.x) * Math.min(1, delta * 8);
    ship.position.y += (targetY - ship.position.y) * Math.min(1, delta * 8);
    ship.rotation.z += ((targetX - ship.position.x) * -0.12 - ship.rotation.z) * Math.min(1, delta * 8);
    ship.rotation.x = Math.sin(elapsed * 3.4) * 0.08;
    playerLight.position.set(ship.position.x, ship.position.y, ship.position.z + 2);
    for (const object of objects) {
      object.mesh.position.z += delta * (8.8 + Math.min(4, elapsed * 0.025));
      object.mesh.rotation.x += delta * 1.2;
      object.mesh.rotation.y += delta * 1.6;
      if (object.mesh.position.z > 6) object.mesh.position.z = -98 - Math.random() * 22;
      if (Math.abs(object.mesh.position.z - ship.position.z) < 0.72 && Math.abs(object.mesh.position.x - ship.position.x) < 0.85 && Math.abs(object.mesh.position.y - ship.position.y) < 0.85) {
        score = Math.max(0, score + (object.kind === 'signal' ? 20 : -16));
        onScore(score);
        object.mesh.position.z = -100 - Math.random() * 18;
      }
    }
    planet.rotation.y += delta * 0.05;
    planetRing.rotation.z += delta * 0.12;
    camera.position.lerp(new Vector3(ship.position.x * 0.22, 2.7 + ship.position.y * 0.2, 8.5), 1 - Math.exp(-4.5 * delta));
    camera.lookAt(new Vector3(ship.position.x * 0.3, ship.position.y * 0.25, -5));
    if (exitRequested) { exitProgress = Math.min(1, (performance.now() - exitStart) / 620); world.scale.setScalar(1 - exitProgress * 0.3); }
    draw();
    if (exitRequested && exitProgress >= 1) { completeExit(); return; }
    if (!reduced.matches || exitRequested) frame = requestAnimationFrame(tick);
  };
  function resume(): void { if (!canRender() || frame) return; if (reduced.matches) { draw(); return; } lastTime = performance.now(); frame = requestAnimationFrame(tick); }
  const pointer = (event: PointerEvent) => { if (coarse.matches) return; const rect = parent.getBoundingClientRect(); targetX = Math.max(-3.7, Math.min(3.7, ((event.clientX - rect.left) / rect.width - 0.5) * 7.4)); targetY = Math.max(-2.5, Math.min(2.5, (0.5 - (event.clientY - rect.top) / rect.height) * 5)); };
  const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { onExit(); return; } const key = event.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { keys.add(key); event.preventDefault(); } };
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
  cleanup.playExit = onComplete => { if (disposed || reduced.matches) { onComplete(); return; } exitCallback = onComplete; exitRequested = true; exitStart = performance.now(); exitProgress = 0; resume(); exitTimer = window.setTimeout(completeExit, 920); };
  return cleanup;
}
