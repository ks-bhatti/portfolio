// All visual tuning lives here. Distances use scene units; speeds use seconds.
export const SCENE_CONFIG = {
  colors: {
    light: { accent: '#176b59', mint: '#d6e8ca', ink: '#142b26', paper: '#f7f8f2', border: '#dce5d9' },
    dark: { accent: '#8bbfa9', mint: '#315e51', ink: '#e6eee5', paper: '#162d27', border: '#466155' },
  },
  speed: { bob: 0.72, rotation: 0.12, orbit: 0.075, light: 0.35, easing: 5.5 },
  intensity: { tilt: 0.105, bob: 0.042, depth: 0.012, camera: 0.08, scroll: 0.19, reflection: 0.075 },
  card: { width: 3.12, height: 3.72, corner: 0.15 },
  particles: 34,
  maxPixelRatio: 2,
  photo: new URL('../profile.webp', import.meta.url).href,
  photoFallback: new URL('../profile.jpg', import.meta.url).href,
};

const host = document.querySelector('#hero-scene');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  status: 'waiting', visible: false, reducedMotion: reducedMotion.matches,
  running: false, orientationEnabled: false, frames: 0,
};
// A small, read-only-in-practice status surface for browser QA.
window.portfolioScene = state;

if (host) start();

function start() {
  const pointer = { x: 0, y: 0 };
  const orientation = { x: 0, y: 0 };
  let sceneAPI;
  let initializing = false;
  let pageActive = true;

  function publish(status, reason = '') {
    state.status = status;
    state.reason = reason;
    host.dataset.sceneState = status;
  }

  async function initialize() {
    if (initializing || sceneAPI || state.reducedMotion || !state.visible) return;
    initializing = true;
    publish('loading');
    try {
      const THREE = await import('../vendor/three.module.min.js');
      if (state.reducedMotion) { initializing = false; publish('static'); return; }
      sceneAPI = await buildScene(THREE, host, pointer, orientation, publish);
      updatePlayback();
    } catch (error) {
      publish('fallback', error instanceof Error ? error.message : 'WebGL is unavailable.');
      host.classList.remove('scene-ready');
    }
  }

  function updatePlayback() {
    const active = state.visible && !document.hidden && pageActive && !state.reducedMotion;
    if (sceneAPI) sceneAPI.setActive(active);
    else if (active && state.status !== 'fallback') initialize();
  }

  host.addEventListener('pointermove', event => {
    if (state.reducedMotion || event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (state.status === 'fallback') {
      const photo = host.querySelector('.portrait-fallback');
      if (photo) photo.style.transform = `translateX(-50%) perspective(900px) rotate(-5deg) rotateY(${pointer.x * 2}deg) rotateX(${-pointer.y * 2}deg)`;
    }
  }, { passive: true });
  host.addEventListener('pointerleave', () => {
    pointer.x = 0; pointer.y = 0;
    const photo = host.querySelector('.portrait-fallback');
    if (photo) photo.style.transform = '';
  });
  document.addEventListener('visibilitychange', updatePlayback);
  window.addEventListener('pagehide', () => { pageActive = false; updatePlayback(); });
  window.addEventListener('pageshow', () => { pageActive = true; updatePlayback(); });
  reducedMotion.addEventListener('change', event => {
    state.reducedMotion = event.matches;
    if (event.matches) {
      host.classList.remove('scene-ready');
      publish('static');
      const photo = host.querySelector('.portrait-fallback');
      if (photo) photo.style.transform = '';
    }
    updatePlayback();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      state.visible = entries[0].isIntersecting;
      updatePlayback();
    }, { threshold: 0.01 });
    observer.observe(host);
  } else {
    state.visible = true;
    updatePlayback();
  }

  if (state.reducedMotion) publish('static');
  const motionButton = document.querySelector('#motion-toggle');
  if (motionButton) {
    const supported = 'DeviceOrientationEvent' in window;
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    let baseline;
    const onOrientation = event => {
      if (event.beta === null || event.gamma === null) return;
      baseline ??= event.beta;
      orientation.x = Math.max(-1, Math.min(1, event.gamma / 25));
      orientation.y = Math.max(-1, Math.min(1, (event.beta - baseline) / 25));
    };
    function disableOrientation() {
      window.removeEventListener('deviceorientation', onOrientation);
      state.orientationEnabled = false;
      orientation.x = 0; orientation.y = 0;
      motionButton.setAttribute('aria-pressed', 'false');
      motionButton.textContent = 'Enable motion';
    }
    function updateMotionButton() {
      motionButton.hidden = !supported || !coarsePointer.matches || state.reducedMotion;
      if (motionButton.hidden && state.orientationEnabled) disableOrientation();
    }
    updateMotionButton();
    motionButton.addEventListener('click', async () => {
      if (!supported || !coarsePointer.matches || state.reducedMotion) return;
      if (state.orientationEnabled) {
        disableOrientation();
        return;
      }
      try {
        if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
          const permission = await window.DeviceOrientationEvent.requestPermission();
          if (permission !== 'granted') { motionButton.textContent = 'Motion permission denied'; return; }
        }
        baseline = undefined;
        window.addEventListener('deviceorientation', onOrientation, { passive: true });
        state.orientationEnabled = true;
        motionButton.setAttribute('aria-pressed', 'true');
        motionButton.textContent = 'Disable motion';
      } catch {
        motionButton.textContent = 'Motion unavailable';
      }
    });
    reducedMotion.addEventListener('change', updateMotionButton);
    coarsePointer.addEventListener('change', updateMotionButton);
  }
}

