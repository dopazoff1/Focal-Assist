import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight,
  EdgesGeometry, Float32BufferAttribute, Fog, Group, IcosahedronGeometry, LineBasicMaterial,
  LineSegments, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  PerspectiveCamera, PointLight, Points, PointsMaterial, Scene, SphereGeometry, TorusGeometry,
  Vector3, WebGLRenderer
} from 'three';

export type LoginV2GameController = (() => void) & {
  playExit: (onComplete: () => void) => void;
};

interface RectCollider { x: number; z: number; width: number; depth: number; }
interface TrafficCar { group: Group; axis: 'x' | 'z'; direction: 1 | -1; speed: number; }
interface Pedestrian { group: Group; target: Vector3; speed: number; phase: number; }
interface SignalPickup { group: Group; active: boolean; respawnAt: number; }

const COLORS = {
  ink: '#050e0c', asphalt: '#0a1714', asphaltLine: '#25483c', forest: '#12392e',
  sage: '#8ab6a0', mint: '#b7ead1', blue: '#0098ff', gold: '#e9b96e',
  coral: '#ff8364', violet: '#8a7cff', glass: '#0e2520'
};
const ROAD_COORDS = [-32, -16, 0, 16, 32];
const WORLD_LIMIT = 47;

function disposeObject(root: Object3D): void {
  root.traverse(child => {
    const renderable = child as Mesh & { material?: Material | Material[]; geometry?: BufferGeometry };
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach(item => item?.dispose());
  });
}

function createCar(bodyColor: string, player = false): Group {
  const car = new Group();
  const body = new Mesh(
    new BoxGeometry(1.55, 0.46, 2.75),
    new MeshStandardMaterial({ color: bodyColor, emissive: bodyColor, emissiveIntensity: player ? 0.34 : 0.12, metalness: 0.55, roughness: 0.28 })
  );
  body.position.y = 0.48;
  car.add(body);
  const cabin = new Mesh(
    new BoxGeometry(1.08, 0.42, 1.35),
    new MeshStandardMaterial({ color: COLORS.glass, emissive: COLORS.blue, emissiveIntensity: 0.18, metalness: 0.48, roughness: 0.2 })
  );
  cabin.position.set(0, 0.82, -0.14);
  car.add(cabin);

  const wheelGeometry = new CylinderGeometry(0.27, 0.27, 0.16, 12);
  const wheelMaterial = new MeshStandardMaterial({ color: '#07100e', metalness: 0.35, roughness: 0.65 });
  for (const x of [-0.78, 0.78]) for (const z of [-0.86, 0.86]) {
    const wheel = new Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.28, z);
    car.add(wheel);
  }
  const lampGeometry = new BoxGeometry(0.28, 0.12, 0.045);
  for (const x of [-0.43, 0.43]) {
    const headlight = new Mesh(lampGeometry, new MeshBasicMaterial({ color: COLORS.mint }));
    headlight.position.set(x, 0.52, 1.4);
    car.add(headlight);
    const taillight = new Mesh(lampGeometry, new MeshBasicMaterial({ color: COLORS.coral }));
    taillight.position.set(x, 0.52, -1.4);
    car.add(taillight);
  }
  if (player) {
    const ring = new Mesh(new TorusGeometry(0.72, 0.025, 8, 28), new MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.82 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    car.add(ring);
    const beacon = new Mesh(new BoxGeometry(0.22, 0.1, 0.22), new MeshBasicMaterial({ color: COLORS.gold }));
    beacon.position.y = 1.08;
    car.add(beacon);
  }
  return car;
}

function createPedestrian(index: number): Group {
  const person = new Group();
  const palette = [COLORS.mint, COLORS.gold, COLORS.coral, COLORS.blue, COLORS.violet];
  const shirtColor = palette[index % palette.length];
  const torso = new Mesh(new BoxGeometry(0.28, 0.52, 0.2), new MeshStandardMaterial({ color: shirtColor, emissive: shirtColor, emissiveIntensity: 0.16, roughness: 0.58 }));
  torso.position.y = 0.7;
  person.add(torso);
  const head = new Mesh(new SphereGeometry(0.14, 10, 8), new MeshStandardMaterial({ color: index % 3 === 0 ? '#d18e68' : '#8e5b4a', roughness: 0.75 }));
  head.position.y = 1.08;
  person.add(head);
  const legGeometry = new CylinderGeometry(0.045, 0.045, 0.42, 6);
  for (const x of [-0.08, 0.08]) {
    const leg = new Mesh(legGeometry, new MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.75 }));
    leg.position.set(x, 0.24, 0);
    person.add(leg);
  }
  return person;
}