async function buildScene(THREE, host, pointer, orientation, publish) {
  const config = SCENE_CONFIG;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.maxPixelRatio));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'hero-webgl';
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', display: 'none' });
  canvas.hidden = true;
  host.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  let cameraDistance = 8;
  let contextAvailable = true;
  let animationFrame = 0;
  let previousTime = 0;
  let elapsed = 0;
  let active = false;
  let scrollProgress = 0;
  const smooth = { x: 0, y: 0 };
  let palette = getPalette();

  function getPalette() {
    return config.colors[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
  }

  // The supplied square photo is cropped with object-fit: cover, never stretched.
  let photo;
  const textureLoader = new THREE.TextureLoader();
  try { photo = await textureLoader.loadAsync(config.photo); }
  catch {
    try { photo = await textureLoader.loadAsync(config.photoFallback); }
    catch (error) { renderer.dispose(); canvas.remove(); throw error; }
  }
  photo.colorSpace = THREE.SRGBColorSpace;
  photo.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const portrait = new THREE.Group();
  portrait.position.y = 0.04;
  scene.add(portrait);
  const { width, height, corner } = config.card;
  const plane = new THREE.PlaneGeometry(width, height);
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
    uniform sampler2D photo;
    uniform vec2 cardSize;
    uniform float radius;
    uniform float foreground;
    uniform float time;
    uniform float reflection;
    uniform vec2 lightPosition;
    varying vec2 vUv;

    float ellipse(vec2 point, vec2 center, vec2 scale) {
      return 1.0 - smoothstep(0.94, 1.06, length((point - center) / scale));
    }
    void main() {
      vec2 edge = abs((vUv - 0.5) * cardSize) - cardSize * 0.5 + radius;
      float distanceToEdge = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - radius;
      float alpha = 1.0 - smoothstep(-0.009, 0.001, distanceToEdge);
      vec2 photoUv = vec2((vUv.x - 0.5) * cardSize.x / cardSize.y + 0.5, vUv.y);
      if (foreground > 0.5) {
        // A soft analytic silhouette creates modest depth without a large mask asset.
        float head = ellipse(photoUv, vec2(0.50, 0.813), vec2(0.128, 0.184));
        float neck = ellipse(photoUv, vec2(0.505, 0.651), vec2(0.083, 0.104));
        float torsoWidth = mix(0.398, 0.198, smoothstep(0.0, 0.66, photoUv.y));
        float torso = (1.0 - smoothstep(torsoWidth - 0.008, torsoWidth + 0.008, abs(photoUv.x - 0.5)))
          * (1.0 - smoothstep(0.626, 0.661, photoUv.y));
        float leftArm = ellipse(photoUv, vec2(0.189, 0.25), vec2(0.13, 0.31));
        float rightArm = ellipse(photoUv, vec2(0.824, 0.25), vec2(0.12, 0.31));
        alpha *= max(max(head, neck), max(torso, max(leftArm, rightArm)));
      }
      vec3 color = texture2D(photo, photoUv).rgb;
      float light = 0.985 + 0.035 * (1.0 - min(1.0, distance(vUv, lightPosition)));
      float glass = pow(max(0.0, 1.0 - abs(vUv.x + vUv.y * 0.44 - (0.30 + 0.23 * sin(time)))), 22.0);
      color = color * light + vec3(glass * reflection);
      gl_FragColor = vec4(color, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
  const photoMaterial = new THREE.ShaderMaterial({
    uniforms: {
      photo: { value: photo }, cardSize: { value: new THREE.Vector2(width, height) },
      radius: { value: corner }, foreground: { value: 0 }, time: { value: 0 },
      reflection: { value: config.intensity.reflection }, lightPosition: { value: new THREE.Vector2(0.2, 0.9) },
    }, vertexShader, fragmentShader, transparent: true,
  });
  const basePhoto = new THREE.Mesh(plane, photoMaterial);
  portrait.add(basePhoto);
  const foregroundMaterial = photoMaterial.clone();
  foregroundMaterial.uniforms.foreground.value = 1;
  foregroundMaterial.depthWrite = false;
  const foregroundPhoto = new THREE.Mesh(plane, foregroundMaterial);
  foregroundPhoto.position.z = 0.024;
  portrait.add(foregroundPhoto);

  const frameMaterial = new THREE.MeshStandardMaterial({ color: palette.paper, roughness: 0.45, metalness: 0.05 });
  const frame = new THREE.Mesh(roundedRectangle(THREE, width + 0.10, height + 0.10, corner + 0.025), frameMaterial);
  frame.position.z = -0.034;
  portrait.add(frame);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x789a88, 2.3);
  scene.add(ambient);
  const movingLight = new THREE.PointLight(0xffffff, 13, 15, 2);
  movingLight.position.set(-2, 3, 5);
  scene.add(movingLight);

  // Quiet geometry around the portrait leaves the face as the visual focus.
  const shapes = [];
  const shapeDefinitions = [
    { geometry: new THREE.IcosahedronGeometry(0.25, 0), position: [-1.91, 1.64, -0.7], wire: false },
    { geometry: new THREE.OctahedronGeometry(0.25, 0), position: [1.98, 0.9, -0.6], wire: true },
    { geometry: new THREE.TorusGeometry(0.25, 0.045, 6, 28), position: [1.77, -1.73, -0.45], wire: false },
    { geometry: new THREE.TorusGeometry(0.16, 0.028, 6, 24), position: [-1.85, -1.60, -0.75], wire: false },
    { geometry: new THREE.OctahedronGeometry(0.13, 0), position: [0.86, 2.16, -0.8], wire: false },
  ];
  shapeDefinitions.forEach((definition, index) => {
    const material = new THREE.MeshStandardMaterial({ color: index % 2 ? palette.accent : palette.mint, roughness: 0.78, metalness: 0.04, wireframe: definition.wire });
    const mesh = new THREE.Mesh(definition.geometry, material);
    mesh.position.set(...definition.position);
    mesh.rotation.set(index * 0.6, index * 0.7, 0.4);
    mesh.userData.baseY = mesh.position.y;
    scene.add(mesh);
    shapes.push(mesh);
  });

  const particlePositions = new Float32Array(config.particles * 3);
  // Deterministic distribution keeps the composition stable across visits.
  for (let index = 0; index < config.particles; index++) {
    const angle = index * 2.39996;
    const radius = 1.85 + (index % 7) * 0.074;
    particlePositions[index * 3] = Math.cos(angle) * radius;
    particlePositions[index * 3 + 1] = Math.sin(angle) * radius;
    particlePositions[index * 3 + 2] = -0.6 - (index % 4) * 0.22;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({ color: palette.accent, size: 0.025, transparent: true, opacity: 0.38, sizeAttenuation: true, depthWrite: false });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  const badges = [
    { text: 'Flutter', mark: 'F', x: -1.66, y: 1.23, phase: 0.0 },
    { text: 'Laravel', mark: 'L', x: 1.67, y: 1.47, phase: 1.0 },
    { text: 'Node.js', mark: 'N', x: 1.73, y: 0.18, phase: 2.0 },
    { text: 'Firebase', mark: 'F', x: -1.69, y: -0.14, phase: 3.0 },
    { text: 'PostgreSQL', mark: 'P', x: -1.44, y: -1.51, phase: 4.0 },
    { text: 'AI', mark: '*', x: 1.53, y: -1.31, phase: 5.0 },
  ].map(item => {
    const texture = badgeTexture(THREE, item, palette);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(item.text === 'PostgreSQL' ? 1.32 : item.text === 'AI' ? 0.70 : 1.15, 0.40, 1);
    sprite.position.set(item.x, item.y, 0.32);
    scene.add(sprite);
    return { ...item, orbitAngle: Math.atan2(item.y / 2.04, item.x / 1.89), sprite };
  });

  function applyTheme() {
    palette = getPalette();
    frameMaterial.color.set(palette.paper);
    shapes.forEach((mesh, index) => mesh.material.color.set(index % 2 ? palette.accent : palette.mint));
    particleMaterial.color.set(palette.accent);
    badges.forEach(item => {
      item.sprite.material.map.dispose();
      item.sprite.material.map = badgeTexture(THREE, item, palette);
      item.sprite.material.needsUpdate = true;
    });
    if (!active && !state.reducedMotion && contextAvailable) renderer.render(scene, camera);
  }
  document.addEventListener('portfolio:theme', applyTheme);
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function resize() {
    const sceneWidth = host.clientWidth;
    const sceneHeight = host.clientHeight;
    if (!sceneWidth || !sceneHeight) return;
    renderer.setSize(sceneWidth, sceneHeight, false);
    camera.aspect = sceneWidth / sceneHeight;
    // Keep the entire orbit visible, with a portrait about 330 px wide on desktop.
    const visibleHeight = Math.max(5.50, 5.22 / camera.aspect);
    cameraDistance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.z = cameraDistance;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  function readScroll() {
    const rect = host.getBoundingClientRect();
    scrollProgress = Math.max(-1, Math.min(1, -rect.top / Math.max(1, rect.height)));
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  function render(now) {
    if (!active || !contextAvailable) return;
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = now;
    elapsed += delta;
    const ease = 1 - Math.exp(-config.speed.easing * delta);
    const input = state.orientationEnabled ? orientation : pointer;
    smooth.x += (input.x - smooth.x) * ease;
    smooth.y += (input.y - smooth.y) * ease;
    portrait.rotation.x = -smooth.y * config.intensity.tilt;
    portrait.rotation.y = smooth.x * config.intensity.tilt;
    portrait.rotation.z = -0.045 + smooth.x * 0.012;
    portrait.position.y = 0.04 + Math.sin(elapsed * config.speed.bob) * config.intensity.bob;
    foregroundPhoto.position.x = smooth.x * config.intensity.depth;
    foregroundPhoto.position.y = -smooth.y * config.intensity.depth;
    camera.position.x = smooth.x * config.intensity.camera;
    camera.position.y = -smooth.y * config.intensity.camera + scrollProgress * config.intensity.scroll;
    camera.position.z = cameraDistance + scrollProgress * 0.10;
    camera.lookAt(0, scrollProgress * 0.055, 0);
    movingLight.position.x = Math.sin(elapsed * config.speed.light) * 3;
    photoMaterial.uniforms.time.value = elapsed * config.speed.light;
    foregroundMaterial.uniforms.time.value = photoMaterial.uniforms.time.value;
    photoMaterial.uniforms.lightPosition.value.set(0.35 + Math.sin(elapsed * config.speed.light) * 0.22, 0.86);
    foregroundMaterial.uniforms.lightPosition.value.copy(photoMaterial.uniforms.lightPosition.value);
    shapes.forEach((mesh, index) => {
      mesh.rotation.x += delta * config.speed.rotation * (index % 2 ? 1 : -1);
      mesh.rotation.y += delta * config.speed.rotation;
      mesh.position.y = mesh.userData.baseY + Math.sin(elapsed * 0.48 + index) * 0.07;
    });
    particles.rotation.z = Math.sin(elapsed * 0.10) * 0.06;
    badges.forEach(item => {
      const orbit = elapsed * config.speed.orbit + item.orbitAngle;
      item.sprite.position.x = Math.cos(orbit) * 1.89;
      item.sprite.position.y = Math.sin(orbit) * 2.04;
      item.sprite.position.z = 0.32 + Math.sin(orbit + item.phase) * 0.12;
    });
    renderer.render(scene, camera);
    state.frames++;
    if (!host.classList.contains('scene-ready')) {
      canvas.hidden = false;
      canvas.style.display = 'block';
      host.classList.add('scene-ready');
      publish('ready');
    }
    animationFrame = requestAnimationFrame(render);
  }

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextAvailable = false;
    setActive(false);
    canvas.hidden = true;
    canvas.style.display = 'none';
    host.classList.remove('scene-ready');
    publish('fallback', 'The WebGL context was lost. The original portrait is available.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextAvailable = true;
    setActive(state.visible && !document.hidden && !state.reducedMotion);
  });

  function setActive(nextActive) {
    active = nextActive && contextAvailable;
    state.running = active;
    cancelAnimationFrame(animationFrame);
    previousTime = 0;
    if (state.reducedMotion) {
      canvas.hidden = true;
      canvas.style.display = 'none';
    }
    if (active) animationFrame = requestAnimationFrame(render);
  }
  return { setActive };
}

function roundedRectangle(THREE, width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, steps: 1, curveSegments: 8 });
}

function badgeTexture(THREE, item, palette) {
  const badge = document.createElement('canvas');
  badge.width = item.text === 'PostgreSQL' ? 422 : item.text === 'AI' ? 224 : 368;
  badge.height = 128;
  const context = badge.getContext('2d');
  const width = badge.width;
  context.shadowColor = 'rgba(20, 43, 38, 0.07)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;
  context.fillStyle = palette.paper;
  context.beginPath();
  context.roundRect(9, 9, width - 18, 104, 25);
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = palette.border;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = palette.mint;
  context.beginPath();
  context.roundRect(28, 29, 65, 65, 17);
  context.fill();
  context.fillStyle = palette.accent;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 34px Manrope, Arial, sans-serif';
  context.fillText(item.mark, 60, 62);
  context.fillStyle = palette.ink;
  context.textAlign = 'left';
  context.font = '600 33px Manrope, Arial, sans-serif';
  context.fillText(item.text, 112, 63);
  const texture = new THREE.CanvasTexture(badge);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