export function createRetroCarsGame(canvas: HTMLCanvasElement, onScore: (score: number) => void, onExit: () => void): LoginV2GameController {
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
  scene.fog = new Fog(COLORS.ink, 42, 112);
  const camera = new PerspectiveCamera(48, 1, 0.1, 150);
  camera.position.set(0, 8.5, -10.5);
  scene.add(new AmbientLight('#9dbcae', 1.75));
  const keyLight = new DirectionalLight('#ecfff6', 3.2);
  keyLight.position.set(-12, 20, 10);
  scene.add(keyLight);
  const cityLight = new PointLight(COLORS.blue, 9, 26);
  scene.add(cityLight);
  const goldLight = new PointLight(COLORS.gold, 5, 18);
  goldLight.position.set(16, 3, 16);
  scene.add(goldLight);

  const city = new Group();
  scene.add(city);
  const colliders: RectCollider[] = [];
  const ground = new Mesh(new BoxGeometry(108, 0.18, 108), new MeshStandardMaterial({ color: '#07110f', roughness: 0.9, metalness: 0.1 }));
  ground.position.y = -0.16;
  city.add(ground);

  const roadMaterial = new MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.92, metalness: 0.08 });
  const curbMaterial = new MeshStandardMaterial({ color: '#18352c', emissive: '#0e241d', emissiveIntensity: 0.25, roughness: 0.78 });
  const stripeMaterial = new MeshBasicMaterial({ color: COLORS.asphaltLine, transparent: true, opacity: 0.72 });
  const roadGeometryX = new BoxGeometry(108, 0.05, 5.8);
  const roadGeometryZ = new BoxGeometry(5.8, 0.05, 108);
  const curbGeometryX = new BoxGeometry(108, 0.12, 0.16);
  const curbGeometryZ = new BoxGeometry(0.16, 0.12, 108);
  for (const road of ROAD_COORDS) {
    const horizontal = new Mesh(roadGeometryX, roadMaterial);
    horizontal.position.set(0, 0, road);
    city.add(horizontal);
    const vertical = new Mesh(roadGeometryZ, roadMaterial);
    vertical.position.set(road, 0.01, 0);
    city.add(vertical);
    for (const offset of [-2.94, 2.94]) {
      const hCurb = new Mesh(curbGeometryX, curbMaterial);
      hCurb.position.set(0, 0.06, road + offset);
      city.add(hCurb);
      const vCurb = new Mesh(curbGeometryZ, curbMaterial);
      vCurb.position.set(road + offset, 0.06, 0);
      city.add(vCurb);
    }
    for (let segment = -48; segment < 48; segment += 7) {
      const hStripe = new Mesh(new BoxGeometry(3.2, 0.012, 0.045), stripeMaterial);
      hStripe.position.set(segment, 0.035, road);
      city.add(hStripe);
      const vStripe = new Mesh(new BoxGeometry(0.045, 0.012, 3.2), stripeMaterial);
      vStripe.position.set(road, 0.04, segment);
      city.add(vStripe);
    }
  }

  const random = (() => {
    let seed = 8123;
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  })();
  const buildingMaterials = [
    new MeshStandardMaterial({ color: '#10251f', emissive: '#07140f', emissiveIntensity: 0.42, roughness: 0.72 }),
    new MeshStandardMaterial({ color: '#172b37', emissive: '#092337', emissiveIntensity: 0.35, roughness: 0.7 }),
    new MeshStandardMaterial({ color: '#2a2330', emissive: '#180f21', emissiveIntensity: 0.25, roughness: 0.76 }),
    new MeshStandardMaterial({ color: '#20352d', emissive: '#11271f', emissiveIntensity: 0.36, roughness: 0.75 })
  ];
  const windowMaterials = [
    new MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.8 }),
    new MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.78 }),
    new MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.66 })
  ];
  const spans = [-40, -24, -8, 8, 24, 40];
  for (let ix = 0; ix < spans.length; ix++) for (let iz = 0; iz < spans.length; iz++) {
    if (ix === 2 && iz === 2) continue;
    const width = 5.2 + random() * 4.6;
    const depth = 5.2 + random() * 4.6;
    const height = 2.6 + random() * 7.8;
    const x = spans[ix] + (random() - 0.5) * 4.5;
    const z = spans[iz] + (random() - 0.5) * 4.5;
    const building = new Mesh(new BoxGeometry(width, height, depth), buildingMaterials[(ix + iz) % buildingMaterials.length]);
    building.position.set(x, height / 2, z);
    city.add(building);
    const outline = new LineSegments(new EdgesGeometry(building.geometry), new LineBasicMaterial({ color: '#4b806b', transparent: true, opacity: 0.34 }));
    outline.position.copy(building.position);
    city.add(outline);
    colliders.push({ x, z, width, depth });
    const windowCount = Math.max(2, Math.floor(width / 1.5));
    const rows = Math.max(1, Math.floor(height / 1.7));
    for (let row = 0; row < rows; row++) for (let column = 0; column < windowCount; column++) {
      const windowMesh = new Mesh(new BoxGeometry(0.38, 0.22, 0.025), windowMaterials[(row + column + ix) % windowMaterials.length]);
      windowMesh.position.set(x - width / 2 + 0.75 + column * 1.35, 1.1 + row * 1.5, z + depth / 2 + 0.014);
      city.add(windowMesh);
    }
  }

  const hq = new Group();
  const hqBase = new Mesh(new BoxGeometry(3.8, 0.18, 3.8), new MeshStandardMaterial({ color: '#183b30', emissive: COLORS.forest, emissiveIntensity: 0.5, roughness: 0.5 }));
  hqBase.position.y = 0.09;
  hq.add(hqBase);
  const hqRing = new Mesh(new TorusGeometry(2.4, 0.045, 8, 40), new MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.72 }));
  hqRing.rotation.x = Math.PI / 2;
  hqRing.position.y = 0.2;
  hq.add(hqRing);
  const hqPole = new Mesh(new CylinderGeometry(0.08, 0.08, 4.6, 8), new MeshBasicMaterial({ color: COLORS.mint }));
  hqPole.position.y = 2.3;
  hq.add(hqPole);
  const hqBeacon = new Mesh(new IcosahedronGeometry(0.34, 1), new MeshBasicMaterial({ color: COLORS.blue }));
  hqBeacon.position.y = 4.8;
  hq.add(hqBeacon);
  city.add(hq);

  const player = createCar(COLORS.blue, true);
  player.position.set(0, 0.08, 7.3);
  city.add(player);
  const traffic: TrafficCar[] = [];
  const trafficColors = [COLORS.coral, COLORS.gold, COLORS.mint, COLORS.violet, '#d95f9d', '#56c7bd'];
  for (let index = 0; index < 12; index++) {
    const axis = index % 2 === 0 ? 'x' : 'z';
    const direction: 1 | -1 = index % 4 < 2 ? 1 : -1;
    const road = ROAD_COORDS[(index * 3) % ROAD_COORDS.length];
    const lane = index % 2 === 0 ? (index % 4 < 2 ? -1.2 : 1.2) : (index % 4 < 2 ? 1.2 : -1.2);
    const car = createCar(trafficColors[index % trafficColors.length]);
    if (axis === 'x') {
      car.position.set(-44 + index * 7.1, 0.08, road + lane);
      car.rotation.y = direction === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.position.set(road + lane, 0.08, -44 + index * 7.1);
      car.rotation.y = direction === 1 ? 0 : Math.PI;
    }
    city.add(car);
    traffic.push({ group: car, axis, direction, speed: 3.8 + (index % 4) * 0.7 });
  }

  const pedestrians: Pedestrian[] = [];
  const choosePedestrianTarget = (): Vector3 => {
    const road = ROAD_COORDS[Math.floor(random() * ROAD_COORDS.length)];
    if (random() > 0.5) return new Vector3((random() - 0.5) * 88, 0.08, road + (random() > 0.5 ? 3.55 : -3.55));
    return new Vector3(road + (random() > 0.5 ? 3.55 : -3.55), 0.08, (random() - 0.5) * 88);
  };
  for (let index = 0; index < 22; index++) {
    const person = createPedestrian(index);
    const target = choosePedestrianTarget();
    person.position.copy(target).multiplyScalar(0.74);
    person.position.y = 0.08;
    person.rotation.y = random() * Math.PI * 2;
    city.add(person);
    pedestrians.push({ group: person, target, speed: 0.65 + random() * 0.45, phase: random() * Math.PI * 2 });
  }

  const pickupGeometry = new IcosahedronGeometry(0.32, 1);
  const pickupMaterial = new MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.35, metalness: 0.54, roughness: 0.2 });
  const pickupRingGeometry = new TorusGeometry(0.52, 0.025, 8, 24);
  const pickups: SignalPickup[] = [];
  [[-16, -16], [16, -16], [-16, 16], [16, 16], [32, 0], [-32, 0], [0, -32], [0, 32]].forEach(([x, z]) => {
    const signal = new Group();
    const core = new Mesh(pickupGeometry, pickupMaterial);
    const ring = new Mesh(pickupRingGeometry, new MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.82 }));
    ring.rotation.x = Math.PI / 2;
    signal.add(core, ring);
    signal.position.set(x, 0.85, z);
    city.add(signal);
    pickups.push({ group: signal, active: true, respawnAt: 0 });
  });

  const particleCount = 560;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index++) {
    const offset = index * 3;
    particlePositions[offset] = (random() - 0.5) * 105;
    particlePositions[offset + 1] = 0.5 + random() * 9;
    particlePositions[offset + 2] = (random() - 0.5) * 105;
  }
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute('position', new Float32BufferAttribute(particlePositions, 3));
  city.add(new Points(particleGeometry, new PointsMaterial({ color: COLORS.sage, size: 0.04, transparent: true, opacity: 0.42 })));

  let playerHeading = Math.PI;
  let playerSpeed = 0;
  let score = 0;
  let elapsed = 0;
  let frame = 0;
  let width = 0;
  let height = 0;
  let disposed = false;
  let contextLost = false;
  let lastTime = 0;
  let pointerSteer = 0;
  let pointerCamera = 0;
  let exitRequested = false;
  let exitStart = 0;
  let exitCallback: (() => void) | undefined;
  let exitTimer: number | undefined;
  let exitProgress = 0;
  const keys = new Set<string>();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const canRender = () => !disposed && !contextLost && !document.hidden && width > 0 && height > 0;

  const resolveBuildingCollision = () => {
    for (const collider of colliders) {
      const dx = player.position.x - collider.x;
      const dz = player.position.z - collider.z;
      const overlapX = collider.width / 2 + 0.76 - Math.abs(dx);
      const overlapZ = collider.depth / 2 + 0.76 - Math.abs(dz);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      if (overlapX < overlapZ) player.position.x += dx < 0 ? -overlapX : overlapX;
      else player.position.z += dz < 0 ? -overlapZ : overlapZ;
      playerSpeed *= 0.18;
    }
  };
  const draw = () => {
    renderer.render(scene, camera);
    canvas.dataset['ready'] = 'true';
    canvas.dataset['drawCalls'] = String(renderer.info.render.calls);
    canvas.dataset['traffic'] = String(traffic.length);
    canvas.dataset['pedestrians'] = String(pedestrians.length);
    canvas.dataset['pickups'] = String(pickups.length);
    canvas.dataset['playerX'] = player.position.x.toFixed(2);
    canvas.dataset['playerZ'] = player.position.z.toFixed(2);
  };
  const resizeScene = (rect: DOMRectReadOnly | DOMRect) => {
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resize = new ResizeObserver(entries => {
    const rect = entries[0]?.contentRect;
    if (rect) resizeScene(rect);
    if (!frame && canRender()) resume();
  });

  const updatePlayer = (delta: number) => {
    const forward = keys.has('w') || keys.has('arrowup');
    const reverse = keys.has('s') || keys.has('arrowdown');
    const keyboardSteer = (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    const steering = keyboardSteer || pointerSteer;
    if (forward) playerSpeed = Math.min(13, playerSpeed + delta * 10.5);
    else if (reverse) playerSpeed = Math.max(-5.2, playerSpeed - delta * 8);
    else playerSpeed *= Math.pow(0.22, delta);
    if (keys.has(' ')) playerSpeed *= Math.pow(0.035, delta);
    playerHeading += steering * (0.52 + Math.min(Math.abs(playerSpeed) * 0.075, 0.82)) * delta * (playerSpeed < -0.1 ? -1 : 1);
    player.position.addScaledVector(new Vector3(Math.sin(playerHeading), 0, Math.cos(playerHeading)), playerSpeed * delta);
    player.position.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, player.position.x));
    player.position.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, player.position.z));
    resolveBuildingCollision();
    player.rotation.y = playerHeading;
    player.position.y = 0.08 + Math.sin(elapsed * 9) * Math.min(0.025, Math.abs(playerSpeed) * 0.003);
  };
  const updateTraffic = (delta: number) => {
    for (const car of traffic) {
      if (car.axis === 'x') {
        car.group.position.x += car.direction * car.speed * delta;
        if (car.group.position.x > 50) car.group.position.x = -50;
        if (car.group.position.x < -50) car.group.position.x = 50;
      } else {
        car.group.position.z += car.direction * car.speed * delta;
        if (car.group.position.z > 50) car.group.position.z = -50;
        if (car.group.position.z < -50) car.group.position.z = 50;
      }
    }
  };
  const updatePedestrians = (delta: number) => {
    for (const pedestrian of pedestrians) {
      if (pedestrian.group.position.distanceTo(pedestrian.target) < 0.22) pedestrian.target.copy(choosePedestrianTarget());
      const movement = pedestrian.target.clone().sub(pedestrian.group.position).setY(0).normalize();
      pedestrian.group.position.addScaledVector(movement, pedestrian.speed * delta);
      pedestrian.group.rotation.y = Math.atan2(movement.x, movement.z);
      pedestrian.group.position.y = 0.08 + Math.abs(Math.sin(elapsed * 7 + pedestrian.phase)) * 0.035;
      pedestrian.group.children.forEach((child, childIndex) => {
        if (childIndex > 1) child.rotation.x = Math.sin(elapsed * 7 + pedestrian.phase + childIndex) * 0.22;
      });
    }
  };
  const updatePickups = () => {
    for (const pickup of pickups) {
      if (!pickup.active) {
        if (elapsed < pickup.respawnAt) continue;
        pickup.active = true;
        pickup.group.visible = true;
      }
      pickup.group.rotation.y += 0.018;
      pickup.group.rotation.z = Math.sin(elapsed * 2.2) * 0.18;
      pickup.group.position.y = 0.82 + Math.sin(elapsed * 3.2 + pickup.group.position.x) * 0.16;
      if (pickup.group.position.distanceTo(player.position) < 1.65) {
        pickup.active = false;
        pickup.respawnAt = elapsed + 2.8;
        pickup.group.visible = false;
        score += 25;
        onScore(score);
        player.scale.setScalar(1.14);
      }
    }
  };
  const updateCamera = (delta: number) => {
    const followAngle = playerHeading + Math.PI + pointerCamera * 0.42;
    const desiredPosition = new Vector3(player.position.x + Math.sin(followAngle) * 11.5, player.position.y + 8.4, player.position.z + Math.cos(followAngle) * 11.5);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-4.8 * delta));
    const lookAt = new Vector3(player.position.x, player.position.y + 0.65, player.position.z);
    const currentLookAt = camera.userData['focalLookAt'] instanceof Vector3 ? camera.userData['focalLookAt'] as Vector3 : lookAt.clone();
    camera.userData['focalLookAt'] = currentLookAt;
    currentLookAt.lerp(lookAt, 1 - Math.exp(-7 * delta));
    camera.lookAt(currentLookAt);
  };
  const completeExit = () => {
    const callback = exitCallback;
    if (!callback) return;
    exitCallback = undefined;
    exitRequested = false;
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
    updatePlayer(delta);
    updateTraffic(delta);
    updatePedestrians(delta);
    updatePickups();
    updateCamera(delta);
    cityLight.position.set(player.position.x, 5, player.position.z);
    hqRing.rotation.z -= delta * 0.6;
    hqBeacon.rotation.y += delta * 1.4;
    player.scale.x += (1 - player.scale.x) * Math.min(1, delta * 7);
    player.scale.y += (1 - player.scale.y) * Math.min(1, delta * 7);
    player.scale.z += (1 - player.scale.z) * Math.min(1, delta * 7);
    if (exitRequested) {
      exitProgress = Math.min(1, (performance.now() - exitStart) / 620);
      city.scale.setScalar(1 - exitProgress * 0.32);
      city.rotation.y = exitProgress * 0.16;
    }
    draw();
    if (exitRequested && exitProgress >= 1) { completeExit(); return; }
    if (!reduced.matches || exitRequested) frame = requestAnimationFrame(tick);
  };
  function resume(): void {
    if (!canRender() || frame) return;
    if (reduced.matches) { draw(); return; }
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  const pointer = (event: PointerEvent) => {
    if (coarse.matches) return;
    const rect = parent.getBoundingClientRect();
    const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerSteer = Math.max(-1, Math.min(1, normalizedX * 0.72));
    pointerCamera = Math.max(-1, Math.min(1, normalizedX));
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { onExit(); return; }
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      keys.add(key);
      event.preventDefault();
    }
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const onVisibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      keys.clear();
    } else resume();
  };
  const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; if (frame) cancelAnimationFrame(frame); frame = 0; };
  const onContextRestored = () => { contextLost = false; resume(); };
  const playExit = (onComplete: () => void) => {
    if (disposed || reduced.matches) { onComplete(); return; }
    exitCallback = onComplete;
    exitRequested = true;
    exitStart = performance.now();
    exitProgress = 0;
    resume();
    exitTimer = window.setTimeout(completeExit, 920);
  };

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
    frame = 0;
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
  cleanup.playExit = playExit;
  return cleanup;
}
