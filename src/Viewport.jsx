import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SCENE_THEME = {
  dark: {
    bg: 0x14161b,
    ground: 0x1e2127,
    gridMajor: 0x4a5468,
    gridMinor: 0x333a48,
    fog: [30, 95],
    hemiSky: 0xd8e2f2,
    hemiGround: 0x171a20,
    hemiIntensity: 0.95,
    keyIntensity: 1.5,
    fillIntensity: 0.32,
    exposure: 0.92,
  },
  light: {
    bg: 0xd2d2d1,
    ground: 0xc6c6c5,
    gridMajor: 0x9a9a98,
    gridMinor: 0xb6b6b4,
    fog: [38, 78],
    hemiSky: 0xffffff,
    hemiGround: 0xb8b8b4,
    hemiIntensity: 1.55,
    keyIntensity: 2.1,
    fillIntensity: 0.45,
    exposure: 1.05,
  },
};

const BG = SCENE_THEME.light.bg;
const CAM_BLUE = 0x1f6fe0;
const CAM_ACTIVE = 0xff9a3c;
/** Selected (but not necessarily "拍摄中") — bright cyan so secondary rigs stay obvious. */
const CAM_SELECTED = 0x2ec4b6;
/** Idle / non-selected camera wireframe — solid blue, not pale. */
const CAM_IDLE = 0x3d7cff;
const CAM_VISUAL_SCALE = 1.05;
const CAM_BODY_CENTER = [0, 0, -0.52 * CAM_VISUAL_SCALE];
const CAM_BODY_SIZE = [
  0.4 * CAM_VISUAL_SCALE,
  0.4 * CAM_VISUAL_SCALE,
  1 * CAM_VISUAL_SCALE,
];
const CAM_BODY_FRONT_Z = CAM_BODY_CENTER[2] + CAM_BODY_SIZE[2] / 2;
const CAM_LENS_TIP = [0, 0, 0.2 * CAM_VISUAL_SCALE];

function cameraLineMaterial(color, opacity = 0.92) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    fog: false,
  });
}

function lineSegmentsFromPairs(pairs, material) {
  const pts = [];
  pairs.forEach(([a, b]) => {
    pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
  });
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), material);
}

function boxWirePairs(center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const corners = {
    bbl: [cx - hx, cy - hy, cz - hz],
    bbr: [cx + hx, cy - hy, cz - hz],
    btr: [cx + hx, cy + hy, cz - hz],
    btl: [cx - hx, cy + hy, cz - hz],
    fbl: [cx - hx, cy - hy, cz + hz],
    fbr: [cx + hx, cy - hy, cz + hz],
    ftr: [cx + hx, cy + hy, cz + hz],
    ftl: [cx - hx, cy + hy, cz + hz],
  };
  return [
    [corners.bbl, corners.bbr],
    [corners.bbr, corners.btr],
    [corners.btr, corners.btl],
    [corners.btl, corners.bbl],
    [corners.fbl, corners.fbr],
    [corners.fbr, corners.ftr],
    [corners.ftr, corners.ftl],
    [corners.ftl, corners.fbl],
    [corners.bbl, corners.fbl],
    [corners.bbr, corners.fbr],
    [corners.btr, corners.ftr],
    [corners.btl, corners.ftl],
  ];
}

function circleWirePairs(center, radius, segments = 32, plane = 'yz') {
  const [cx, cy, cz] = center;
  const pairs = [];
  let prev = null;
  for (let i = 0; i <= segments; i++) {
    const angle = (Math.PI * 2 * i) / segments;
    const a = Math.cos(angle) * radius;
    const b = Math.sin(angle) * radius;
    let point;
    if (plane === 'xz') point = [cx + a, cy, cz + b];
    else if (plane === 'xy') point = [cx + a, cy + b, cz];
    else point = [cx, cy + a, cz + b];
    if (prev) pairs.push([prev, point]);
    prev = point;
  }
  return pairs;
}

function cameraBodyWirePairs() {
  const s = CAM_VISUAL_SCALE;
  const backTopLeft = [-0.1 * s, 0.1 * s, CAM_BODY_FRONT_Z];
  const backTopRight = [0.1 * s, 0.1 * s, CAM_BODY_FRONT_Z];
  const backBottomRight = [0.1 * s, -0.1 * s, CAM_BODY_FRONT_Z];
  const backBottomLeft = [-0.1 * s, -0.1 * s, CAM_BODY_FRONT_Z];
  const frontTopLeft = [-0.25 * s, 0.2 * s, CAM_LENS_TIP[2]];
  const frontTopRight = [0.25 * s, 0.2 * s, CAM_LENS_TIP[2]];
  const frontBottomRight = [0.25 * s, -0.2 * s, CAM_LENS_TIP[2]];
  const frontBottomLeft = [-0.25 * s, -0.2 * s, CAM_LENS_TIP[2]];

  return [
    ...boxWirePairs(CAM_BODY_CENTER, CAM_BODY_SIZE),
    [backTopLeft, backTopRight],
    [backTopRight, backBottomRight],
    [backBottomRight, backBottomLeft],
    [backBottomLeft, backTopLeft],
    [frontTopLeft, frontTopRight],
    [frontTopRight, frontBottomRight],
    [frontBottomRight, frontBottomLeft],
    [frontBottomLeft, frontTopLeft],
    [backTopLeft, frontTopLeft],
    [backTopRight, frontTopRight],
    [backBottomRight, frontBottomRight],
    [backBottomLeft, frontBottomLeft],
    ...circleWirePairs([0, 0.44 * s, -0.78 * s], 0.21 * s, 32, 'yz'),
    ...circleWirePairs([0, 0.44 * s, -0.34 * s], 0.21 * s, 32, 'yz'),
  ];
}

function cameraFrustumWirePairs(fovDeg, aspect) {
  const fovRad = (fovDeg || 48) * (Math.PI / 180);
  const near = 0.22;
  const far = 1.85;
  const nh = Math.tan(fovRad / 2) * near;
  const nw = nh * aspect;
  const fh = Math.tan(fovRad / 2) * far;
  const fw = fh * aspect;
  const tip = CAM_LENS_TIP;
  const n = [
    [-nw, -nh, near],
    [nw, -nh, near],
    [nw, nh, near],
    [-nw, nh, near],
  ];
  const f = [
    [-fw, -fh, far],
    [fw, -fh, far],
    [fw, fh, far],
    [-fw, fh, far],
  ];
  const pairs = [];
  for (let i = 0; i < 4; i++) {
    pairs.push([tip, n[i]], [n[i], n[(i + 1) % 4]], [n[i], f[i]], [f[i], f[(i + 1) % 4]]);
  }
  return pairs;
}

const gltfLoader = new GLTFLoader();

function applyObjectPose(node, obj) {
  if (obj.pos) node.position.set(...obj.pos);
  if (obj.scale) node.scale.set(...obj.scale);
  if (obj.rot) node.rotation.set(...obj.rot);
}

function lampMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.05,
  });
}

function beamMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function aimDownAtOrigin(group) {
  const dir = new THREE.Vector3(0, 0.5, 0).sub(group.position);
  if (dir.lengthSq() < 1e-6) return;
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
}

function shouldAutoAim(obj) {
  const rot = obj.rot || [0, 0, 0];
  return Math.abs(rot[0]) + Math.abs(rot[1]) + Math.abs(rot[2]) < 1e-4;
}

/** Helpers show the light but must not steal clicks from the scene. */
function ignoreRaycast(mesh) {
  mesh.raycast = () => {};
  return mesh;
}

function makeObjectMesh(obj, index, hooks) {
  const id = obj.id || `obj_${index}`;
  const name = obj.name || `物体${index + 1}`;
  const baseScale = obj.scale ? [...obj.scale] : [1, 1, 1];
  const color = obj.color || '#dedede';

  // Lights: a grabbable lamp plus a real light. Beam meshes do not receive picks.
  if (obj.type === 'directionalLight' || obj.type === 'sun') {
    const group = new THREE.Group();
    const tint = new THREE.Color(color || '#fff1c2');
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), lampMaterial(tint));
    sun.userData.isLamp = true;
    const halo = ignoreRaycast(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 16, 12),
        beamMaterial(tint, 0.22),
      ),
    );
    const beam = ignoreRaycast(
      new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), beamMaterial(tint, 0.55)),
    );
    beam.geometry.translate(0, -0.5, 0);
    beam.scale.y = 2.4;
    beam.userData.isBeam = true;
    const light = new THREE.DirectionalLight(tint, obj.intensity ?? 2.6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 0.4;
    light.shadow.camera.far = 28;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.bias = -0.0004;
    light.target.position.set(0, -2.4, 0);
    group.add(halo, sun, beam, light, light.target);
    applyObjectPose(group, obj);
    if (shouldAutoAim(obj)) aimDownAtOrigin(group);
    group.userData = {
      id, name, baseScale, baseColor: color, kind: 'light', lightType: 'directional', light,
    };
    return group;
  }

  if (obj.type === 'pointLight') {
    const group = new THREE.Group();
    const tint = new THREE.Color(color || '#ffe08a');
    const distance = obj.distance ?? 8;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), lampMaterial(tint));
    bulb.userData.isLamp = true;
    const range = ignoreRaycast(
      new THREE.Mesh(
        new THREE.SphereGeometry(1, 28, 18),
        new THREE.MeshBasicMaterial({
          color: tint,
          wireframe: true,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        }),
      ),
    );
    range.userData.isBeam = true;
    range.scale.setScalar(distance);
    const light = new THREE.PointLight(tint, obj.intensity ?? 80, distance, 2);
    group.add(bulb, range, light);
    applyObjectPose(group, obj);
    group.userData = {
      id, name, baseScale, baseColor: color, kind: 'light', lightType: 'point', light, range,
    };
    return group;
  }

  if (obj.type === 'spotLight') {
    const group = new THREE.Group();
    const tint = new THREE.Color(color || '#ffd27a');
    const distance = obj.distance ?? 12;
    const angle = obj.angle ?? Math.PI / 7;
    const housing = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 16), lampMaterial(tint));
    housing.rotation.x = Math.PI;
    housing.position.y = 0.08;
    housing.userData.isLamp = true;
    const cone = ignoreRaycast(
      new THREE.Mesh(new THREE.ConeGeometry(1, 1, 28, 1, true), beamMaterial(tint, 0.16)),
    );
    cone.geometry.translate(0, -0.5, 0);
    cone.userData.isBeam = true;
    const height = Math.min(distance, 8);
    cone.scale.set(Math.tan(angle) * height, height, Math.tan(angle) * height);
    const light = new THREE.SpotLight(tint, obj.intensity ?? 120, distance, angle, 0.4, 1);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0003;
    light.target.position.set(0, -2, 0);
    group.add(housing, cone, light, light.target);
    applyObjectPose(group, obj);
    if (shouldAutoAim(obj)) aimDownAtOrigin(group);
    group.userData = {
      id, name, baseScale, baseColor: color, kind: 'light', lightType: 'spot', light, cone,
    };
    return group;
  }

  if (obj.type === 'glb') {
    const group = new THREE.Group();
    applyObjectPose(group, obj);
    group.userData = { id, name, baseScale, baseColor: color, kind: 'glb' };
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x8aa4c8,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
      }),
    );
    placeholder.name = 'glbPlaceholder';
    group.add(placeholder);
    if (obj.url) {
      gltfLoader.load(
        obj.url,
        (gltf) => {
          if (!group.parent) return;
          const model = gltf.scene;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          model.scale.multiplyScalar(1.8 / maxDim);
          const fitted = new THREE.Box3().setFromObject(model);
          const center = fitted.getCenter(new THREE.Vector3());
          model.position.sub(center);
          model.position.y += (fitted.max.y - fitted.min.y) / 2;
          const ph = group.getObjectByName('glbPlaceholder');
          if (ph) {
            group.remove(ph);
            ph.geometry?.dispose();
            ph.material?.dispose();
          }
          group.add(model);
          group.position.y = 0;
          hooks?.onTransform?.(id, {
            pos: group.position.toArray(),
            scale: [group.scale.x, group.scale.y, group.scale.z],
            rot: [group.rotation.x, group.rotation.y, group.rotation.z],
          });
          hooks?.onStatus?.(`已载入 ${name}`);
        },
        undefined,
        () => {
          placeholder.material.color.setHex(0xff6b6b);
          hooks?.onStatus?.(`${name} 载入失败`);
        },
      );
    }
    return group;
  }

  let geometry;
  if (obj.type === 'sphere') {
    geometry = new THREE.SphereGeometry(0.5, 32, 20);
  } else if (obj.type === 'cylinder') {
    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
  } else if (obj.type === 'pyramid' || obj.type === 'cone') {
    geometry = new THREE.ConeGeometry(0.55, 1, 4);
  } else {
    geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.82,
    metalness: 0.04,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  applyObjectPose(mesh, obj);
  mesh.userData = {
    id,
    name,
    baseScale,
    baseColor: color,
  };
  return mesh;
}

function cameraRigStyle(isActive, isSelected) {
  // Solid body fill + darker edge/frustum line colors (director-desk style).
  if (isActive) {
    return {
      fill: 0xffb06a,
      edge: 0xe07a2f,
      frustum: CAM_ACTIVE,
      bodyOp: 1,
      frustumOp: 0.9,
      scale: 1.08,
    };
  }
  if (isSelected) {
    return {
      fill: 0x7fe8de,
      edge: 0x1fa89c,
      frustum: CAM_SELECTED,
      bodyOp: 1,
      frustumOp: 0.88,
      scale: 1.05,
    };
  }
  return {
    fill: 0x9ec8ff,
    edge: 0x2b6bb5,
    frustum: CAM_IDLE,
    bodyOp: 1,
    frustumOp: 0.8,
    scale: 1,
  };
}

function applyRigStyle(rig, isActive, isSelected) {
  const style = cameraRigStyle(isActive, isSelected);
  rig.scale.setScalar(style.scale);
  rig.traverse((child) => {
    if (!child.material) return;
    if (child.isLineSegments) {
      const color = child.name === 'frustum' ? style.frustum : style.edge;
      child.material.color.setHex(color);
      child.material.opacity = child.name === 'frustum' ? style.frustumOp : 0.95;
      child.material.needsUpdate = true;
      return;
    }
    if (child.isMesh && child.userData?.isCamBody) {
      child.material.color.setHex(style.fill);
      child.material.emissive?.setHex(style.fill);
      if (child.material.emissive) child.material.emissiveIntensity = 0.08;
      child.material.needsUpdate = true;
    }
  });
}

function addCamBodyPart(parent, geometry, material, pos, rot) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.isCamBody = true;
  mesh.castShadow = true;
  if (pos) mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  parent.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 28),
    cameraLineMaterial(0x2b6bb5, 0.95),
  );
  edges.userData.isCamEdge = true;
  edges.renderOrder = 3;
  mesh.add(edges);
  return mesh;
}

/** Solid shaded camera body + wire FOV frustum. Local +Z is the shooting direction. */
function makeCameraRig(cam, isActive, isSelected) {
  const style = cameraRigStyle(isActive, isSelected);
  const s = CAM_VISUAL_SCALE;
  const rig = new THREE.Group();
  rig.name = `camrig_${cam.id}`;
  rig.userData = { cameraId: cam.id, aimDistance: 6 };
  rig.scale.setScalar(style.scale);

  const head = new THREE.Group();
  head.name = 'camHead';
  rig.add(head);

  const fillMat = new THREE.MeshStandardMaterial({
    color: style.fill,
    roughness: 0.55,
    metalness: 0.12,
    emissive: new THREE.Color(style.fill),
    emissiveIntensity: 0.08,
  });

  // Main body block
  addCamBodyPart(
    head,
    new THREE.BoxGeometry(0.38 * s, 0.34 * s, 0.72 * s),
    fillMat,
    [0, 0.02 * s, -0.42 * s],
  );
  // Top handle
  addCamBodyPart(
    head,
    new THREE.BoxGeometry(0.12 * s, 0.08 * s, 0.42 * s),
    fillMat.clone(),
    [0, 0.28 * s, -0.48 * s],
  );
  // Side viewfinder / monitor
  addCamBodyPart(
    head,
    new THREE.BoxGeometry(0.08 * s, 0.16 * s, 0.22 * s),
    fillMat.clone(),
    [0.26 * s, 0.06 * s, -0.55 * s],
  );
  // Lens barrel
  addCamBodyPart(
    head,
    new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.28 * s, 20),
    fillMat.clone(),
    [0, 0, -0.02 * s],
    [Math.PI / 2, 0, 0],
  );
  // Lens hood flare
  addCamBodyPart(
    head,
    new THREE.CylinderGeometry(0.16 * s, 0.12 * s, 0.1 * s, 20),
    fillMat.clone(),
    [0, 0, 0.16 * s],
    [Math.PI / 2, 0, 0],
  );

  const frustumLines = lineSegmentsFromPairs(
    cameraFrustumWirePairs(cam.fov, 16 / 9),
    cameraLineMaterial(style.frustum, style.frustumOp),
  );
  frustumLines.name = 'frustum';
  frustumLines.renderOrder = 1;
  head.add(frustumLines);

  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 1.35),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pick.position.set(CAM_BODY_CENTER[0], CAM_BODY_CENTER[1], (CAM_BODY_FRONT_Z + CAM_LENS_TIP[2]) / 2);
  pick.userData.isPick = true;
  rig.add(pick);

  return rig;
}

/** World-space forward of a rig, including any aim applied by its gimbal head. */
function rigForward(rig, out = new THREE.Vector3()) {
  const head = rig.getObjectByName('camHead');
  out.set(0, 0, 1).applyQuaternion(rig.quaternion);
  if (head) out.applyEuler(head.rotation);
  return out.normalize();
}

/** Catmull-Rom through the keyframes, sampled at eased t, so the dolly reads as smooth. */
function makeCurves(camPath, lookPath) {
  if (camPath.length < 2) return null;
  const cam = new THREE.CatmullRomCurve3(camPath, false, 'catmullrom', 0.5);
  const look = new THREE.CatmullRomCurve3(lookPath, false, 'catmullrom', 0.5);
  return { cam, look };
}

function keyframePoints(keyframes) {
  const cam = keyframes.map((k) => new THREE.Vector3(...k.pos));
  const look = keyframes.map((k) => new THREE.Vector3(...k.lookAt));
  return { cam, look };
}

export default function Viewport({
  sceneData,
  sceneKey,
  objectFlags = {},
  cameras,
  camerasKey,
  selectedId,
  onSelect,
  onTransform,
  selectedCameraId,
  onCameraSelect,
  onCameraTransform,
  selectedKeyframeIndex,
  onKeyframeSelect,
  onKeyframeTransform,
  onKeyframeInsert,
  activeCameraId,
  lookThrough,
  playing,
  playSpeed,
  playDuration = 15,
  showPath,
  viewMode,
  transformMode,
  onProgress,
  frameRequest,
  onFrame,
  onReady,
  onStatus,
  monitorRef,
  theme = 'dark',
}) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = {
    cameras,
    sceneData,
    objectFlags,
    selectedId,
    playing,
    playSpeed,
    playDuration,
    showPath,
    viewMode,
    transformMode,
    lookThrough,
    selectedCameraId,
    selectedKeyframeIndex,
    activeCameraId,
    onProgress,
    onSelect,
    onTransform,
    onStatus,
    onCameraSelect,
    onCameraTransform,
    onKeyframeSelect,
    onKeyframeTransform,
    onKeyframeInsert,
    onFrame,
    onReady,
    theme,
  };

  useEffect(() => {
    const mount = mountRef.current;
    const t0 = SCENE_THEME[theme] || SCENE_THEME.dark;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(t0.bg);
    scene.fog = new THREE.Fog(t0.bg, t0.fog[0], t0.fog[1]);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
    camera.position.set(9, 7, 11);

    // separate camera used for shot / monitor views, independent of director controls
    const shotCamera = new THREE.PerspectiveCamera(48, 16 / 9, 0.05, 400);
    // the viewfinder has its own camera so aspect/fov edits never fight the main view
    const monitorCamera = new THREE.PerspectiveCamera(48, 16 / 9, 0.05, 400);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setScissorTest(false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = t0.exposure;
    mount.appendChild(renderer.domElement);

    // The viewfinder is a 2D canvas filled from the main renderer, so it shares
    // that context's shadows and does not depend on a second WebGL context.
    let monitorCanvas = null;
    let monitorCtx = null;
    let monitorTarget = null;
    let monitorPixels = null;
    let monitorImage = null;
    let monitorW = 0;
    let monitorH = 0;

    const hemi = new THREE.HemisphereLight(t0.hemiSky, t0.hemiGround, t0.hemiIntensity);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, t0.keyIntensity);
    key.position.set(9, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 20;
    key.shadow.camera.bottom = -20;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    const sunDir = new THREE.Vector3(9, 14, 8).normalize();
    const fill = new THREE.DirectionalLight(0xffffff, t0.fillIntensity);
    fill.position.set(-8, 6, -9);
    scene.add(fill);

    // Semi-transparent floor so objects can sit / rotate under the grid and stay visible.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: t0.ground,
        roughness: 0.96,
        metalness: 0,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    ground.renderOrder = -2;
    scene.add(ground);

    let grid = new THREE.GridHelper(120, 120, t0.gridMajor, t0.gridMinor);
    let gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.55;
      m.depthWrite = false;
    });
    grid.position.y = -0.01;
    grid.renderOrder = -1;
    scene.add(grid);

    /** Replace the grid at a new span, keeping cell density readable. */
    function rebuildGrid(span) {
      const theme = stateRef.current.theme || 'dark';
      const t = SCENE_THEME[theme] || SCENE_THEME.dark;
      scene.remove(grid);
      grid.geometry.dispose();
      gridMats.forEach((m) => m.dispose());
      grid = new THREE.GridHelper(span, Math.min(240, Math.max(40, Math.round(span / 2))), t.gridMajor, t.gridMinor);
      gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMats.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.55;
        m.depthWrite = false;
      });
      grid.position.y = -0.01;
      grid.renderOrder = -1;
      grid.visible = stateRef.current.viewMode === 'edit';
      scene.add(grid);
    }

    /** Repaint the 3D stage to match the active UI theme. */
    function applySceneTheme(name) {
      const t = SCENE_THEME[name] || SCENE_THEME.dark;
      scene.background.setHex(t.bg);
      scene.fog.color.setHex(t.bg);
      // Fog range is owned by syncCameraRange so it always covers the content.
      ground.material.color.setHex(t.ground);
      hemi.color.setHex(t.hemiSky);
      hemi.groundColor.setHex(t.hemiGround);
      hemi.intensity = t.hemiIntensity;
      key.intensity = t.keyIntensity;
      fill.intensity = t.fillIntensity;
      renderer.toneMappingExposure = t.exposure;
      // GridHelper bakes both colors into one vertex-color attribute; rebuilding
      // the helper is simpler and more reliable than patching that buffer.
      scene.remove(grid);
      grid.geometry.dispose();
      gridMats.forEach((m) => m.dispose());
      grid = new THREE.GridHelper(120, 120, t.gridMajor, t.gridMinor);
      gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMats.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.55;
        m.depthWrite = false;
      });
      grid.position.y = -0.01;
      grid.renderOrder = -1;
      grid.visible = stateRef.current.viewMode === 'edit';
      scene.add(grid);
    }

    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);
    const pathGroup = new THREE.Group();
    scene.add(pathGroup);
    const camerasGroup = new THREE.Group();
    scene.add(camerasGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // Allow orbiting under the grid (full sphere) so objects below y=0 stay editable.
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 0.2;
    // No hard ceiling: the user may scale content far past the original set, and
    // must be able to pull back far enough to see all of it. The scene bounding
    // box drives how far back the camera may go (see syncCameraRange).
    controls.maxDistance = 4000;
    controls.screenSpacePanning = true;
    controls.target.set(0, 1, 0);

    /** Keep the orbit range in step with how big the content currently is. */
    const sceneBounds = new THREE.Box3();
    const tmpVec = new THREE.Vector3();
    let gridSpan = 120;
    function syncCameraRange() {
      sceneBounds.makeEmpty();
      objectsGroup.updateMatrixWorld(true);
      objectsGroup.children.forEach((obj) => {
        if (obj.visible) sceneBounds.expandByObject(obj);
      });
      if (sceneBounds.isEmpty()) {
        controls.maxDistance = 4000;
        camera.far = 4000;
        camera.near = 0.1;
      } else {
        sceneBounds.getSize(tmpVec);
        const extent = tmpVec.length();
        controls.maxDistance = Math.max(120, extent * 4);
        camera.far = Math.max(400, extent * 8);
        // Near plane has to scale too, or a large model clips the camera into its
        // own geometry and the viewport goes black.
        camera.near = Math.max(0.02, extent * 0.0008);
        shotCamera.near = camera.near;
        shotCamera.far = camera.far;
        monitorCamera.near = camera.near;
        monitorCamera.far = camera.far;

        // If the camera ended up inside the (now much larger) content, push it
        // out. Only fires when it is actually buried, so normal orbiting is not
        // disturbed by an unwanted camera jump.
        if (sceneBounds.containsPoint(camera.position)) {
          const sphere = sceneBounds.getBoundingSphere(new THREE.Sphere());
          const dir = camera.position.clone().sub(sphere.center);
          if (dir.lengthSq() < 1e-6) dir.set(0.5, 0.6, 0.7);
          dir.normalize();
          camera.position
            .copy(sphere.center)
            .addScaledVector(dir, sphere.radius * 2.4);
          controls.target.copy(sphere.center);
        }
      }
      camera.updateProjectionMatrix();
      // Fog that ends before the content does hides the very thing we want to
      // inspect, so scale the fog range with the set as well.
      const fogFar = camera.far * 0.55;
      scene.fog.near = fogFar * 0.35;
      scene.fog.far = fogFar;

      // Grow the floor and grid so oversized content does not float off them.
      const span = Math.max(120, Math.ceil((camera.far / 4) / 120) * 120);
      if (span !== gridSpan) {
        gridSpan = span;
        ground.scale.setScalar(span / 200);
        rebuildGrid(gridSpan);
      }
    }

    // Three gizmos at once: long move arrows, shorter scale handles.
    // Scale cubes are laterally offset from move axes based on camera angle each frame.
    const TRANSFORM_MODES = ['translate', 'rotate', 'scale'];
    const GIZMO_SIZE = { translate: 1.55, rotate: 0.95, scale: 0.72 };
    /** Radial length of scale cubes vs default (shorter than move arrows). */
    const SCALE_AXIS_OUT = 0.78;
    /** Sideways shift in handle-local units so scale never sits on the move axis line. */
    const SCALE_SIDE_OFFSET = 0.22;
    const AXIS_LOCAL = {
      X: new THREE.Vector3(1, 0, 0),
      Y: new THREE.Vector3(0, 1, 0),
      Z: new THREE.Vector3(0, 0, 1),
    };
    const _axisWorld = new THREE.Vector3();
    const _lateral = new THREE.Vector3();
    const _latLocal = new THREE.Vector3();
    const _quatInv = new THREE.Quaternion();
    const _identityQuat = new THREE.Quaternion();
    const _tmpUp = new THREE.Vector3(0, 1, 0);
    const _flipRef = new THREE.Vector3(0.37, 0.61, 0.29);
    const _nx = new THREE.Vector3();
    const _ny = new THREE.Vector3();
    const _nz = new THREE.Vector3();

    const transforms = TRANSFORM_MODES.map((mode) => {
      const tc = new TransformControls(camera, renderer.domElement);
      tc.setMode(mode);
      tc.setSize(GIZMO_SIZE[mode]);
      tc.showE = false;
      tc.showXYZE = false;
      // Move keeps the three plane faces (XY/YZ/XZ); scale hides them to avoid clutter.
      const showPlanes = mode === 'translate';
      tc.showXY = showPlanes;
      tc.showYZ = showPlanes;
      tc.showXZ = showPlanes;
      scene.add(tc.getHelper());
      return tc;
    });

    /**
     * After TransformControls resets handles each frame:
     * - hide translate XYZ center
     * - style free-scale center
     * - place scale cubes on a short radius AND shift them sideways (camera-relative)
     *   so they never share the move-axis line or sit under plane faces
     */
    transforms.forEach((tc) => {
      const gizmo = tc._gizmo;
      if (!gizmo?.updateMatrixWorld) return;
      const origUpdate = gizmo.updateMatrixWorld.bind(gizmo);
      gizmo.updateMatrixWorld = (force) => {
        origUpdate(force);
        const mode = tc.mode;
        const space = mode === 'scale' ? 'local' : tc.space;
        const quat =
          space === 'local' && tc.object ? tc.worldQuaternion : _identityQuat;
        const eye = gizmo.eye || tc.eye;
        if (!eye) return;

        const touchNamed = (root, name, fn) => {
          if (!root) return;
          root.traverse((obj) => {
            if (obj.name === name) fn(obj);
          });
        };

        if (mode === 'translate') {
          touchNamed(gizmo.gizmo?.translate, 'XYZ', (o) => {
            o.visible = false;
          });
          touchNamed(gizmo.picker?.translate, 'XYZ', (o) => {
            o.visible = false;
          });
          // Nudge plane faces slightly toward the camera so they read clearly vs scale cubes.
          ['XY', 'YZ', 'XZ'].forEach((plane) => {
            const nudgePlane = (root) => {
              if (!root) return;
              root.children.forEach((handle) => {
                if (handle.name !== plane || !handle.visible) return;
                handle.traverse((obj) => {
                  if (!obj.isMesh) return;
                  if (!obj.userData._baseLocalPos) {
                    obj.userData._baseLocalPos = obj.position.clone();
                  }
                  obj.position.copy(obj.userData._baseLocalPos);
                  // Pull plane a bit toward camera in object-local space.
                  _quatInv.copy(quat).invert();
                  _latLocal.copy(eye).applyQuaternion(_quatInv).normalize();
                  obj.position.addScaledVector(_latLocal, 0.04);
                });
              });
            };
            nudgePlane(gizmo.gizmo?.translate);
            nudgePlane(gizmo.picker?.translate);
          });
        }

        if (mode === 'scale') {
          // Three's scale helper is a 1e6-unit line. It fills the view as soon as you drag.
          const hideScaleGuides = (root) => {
            if (!root) return;
            root.traverse((obj) => {
              if (obj.tag === 'helper' || obj.isLine || obj.isLineSegments) obj.visible = false;
            });
          };
          hideScaleGuides(gizmo.helper?.scale);
          hideScaleGuides(gizmo.gizmo?.scale);
          touchNamed(gizmo.gizmo?.scale, 'XYZ', (o) => {
            o.visible = true;
            o.scale.multiplyScalar(1.45);
            if (o.material) {
              if (!o.material._freeScale) {
                o.material._freeScale = true;
                o.material.transparent = true;
                o.material.depthTest = false;
              }
              if (o.material._color) o.material._color.setHex(0xffd54a);
              o.material.color.setHex(0xffd54a);
              o.material.opacity = tc.axis && tc.axis !== 'XYZ' ? 0.35 : 0.95;
            }
          });
          touchNamed(gizmo.picker?.scale, 'XYZ', (o) => {
            o.visible = true;
            o.scale.multiplyScalar(1.9);
          });

          // World axis directions once per frame (for plane-facing checks).
          _nx.copy(AXIS_LOCAL.X).applyQuaternion(quat).normalize();
          _ny.copy(AXIS_LOCAL.Y).applyQuaternion(quat).normalize();
          _nz.copy(AXIS_LOCAL.Z).applyQuaternion(quat).normalize();
          const faceXY = Math.abs(_nz.dot(eye)) > 0.35;
          const faceYZ = Math.abs(_nx.dot(eye)) > 0.35;
          const faceXZ = Math.abs(_ny.dot(eye)) > 0.35;

          // Per-axis: short radial + camera-relative lateral offset (错开移动轴/平面).
          ['X', 'Y', 'Z'].forEach((axis) => {
            _axisWorld.copy(AXIS_LOCAL[axis]).applyQuaternion(quat).normalize();
            _lateral.crossVectors(_axisWorld, eye);
            if (_lateral.lengthSq() < 1e-8) {
              _lateral.crossVectors(_axisWorld, _tmpUp);
            }
            if (_lateral.lengthSq() < 1e-8) {
              _lateral.set(1, 0, 0);
            }
            _lateral.normalize();
            // Stable sign so handles don't flip every frame near grazing angles.
            if (_lateral.dot(_flipRef) < 0) _lateral.negate();
            _quatInv.copy(quat).invert();
            _latLocal.copy(_lateral).applyQuaternion(_quatInv);

            // Extra push when a plane that shares this axis is facing the camera.
            const planeFacing =
              (axis === 'X' && (faceXY || faceXZ)) ||
              (axis === 'Y' && (faceXY || faceYZ)) ||
              (axis === 'Z' && (faceYZ || faceXZ));
            const side = SCALE_SIDE_OFFSET * (planeFacing ? 1.35 : 1);

            const styleAxis = (root, shrinkPick = false) => {
              if (!root) return;
              root.children.forEach((handle) => {
                if (handle.name !== axis) return;
                handle.traverse((obj) => {
                  if (obj.isLine || obj.isLineSegments) {
                    obj.visible = false;
                    return;
                  }
                  if (!obj.isMesh || obj.position.lengthSq() < 1e-6) return;
                  if (!obj.userData._baseLocalPos) {
                    obj.userData._baseLocalPos = obj.position.clone();
                  }
                  obj.position
                    .copy(obj.userData._baseLocalPos)
                    .multiplyScalar(SCALE_AXIS_OUT)
                    .addScaledVector(_latLocal, side);
                  obj.scale.multiplyScalar(shrinkPick ? 0.85 : 0.9);
                });
              });
            };
            styleAxis(gizmo.gizmo?.scale, false);
            styleAxis(gizmo.picker?.scale, true);
          });
        }
      };
    });

    let gizmoDragging = false;
    let activeDragControl = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let selectedObject = null;
    let selectedRig = null;
    let selectedPathNode = null;

    function emitObjectChange(obj) {
      if (!obj) return;

      if (obj.userData.isPathNode) {
        const offset = obj.userData.lookOffset || [0, 0, -1];
        stateRef.current.onKeyframeTransform?.(obj.userData.cameraId, obj.userData.keyframeIndex, {
          pos: obj.position.toArray(),
          lookAt: [
            obj.position.x + offset[0],
            obj.position.y + offset[1],
            obj.position.z + offset[2],
          ],
        });
        return;
      }

      if (obj.userData.cameraId) {
        const headNode = obj.getObjectByName('camHead');
        const forward = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(obj.quaternion)
          .applyEuler(headNode ? headNode.rotation : new THREE.Euler())
          .normalize();
        const aim = obj.userData.aimDistance || 6;
        const lookAt = obj.position.clone().add(forward.multiplyScalar(aim));
        stateRef.current.onCameraTransform?.(obj.userData.cameraId, {
          pos: obj.position.toArray(),
          lookAt: lookAt.toArray(),
        });
        return;
      }

      // No lower bound, but keep scale positive: a negative axis inverts the
      // mesh and drags it inside-out, which reads as the object vanishing.
      if (obj.scale.x < 0) obj.scale.x = Math.abs(obj.scale.x);
      if (obj.scale.y < 0) obj.scale.y = Math.abs(obj.scale.y);
      if (obj.scale.z < 0) obj.scale.z = Math.abs(obj.scale.z);

      stateRef.current.onTransform?.(obj.userData.id, {
        pos: obj.position.toArray(),
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      });
      // Content may have just grown or shrunk a lot; keep the camera able to frame it.
      syncCameraRange();
    }

    function syncGizmoVisibility() {
      const st = stateRef.current;
      const hasSelection = !!(selectedObject || selectedRig || selectedPathNode);
      const editVisible = st.viewMode === 'edit' && hasSelection && !st.lookThrough;
      const pinned = st.transformMode;
      const showAll = !pinned || pinned === 'all';

      transforms.forEach((tc) => {
        if (!editVisible) {
          tc.getHelper().visible = false;
          tc.enabled = false;
          return;
        }
        if (gizmoDragging && activeDragControl) {
          const active = tc === activeDragControl;
          tc.getHelper().visible = active;
          tc.enabled = active;
          return;
        }
        if (selectedPathNode && tc.mode !== 'translate') {
          tc.getHelper().visible = false;
          tc.enabled = false;
          return;
        }
        const show = showAll || pinned === tc.mode;
        tc.getHelper().visible = show;
        tc.enabled = show;
      });
    }

    const SCALE_MIN = 0.08;
    const SCALE_MAX = 4;

    transforms.forEach((tc) => {
      tc.addEventListener('dragging-changed', (e) => {
        gizmoDragging = e.value;
        activeDragControl = e.value ? tc : null;
        controls.enabled =
          !e.value && !stateRef.current.lookThrough && !stateRef.current.drawMode;
        syncGizmoVisibility();
        if (!e.value && tc.object?.userData?.isPathNode) {
          rebuildPath();
          syncKeyframeSelection(stateRef.current.selectedKeyframeIndex);
        }
      });
      tc.addEventListener('objectChange', () => {
        if (tc.mode === 'scale' && tc.object?.scale) {
          const s = tc.object.scale;
          s.x = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.abs(s.x)));
          s.y = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.abs(s.y)));
          s.z = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.abs(s.z)));
        }
        emitObjectChange(tc.object);
      });
    });

    function resolveGizmoAxisName(obj) {
      const known = new Set(['X', 'Y', 'Z', 'XY', 'YZ', 'XZ', 'XYZ', 'E', 'XYZE']);
      let node = obj;
      while (node) {
        if (known.has(node.name)) return node.name;
        node = node.parent;
      }
      return obj?.name || '';
    }

    function pickWinningGizmo(e) {
      if (gizmoDragging || stateRef.current.viewMode !== 'edit') return;
      const target = selectedPathNode || selectedObject || selectedRig;
      if (!target) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const origin = new THREE.Vector3();
      target.getWorldPosition(origin);

      let best = null;
      let bestScore = -Infinity;
      let bestAxis = null;
      transforms.forEach((tc) => {
        if (!tc.getHelper().visible) return;
        const picker = tc._gizmo?.picker?.[tc.mode];
        if (!picker) return;
        const hits = raycaster.intersectObject(picker, true);
        if (!hits.length) return;
        const hit = hits[0];
        const radial = hit.point.distanceTo(origin);
        const name = resolveGizmoAxisName(hit.object);
        const isFreeScale = tc.mode === 'scale' && name === 'XYZ';
        const isScaleAxis = tc.mode === 'scale' && ['X', 'Y', 'Z'].includes(name);
        const isTranslatePlane = tc.mode === 'translate' && ['XY', 'YZ', 'XZ'].includes(name);
        const isTranslateAxis = tc.mode === 'translate' && ['X', 'Y', 'Z'].includes(name);

        // Exclusive pick: plane > free-scale > move arrow > rotate > scale axis.
        // Move and scale never win the same click.
        let score = 2000 - hit.distance * 10;
        if (isTranslatePlane) score += 2400;
        else if (isFreeScale) score += 1700;
        else if (isTranslateAxis) score += 1100 + radial * 90;
        else if (tc.mode === 'rotate') score += 800;
        else if (isScaleAxis) score += 450 + Math.max(0, 1.0 - radial) * 40;
        else score += 100;

        if (score > bestScore) {
          bestScore = score;
          best = tc;
          bestAxis = name;
        }
      });

      // Only one gizmo may be armed — clear axis on the losers so they cannot drag.
      transforms.forEach((tc) => {
        const win = tc === best;
        tc.enabled = win;
        if (!win) tc.axis = null;
        else if (bestAxis) tc.axis = bestAxis;
      });
    }

    function releaseGizmoExclusive() {
      if (gizmoDragging) return;
      syncGizmoVisibility();
      transforms.forEach((tc) => {
        if (!tc.enabled) tc.axis = null;
      });
    }
    renderer.domElement.addEventListener('pointerdown', pickWinningGizmo, true);
    renderer.domElement.addEventListener('pointerup', releaseGizmoExclusive);
    renderer.domElement.addEventListener('pointercancel', releaseGizmoExclusive);

    let downAt = null;
    // gimbal ring drag: which axis is being turned, and where the pointer started
    let ringDrag = null;
    let lastHoverCheck = 0;
    let lastPathClick = 0;
    let pathCurves = null;
    let pathKeys = [];
    // current path accent colour, shared by the tube and the node dots
    let pathColor = CAM_BLUE;
    let pathCameraId = null;
    let pathTube = null;
    let pathKnots = [];

    function pickRing(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(camerasGroup.children, true);
      for (const hit of hits) {
        let node = hit.object;
        while (node && !node.userData.gimbalAxis) node = node.parent;
        if (node) {
          let rigNode = node;
          while (rigNode && !rigNode.userData.cameraId) rigNode = rigNode.parent;
          if (rigNode) return { axis: node.userData.gimbalAxis, rig: rigNode, hit };
        }
      }
      return null;
    }

    function onPointerDown(e) {
      downAt = { x: e.clientX, y: e.clientY };
      if (stateRef.current.viewMode !== 'edit') return;
      const picked = pickRing(e);
      if (picked) {
        ringDrag = {
          axis: picked.axis,
          rig: picked.rig,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        controls.enabled = false;
        transforms.forEach((tc) => {
          tc.enabled = false;
        });
        renderer.domElement.setPointerCapture?.(e.pointerId);
      }
    }

    function onPointerMove(e) {
      if (ringDrag) {
        const dx = e.clientX - ringDrag.lastX;
        const dy = e.clientY - ringDrag.lastY;
        ringDrag.lastX = e.clientX;
        ringDrag.lastY = e.clientY;

        const head = ringDrag.rig.getObjectByName('camHead');
        if (!head) return;

        // Pan (yaw) for the horizontal ring, tilt (pitch) for the vertical ones.
        const rate = 0.006;
        if (ringDrag.axis === 'y') head.rotation.y -= dx * rate;
        if (ringDrag.axis === 'x') head.rotation.x -= dy * rate;
        if (ringDrag.axis === 'z') head.rotation.z -= dx * rate;

        const lookAt = rigForward(ringDrag.rig)
          .multiplyScalar(ringDrag.rig.userData.aimDistance || 6)
          .add(ringDrag.rig.position);
        stateRef.current.onCameraTransform?.(ringDrag.rig.userData.cameraId, {
          pos: ringDrag.rig.position.toArray(),
          lookAt: lookAt.toArray(),
        });
        return;
      }

      // hover: path knots / tube / gimbal rings
      if (stateRef.current.viewMode !== 'edit') return;
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const onKnot = pathKnots.length && raycaster.intersectObjects(pathKnots, false).length > 0;
      const onTube = pathTube ? raycaster.intersectObject(pathTube, false).length > 0 : false;
      const hovered = pickRing(e);
      const want = hovered || onKnot ? 'grab' : onTube ? 'copy' : '';
      if (renderer.domElement.style.cursor !== want) {
        renderer.domElement.style.cursor = want;
      }
    }

    function onPointerUp(e) {
      if (ringDrag) {
        ringDrag = null;
        syncGizmoVisibility();
        controls.enabled =
          !gizmoDragging && !stateRef.current.lookThrough && !stateRef.current.drawMode;
        downAt = null;
        return;
      }
      if (!gizmoDragging) syncGizmoVisibility();
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 4 || transforms.some((tc) => tc.dragging)) return;
      if (stateRef.current.viewMode !== 'edit') return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const now = performance.now();
      const isDouble = now - lastPathClick < 320;
      lastPathClick = now;
      if (isDouble && insertKeyframeAtPointer(e)) return;

      const knotHits = pathKnots.length ? raycaster.intersectObjects(pathKnots, false) : [];
      if (knotHits.length) {
        const knot = knotHits[0].object;
        const ki = knot.userData.keyframeIndex;
        stateRef.current.onCameraSelect?.(knot.userData.cameraId);
        // re-click same node toggles off
        if (ki === stateRef.current.selectedKeyframeIndex) {
          stateRef.current.onKeyframeSelect?.(null);
        } else {
          stateRef.current.onKeyframeSelect?.(ki);
        }
        return;
      }

      const camHits = raycaster.intersectObjects(camerasGroup.children, true);
      if (camHits.length) {
        let node = camHits[0].object;
        while (node && !node.userData.cameraId) node = node.parent;
        if (node) {
          stateRef.current.onKeyframeSelect?.(null);
          stateRef.current.onCameraSelect?.(node.userData.cameraId);
          return;
        }
      }

      const hits = raycaster.intersectObjects(objectsGroup.children, true);
      if (!hits.length) {
        // Empty space clears everything: object, keyframe and camera selection,
        // so no gizmo is left floating over an unselected scene.
        stateRef.current.onKeyframeSelect?.(null);
        stateRef.current.onCameraSelect?.(null);
        stateRef.current.onSelect?.(null);
        return;
      }
      stateRef.current.onKeyframeSelect?.(null);
      let node = hits[0].object;
      while (node && !node.userData?.id) node = node.parent;
      stateRef.current.onSelect?.(node?.userData?.id || null);
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const clock = new THREE.Clock();
    let animT = 0;
    // true while recordShot is painting the white-model take
    let recordingTake = false;
    let rigs = new Map();
    let cameraDirty = false;

    function disposeNode(node) {
      node.traverse?.((child) => {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material?.dispose();
      });
    }

    function disposeGroup(group) {
      for (let i = group.children.length - 1; i >= 0; i--) {
        const child = group.children[i];
        disposeNode(child);
        group.remove(child);
      }
    }

    /** Preview / path / playback always follow the currently selected camera. */
    function focusCameraId() {
      const st = stateRef.current;
      return st.selectedCameraId || st.activeCameraId || null;
    }

    function focusCamera() {
      const id = focusCameraId();
      return (stateRef.current.cameras || []).find((c) => c.id === id) || null;
    }

    function pathSourceCamera() {
      const cam = focusCamera();
      // A hidden rig draws nothing, so its motion path must not be drawn either.
      const usable = (c) => c && !c.hidden && c.keyframes?.length >= 2;
      if (usable(cam)) return cam;
      // Fall back to another editable camera path only when the focused one has
      // nothing to show (none, hidden, or too few keyframes).
      const fallback = (stateRef.current.cameras || []).find(usable);
      if (fallback) return fallback;
      // Scene seed path is only for when no camera owns a path at all.
      return cam && !cam.hidden ? cam : null;
    }

    function rebuildPath() {
      if (gizmoDragging && activeDragControl?.object?.userData?.isPathNode) return;

      const keepIndex = stateRef.current.selectedKeyframeIndex;
      disposeGroup(pathGroup);
      pathKnots = [];
      pathTube = null;
      selectedPathNode = null;

      const cam = pathSourceCamera();
      const hasCameras = (stateRef.current.cameras || []).length > 0;
      const keys =
        cam?.keyframes?.length >= 2
          ? cam.keyframes
          : // Only use the seed path when the project has no cameras at all; if
            // every camera is hidden the stage must stay blank, not fall back.
            !hasCameras
            ? stateRef.current.sceneData?.camera_path
            : null;
      pathKeys = keys || [];
      pathCameraId = cam?.id || null;
      const points = keyframePoints(pathKeys);
      pathCurves = makeCurves(points.cam, points.look);
      if (!pathCurves) return;

      // Thin motion-path tube — highlight when it belongs to the focused camera.
      const focusId = focusCameraId();
      pathColor =
        cam?.id === stateRef.current.activeCameraId
          ? CAM_ACTIVE
          : cam?.id === focusId
            ? CAM_SELECTED
            : CAM_BLUE;
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(pathCurves.cam, 200, 0.006, 5, false),
        new THREE.MeshBasicMaterial({
          color: pathColor,
          transparent: true,
          opacity: 0.92,
        }),
      );
      tube.userData.isPathTube = true;
      pathTube = tube;
      pathGroup.add(tube);

      const lookLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pathCurves.look.getPoints(80)),
        new THREE.LineDashedMaterial({
          color: 0xff5a5a,
          dashSize: 0.25,
          gapSize: 0.2,
          opacity: 0.4,
          transparent: true,
        }),
      );
      lookLine.computeLineDistances();
      pathGroup.add(lookLine);

      points.cam.forEach((p, i) => {
        const last = points.cam.length - 1;
        const color = i === 0 ? 0x59d98b : i === last ? 0xff5a5a : pathColor;
        const knot = makeNodeCard(color, i === 0 || i === last);
        knot.position.copy(p);
        knot.renderOrder = 6;
        const look = points.look[i] || p.clone().add(new THREE.Vector3(0, 0, -1));
        knot.userData = {
          ...knot.userData,
          isPathNode: true,
          keyframeIndex: i,
          cameraId: pathCameraId,
          lookOffset: [look.x - p.x, look.y - p.y, look.z - p.z],
          cardColor: color,
        };
        pathGroup.add(knot);
        pathKnots.push(knot);
      });

      if (keepIndex != null) syncKeyframeSelection(keepIndex);
    }

    /**
     * A path node drawn as a flat square tile, sized in pixels so it stays the
     * same on screen at any zoom level.
     */
    function makeNodeCard(color, isEnd) {
      const s = isEnd ? 15 : 12;
      const canvas = document.createElement('canvas');
      canvas.width = s * 2;
      canvas.height = s * 2;
      const ctx = canvas.getContext('2d');
      // Read the raw hex channels: THREE.Color stores linear-light values, and
      // converting those straight to 0-255 shifts the hue.
      const hex = color >>> 0;
      const rgb = `rgb(${(hex >> 16) & 0xff},${(hex >> 8) & 0xff},${hex & 0xff})`;

      ctx.scale(2, 2);
      ctx.fillStyle = rgb;
      ctx.fillRect(0.5, 0.5, s - 1, s - 1);
      ctx.strokeStyle = 'rgba(10,12,16,0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, s - 1, s - 1);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;

      const card = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      card.scale.set(0.001, 0.001, 1);
      card.userData.cardSize = { w: s, h: s };
      return card;
    }

    function syncKeyframeSelection(index) {
      const next = index != null ? pathKnots[index] || null : null;
      pathKnots.forEach((knot, i) => {
        const on = index != null && i === index;
        knot.renderOrder = on ? 7 : 6;
        // Slightly larger while selected, but size itself stays pixel-locked.
        updateNodeScale(knot, on);
      });
      if (next && next === selectedPathNode && transforms.some((tc) => tc.dragging)) {
        return;
      }
      selectedPathNode = next;
      if (selectedPathNode) {
        selectedObject = null;
        selectedRig = null;
      }
      applyTransformBinding();
    }

    /** Keep a node card at a fixed pixel size regardless of camera distance. */
    function updateNodeScale(knot, selected = false) {
      if (!knot?.userData?.cardSize) return;
      const view = renderer.domElement.clientHeight || 900;
      const fovRad = (camera.fov * Math.PI) / 180;
      const dist = knot.position.distanceTo(camera.position);
      // World units per screen pixel at this depth.
      const perPixel = (2 * Math.tan(fovRad / 2) * dist) / view;
      const { w, h } = knot.userData.cardSize;
      const boost = selected ? 1.18 : 1;
      knot.scale.set(w * perPixel * boost, h * perPixel * boost, 1);
    }

    function updateAllNodeScales() {
      const sel = stateRef.current.selectedKeyframeIndex;
      pathKnots.forEach((knot, i) => updateNodeScale(knot, i === sel));
    }

    function insertKeyframeAtPointer(e) {
      if (!pathCurves || !pathCameraId || !pathTube) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(pathTube, false);
      if (!hits.length) return false;

      const hitPoint = hits[0].point;
      let bestT = 0;
      let bestDist = Infinity;
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const dist = pathCurves.cam.getPoint(t).distanceTo(hitPoint);
        if (dist < bestDist) {
          bestDist = dist;
          bestT = t;
        }
      }
      if (bestDist > 1.2) return false;
      // Only allow inserts strictly between start and end.
      if (pathKeys.length < 2) return false;
      if (bestT <= 0.02 || bestT >= 0.98) return false;

      const pos = pathCurves.cam.getPoint(bestT);
      const look = pathCurves.look.getPoint(bestT);
      // bestT is a curve parameter (equal steps per index), so map it straight to
      // an insert slot instead of comparing against user-set times.
      const segs = pathKeys.length - 1;
      let insertAt = Math.round(bestT * segs);
      if (insertAt <= 0) insertAt = 1;
      if (insertAt >= pathKeys.length) insertAt = pathKeys.length - 1;
      const before = pathKeys[insertAt - 1];
      const after = pathKeys[insertAt];
      const time =
        ((before?.time ?? 0) + (after?.time ?? 1)) / 2;
      stateRef.current.onKeyframeInsert?.(pathCameraId, insertAt, {
        time,
        pos: pos.toArray(),
        lookAt: look.toArray(),
      });
      stateRef.current.onKeyframeSelect?.(insertAt);
      return true;
    }

    function rebuildCameraRigs() {
      transforms.forEach((tc) => tc.detach());
      selectedRig = null;
      selectedPathNode = null;
      rigs.clear();
      disposeGroup(camerasGroup);

      const st = stateRef.current;
      (st.cameras || []).forEach((cam) => {
        const isActive = cam.id === st.activeCameraId;
        const isSelected = cam.id === st.selectedCameraId;
        const rig = makeCameraRig(cam, isActive, isSelected);
        const kf = cam.keyframes?.[0];
        const pos = kf ? kf.pos : cam.pos;
        const lookAt = kf ? kf.lookAt : cam.lookAt;
        if (!pos || !lookAt) return;

        // Prefer persisted cam.pos / keyframe over a transient playhead pose,
        // so adding a new camera never "slides" an existing one.
        rig.position.set(...pos);
        rig.lookAt(new THREE.Vector3(...lookAt));
        rig.userData.aimDistance = Math.max(
          new THREE.Vector3(...pos).distanceTo(new THREE.Vector3(...lookAt)),
          1.5,
        );
        camerasGroup.add(rig);
        rigs.set(cam.id, rig);
      });

      syncCameraSelection(stateRef.current.selectedCameraId);
      applyViewMode(stateRef.current.viewMode);
      // Re-apply playhead only on the focused camera after rebuild.
      if (st.playing && pathCurves) {
        const e = animT < 0.5 ? 2 * animT * animT : 1 - Math.pow(-2 * animT + 2, 2) / 2;
        const focusId = focusCameraId();
        const focusRig = focusId ? rigs.get(focusId) : null;
        if (focusRig) {
          focusRig.position.copy(pathCurves.cam.getPoint(e));
          focusRig.lookAt(pathCurves.look.getPoint(e));
        }
      }
    }

    function refreshRigStyles() {
      const st = stateRef.current;
      rigs.forEach((rig, id) => {
        applyRigStyle(rig, id === st.activeCameraId, id === st.selectedCameraId);
      });
    }

    /** Park every non-focused rig at its saved pose so playhead never drags others. */
    function restoreIdleRigs() {
      const st = stateRef.current;
      const focusId = focusCameraId();
      (st.cameras || []).forEach((cam) => {
        if (cam.id === focusId) return;
        const rig = rigs.get(cam.id);
        if (!rig) return;
        const kf = cam.keyframes?.[0];
        const pos = kf ? kf.pos : cam.pos;
        const lookAt = kf ? kf.lookAt : cam.lookAt;
        if (!pos || !lookAt) return;
        rig.position.set(...pos);
        rig.lookAt(new THREE.Vector3(...lookAt));
      });
    }

    function syncCameraSelection(id) {
      selectedRig = rigs.get(id) || null;
      if (stateRef.current.selectedKeyframeIndex == null) selectedPathNode = null;
      restoreIdleRigs();
      refreshRigStyles();
      applyTransformBinding();
    }

    function applyTransformBinding() {
      const st = stateRef.current;
      const target =
        st.viewMode === 'edit'
          ? selectedPathNode || selectedObject || selectedRig
          : null;

      // Locked items stay selectable but must not be transformable.
      const targetLocked = (() => {
        if (!target) return false;
        if (target.userData?.cameraId) {
          const c = (st.cameras || []).find((x) => x.id === target.userData.cameraId);
          return !!c?.locked;
        }
        return !!st.objectFlags?.[target.userData?.id]?.locked;
      })();

      if (target && !targetLocked) {
        const factor = selectedPathNode ? 0.7 : selectedObject ? 1 : 0.65;
        transforms.forEach((tc) => {
          if (selectedPathNode && tc.mode !== 'translate') {
            tc.detach();
            tc.getHelper().visible = false;
            tc.enabled = false;
            return;
          }
          tc.setSize(GIZMO_SIZE[tc.mode] * factor);
          tc.attach(target);
        });
      } else {
        transforms.forEach((tc) => tc.detach());
      }
      syncGizmoVisibility();
    }

    /** Apply per-object visibility from the list's eye toggles. */
    function applyObjectFlags() {
      const flags = stateRef.current.objectFlags || {};
      objectsGroup.children.forEach((child) => {
        const f = flags[child.userData?.id];
        child.visible = !f?.hidden;
      });
      // a hidden object must not keep the gizmo attached
      if (selectedObject && !selectedObject.visible) {
        selectedObject = null;
        applyTransformBinding();
      }
      // hidden cameras drop out of the 3D view too
      (stateRef.current.cameras || []).forEach((c) => {
        const rig = rigs.get(c.id);
        if (rig) rig.visible = !c.hidden;
      });
      // The motion path belongs to a camera: hiding that camera must hide its
      // path as well, so re-pick the path source whenever flags change.
      rebuildPath();
    }

    function loadScene(data) {
      const wasEmpty = objectsGroup.children.length === 0;
      disposeGroup(objectsGroup);
      transforms.forEach((tc) => tc.detach());

      (data.objects || []).forEach((obj, i) => {
        objectsGroup.add(
          makeObjectMesh(obj, i, {
            onTransform: (id, next) => stateRef.current.onTransform?.(id, next),
            onStatus: (msg) => stateRef.current.onStatus?.(msg),
          }),
        );
      });

      animT = 0;
      // Only auto-frame on the first load — adding elements should keep the current view.
      if (wasEmpty) fitCamera();
    }

    function patchObject(id, patch) {
      const node = objectsGroup.children.find((c) => c.userData.id === id);
      const light = node?.userData?.light;
      if (!node || !light) return;
      if (patch.intensity != null) light.intensity = patch.intensity;
      if (patch.color) {
        light.color.set(patch.color);
        node.traverse((child) => {
          if (!child.material) return;
          if (child.userData.isLamp) {
            child.material.color.set(patch.color);
            if (child.material.emissive) child.material.emissive.set(patch.color);
          } else if (child.userData.isBeam && child.material.color) {
            child.material.color.set(patch.color);
          }
        });
      }
      if (patch.distance != null && (light.isPointLight || light.isSpotLight)) {
        light.distance = patch.distance;
        if (node.userData.range) node.userData.range.scale.setScalar(Math.max(0.2, patch.distance));
      }
      if (light.isSpotLight) {
        if (patch.angle != null) light.angle = patch.angle;
        const cone = node.userData.cone;
        if (cone) {
          const height = Math.min(light.distance || 8, 8);
          const radius = Math.tan(light.angle) * height;
          cone.scale.set(radius, height, radius);
        }
      }
    }

    function syncSelection(id) {
      selectedObject = objectsGroup.children.find((c) => c.userData.id === id) || null;
      if (selectedObject) selectedPathNode = null;
      applyTransformBinding();
    }

    function applyViewMode(mode) {
      const isEdit = mode === 'edit';
      grid.visible = !!isEdit;
      pathGroup.visible = stateRef.current.showPath && isEdit;
      camerasGroup.visible = isEdit;
      syncGizmoVisibility();
    }

    function fitCamera() {
      syncCameraRange();
      const box = new THREE.Box3().setFromObject(objectsGroup);
      if (box.isEmpty()) return;
      // Include the rigs so a camera parked outside the set still shows up.
      if (camerasGroup.children.length) {
        box.union(new THREE.Box3().setFromObject(camerasGroup));
      }
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() * 0.55, 2.5);
      const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 0.9;

      camera.position.set(
        center.x + dist * 0.52,
        center.y + dist * 0.62,
        center.z + dist * 0.72,
      );
      controls.target.copy(center);
      controls.update();
    }

    /** Place a shot camera at a rig, respecting the rig's FOV. */
    function pointShotCamera(target, rig, cam) {
      target.fov = cam?.fov || 48;
      target.position.copy(rig.position);
      target.lookAt(rig.position.clone().add(rigForward(rig)));
      target.updateProjectionMatrix();
    }

    apiRef.current = {
      loadScene,
      patchObject,
      syncSelection,
      applyObjectFlags,
      syncCameraSelection,
      applyViewMode,
      applySceneTheme,
      rebuildCameraRigs,
      rebuildPath,
      refreshRigStyles,
      /** Frame the set plus every rig — used once right after a camera is added. */
      frameScene() {
        fitCamera();
      },
      setShowPath(v) {
        pathGroup.visible = v && stateRef.current.viewMode !== 'render';
      },
      setTransformMode(m) {
        stateRef.current.transformMode = m || 'all';
        syncGizmoVisibility();
      },
      syncKeyframeSelection,
      resetCamera() {
        fitCamera();
      },
      /** Aim the director camera at the grid center without reframing the whole set. */
      focusCenter() {
        const center = new THREE.Vector3(0, 1, 0);
        const offset = camera.position.clone().sub(controls.target);
        if (offset.length() < 2) offset.set(7, 5.5, 9);
        camera.position.copy(center).add(offset);
        controls.target.copy(center);
        controls.update();
      },
      /** Capture the current director view as a camera position + aim. */
      captureView() {
        return {
          pos: camera.position.toArray(),
          lookAt: controls.target.toArray(),
        };
      },

      /**
       * A point on the existing motion path, sampled at the midpoint between two
       * keyframe indices. Adding a node here leaves the curve's shape untouched
       * because the sample already lies on it.
       */
      /** Screen-space radius (px) of the first path node — used by tests. */
      debugNodeScreenRadius() {
        if (!pathKnots.length) return null;
        const knot = pathKnots[0];
        const world = knot.scale.x;
        const dist = knot.position.distanceTo(camera.position);
        if (dist <= 0) return null;
        const view = renderer.domElement.clientHeight || 900;
        const fovRad = (camera.fov * Math.PI) / 180;
        const worldPerPixel = (2 * Math.tan(fovRad / 2) * dist) / view;
        return world / worldPerPixel;
      },

      /** What the motion path currently shows — used by tests. */
      debugPathState() {
        return {
          knots: pathKnots.length,
          cameraId: pathCameraId,
          groupVisible: pathGroup.visible,
        };
      },

      /** How many transform gizmos are currently attached — used by tests. */
      debugGizmoCount() {
        return transforms.filter((tc) => tc.object).length;
      },

      /** Node card colours as hex — used by tests. */
      debugNodePositions() {
        return pathKnots.map((k) => {
          const v = k.position.clone().project(camera);
          return {
            i: k.userData.keyframeIndex,
            world: k.position.toArray().map((n) => +n.toFixed(2)),
            screen: [
              Math.round((v.x * 0.5 + 0.5) * renderer.domElement.clientWidth),
              Math.round((-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight),
            ],
            onScreen: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
          };
        });
      },

      /** Node card colours as hex — used by tests. */
      debugNodeColors() {
        return pathKnots.map((k) => ({
          i: k.userData.keyframeIndex,
          color: '#' + (k.userData.cardColor ?? 0).toString(16).padStart(6, '0'),
        }));
      },

      /** Pixel footprint of a node card — used by tests. */
      debugNodePixelSize() {
        if (!pathKnots.length) return null;
        const knot = pathKnots[0];
        const view = renderer.domElement.clientHeight || 900;
        const fovRad = (camera.fov * Math.PI) / 180;
        const dist = knot.position.distanceTo(camera.position);
        const perPixel = (2 * Math.tan(fovRad / 2) * dist) / view;
        return {
          w: Math.round(knot.scale.x / perPixel),
          h: Math.round(knot.scale.y / perPixel),
        };
      },

      /** Whether any transform gizmo is currently showing. */
      debugGizmoVisible() {
        return transforms.some((tc) => !!tc.object && tc.getHelper().visible);
      },

      samplePathBetween(afterIndex) {        if (!pathCurves || pathKeys.length < 2) return null;
        const a = pathKeys[afterIndex - 1];
        const b = pathKeys[afterIndex];
        if (!a || !b) return null;

        // The curve runs through equal index steps, so a keyframe's position on
        // the curve is its index fraction, not its stored time.
        const u = (afterIndex - 0.5) / (pathKeys.length - 1);
        const clamped = Math.max(0, Math.min(1, u));
        return {
          time: ((a.time ?? 0) + (b.time ?? 1)) / 2,
          pos: pathCurves.cam.getPoint(clamped).toArray(),
          lookAt: pathCurves.look.getPoint(clamped).toArray(),
        };
      },
      /** Point the director view at a camera so you can see what it frames. */
      lookFromCamera(id) {
        const rig = rigs.get(id);
        if (!rig) return;
        const forward = rigForward(rig);
        const aim = rig.userData.aimDistance || 6;
        camera.position.copy(rig.position).addScaledVector(forward, -aim * 0.55);
        camera.position.y += aim * 0.35;
        controls.target.copy(rig.position.clone().addScaledVector(forward, aim * 0.5));
        controls.update();
      },
      seek(t) {
        animT = t;
        cameraDirty = true;
        if (pathCurves) {
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const pos = pathCurves.cam.getPoint(Math.max(0, Math.min(1, e)));
          const look = pathCurves.look.getPoint(Math.max(0, Math.min(1, e)));
          const focusId = focusCameraId();
          const rig = focusId ? rigs.get(focusId) : null;
          if (rig) {
            rig.position.copy(pos);
            rig.lookAt(look);
          }
        }
      },
      capture() {
        const r = renderer.domElement;
        return r.toDataURL('image/png');
      },

      /**
       * Render the active camera's move to a WebM file.
       *
       * The output is always a white-model plate: the stage is repainted with the
       * light scene theme and every editor overlay is hidden for the whole take,
       * so the dark UI theme never leaks into the deliverable.
       */
      async recordShot({ fps = 30, seconds = 15, cameraId = null } = {}) {
        const camId = cameraId || stateRef.current.activeCameraId || focusCameraId();
        const rig = camId ? rigs.get(camId) : null;
        if (!rig) throw new Error('没有可用的机位');

        const cam = (stateRef.current.cameras || []).find((c) => c.id === camId);
        const totalFrames = Math.max(1, Math.round(fps * seconds));

        // --- white-model plate for the duration of the take ---
        const restoreTheme = stateRef.current.theme || 'dark';
        const prevAspect = camera.aspect;
        const prevAnimT = animT;
        const OUTPUT_ASPECT = 16 / 9;
        applySceneTheme('light');
        recordingTake = true;

        const prev = {
          cams: camerasGroup.visible,
          path: pathGroup.visible,
          grid: grid.visible,
          helpers: transforms.map((tc) => tc.getHelper().visible),
          rigPos: rig.position.clone(),
          rigQuat: rig.quaternion.clone(),
        };
        // Detach the rigs entirely: visibility alone can be re-enabled by the
        // per-frame overlay logic, and a rig would then leak into the plate.
        const camsParent = camerasGroup.parent;
        if (camsParent) camsParent.remove(camerasGroup);
        camerasGroup.visible = false;
        pathGroup.visible = false;
        grid.visible = false;
        transforms.forEach((tc) => tc.getHelper().visible = false);
        // Belt and braces: anything else sitting in the scene that is not part of
        // the set (selection outlines, draw overlays) must not reach the plate.
        const hiddenExtras = [];
        scene.children.forEach((obj) => {
          const keep = obj === objectsGroup || obj === ground || obj.isLight;
          if (obj.visible && !keep) {
            hiddenExtras.push(obj);
            obj.visible = false;
          }
        });

        // Offscreen renderer at a fixed 16:9 plate size: the on-screen canvas is
        // whatever shape the window is, but the deliverable must not be.
        const OUT_W = 1920;
        const OUT_H = 1080;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = OUT_W;
        outCanvas.height = OUT_H;
        const outRenderer = new THREE.WebGLRenderer({
          canvas: outCanvas,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        outRenderer.setPixelRatio(1);
        outRenderer.setSize(OUT_W, OUT_H, false);
        outRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
        outRenderer.shadowMap.type = renderer.shadowMap.type;
        outRenderer.toneMapping = renderer.toneMapping;
        outRenderer.toneMappingExposure =
          (SCENE_THEME.light || SCENE_THEME.dark).exposure;

        const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
          .find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || 'video/webm';

        try {
          // Phase 1 — render every frame up front so playback can run at speed.
          const frames = [];
          for (let i = 0; i < totalFrames; i++) {
            const t = totalFrames === 1 ? 0 : i / (totalFrames - 1);
            if (pathCurves) {
              const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              rig.position.copy(pathCurves.cam.getPoint(Math.max(0, Math.min(1, e))));
              rig.lookAt(pathCurves.look.getPoint(Math.max(0, Math.min(1, e))));
            }
            pointShotCamera(shotCamera, rig, cam);
            shotCamera.aspect = OUTPUT_ASPECT;
            shotCamera.updateProjectionMatrix();
            fitKeyShadow(shotCamera);
            outRenderer.render(scene, shotCamera);
            // Copy out now; the drawing buffer is reused by the next render.
            frames.push(outCanvas.toDataURL('image/png'));
          }

          // Phase 2 — replay them onto the plate at the target frame rate.
          const plate = document.createElement('canvas');
          plate.width = OUT_W;
          plate.height = OUT_H;
          const pctx = plate.getContext('2d');
          const plateStream = plate.captureStream(0);
          const plateTrack = plateStream.getVideoTracks()[0];
          const plateRecorder = new MediaRecorder(plateStream, {
            mimeType: mime,
            videoBitsPerSecond: 16_000_000,
          });
          const plateChunks = [];
          plateRecorder.ondataavailable = (e) => e.data.size && plateChunks.push(e.data);
          const plateDone = new Promise((resolve) => {
            plateRecorder.onstop = () => resolve(new Blob(plateChunks, { type: mime }));
          });

          const decoded = await Promise.all(
            frames.map(
              (src) =>
                new Promise((resolve, reject) => {
                  const img = new Image();
                  img.onload = () => resolve(img);
                  img.onerror = reject;
                  img.src = src;
                }),
            ),
          );

          plateRecorder.start();
          const frameMs = 1000 / fps;
          const startedAt = performance.now();
          for (let i = 0; i < decoded.length; i++) {
            pctx.drawImage(decoded[i], 0, 0, OUT_W, OUT_H);
            plateTrack.requestFrame?.();
            const target = startedAt + (i + 1) * frameMs;
            const wait = target - performance.now();
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          }
          // A beat at the tail so the encoder flushes the final frame.
          await new Promise((r) => setTimeout(r, frameMs));
          plateRecorder.stop();
          plateTrack.stop?.();

          return await plateDone;
        } finally {
          outRenderer.dispose();
          recordingTake = false;
          hiddenExtras.forEach((o) => (o.visible = true));
          if (camsParent && !camerasGroup.parent) camsParent.add(camerasGroup);
          rig.position.copy(prev.rigPos);
          rig.quaternion.copy(prev.rigQuat);
          camerasGroup.visible = prev.cams;
          pathGroup.visible = prev.path;
          grid.visible = prev.grid;
          transforms.forEach((tc, idx) => (tc.getHelper().visible = prev.helpers[idx]));
          camera.aspect = prevAspect;
          camera.updateProjectionMatrix();
          animT = prevAnimT;
          applySceneTheme(restoreTheme);
        }
      },

      getCamera() {
        return {
          pos: camera.position.toArray(),
          lookAt: controls.target.toArray(),
        };
      },
      /** Freeze orbit/gizmos while sketching; allowSelect re-enables pick + gizmo for move tool. */
      setDrawMode(on, opts = {}) {
        const allowSelect = !!opts.allowSelect;
        stateRef.current.drawMode = !!on && !allowSelect;
        stateRef.current.drawSelect = !!on && allowSelect;
        const editing = stateRef.current.viewMode === 'edit' && !stateRef.current.lookThrough;
        const allowOrbit = (!on || allowSelect) && !gizmoDragging && editing;
        controls.enabled = allowOrbit;
        transforms.forEach((tc) => {
          tc.enabled = !on || allowSelect;
        });
        if (allowSelect) syncGizmoVisibility();
        else if (on) {
          transforms.forEach((tc) => {
            tc.getHelper().visible = false;
          });
        }
      },
      /**
       * Project screen-space stroke points (relative to the viewport stage) onto y=0,
       * then lift them into camera keyframes that travel along the drawn path.
       */
      strokeToKeyframes(points, opts = {}) {
        if (!points?.length) return [];
        const height = opts.height ?? 2.4;
        const lookDist = opts.lookDist ?? 2.2;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        const world = [];
        const w = Math.max(1, mount.clientWidth);
        const h = Math.max(1, mount.clientHeight);

        for (const p of points) {
          pointer.x = (p.x / w) * 2 - 1;
          pointer.y = -(p.y / h) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          if (raycaster.ray.intersectPlane(plane, hit)) {
            world.push(hit.clone());
          }
        }
        if (world.length < 2) return [];

        // Drop near-duplicates so the dolly doesn't stutter.
        const cleaned = [world[0]];
        for (let i = 1; i < world.length; i++) {
          if (cleaned[cleaned.length - 1].distanceTo(world[i]) > 0.08) cleaned.push(world[i]);
        }
        if (cleaned.length < 2) return [];

        const n = Math.min(16, Math.max(4, cleaned.length));
        const curve = cleaned.length >= 2
          ? new THREE.CatmullRomCurve3(cleaned, false, 'catmullrom', 0.35)
          : null;
        const samples = curve
          ? curve.getSpacedPoints(n - 1)
          : cleaned;

        return samples.map((pos, i) => {
          const next = samples[Math.min(i + 1, samples.length - 1)];
          const prev = samples[Math.max(i - 1, 0)];
          const dir = next.clone().sub(i === samples.length - 1 ? prev : pos);
          dir.y = 0;
          if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
          else dir.normalize();
          const camPos = [pos.x, height, pos.z];
          const lookAt = [
            pos.x + dir.x * lookDist,
            Math.max(0.4, height * 0.45),
            pos.z + dir.z * lookDist,
          ];
          return {
            time: samples.length === 1 ? 0 : i / (samples.length - 1),
            pos: camPos,
            lookAt,
          };
        });
      },
    };

    function resize() {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const _shadowFocus = new THREE.Vector3();
    const _shadowCam = new THREE.PerspectiveCamera();
    const _frustumInv = new THREE.Matrix4();
    const _ndc = new THREE.Vector3();
    const _fwd = new THREE.Vector3();
    const _hit = new THREE.Vector3();
    const _viewPt = new THREE.Vector3();

    /**
     * Keep the key-light shadow map on the ground the active camera can see.
     * A fixed box around the origin drops shadows as soon as the rig moves.
     */
    function fitKeyShadow(viewCam) {
      if (!viewCam) return;
      viewCam.updateMatrixWorld();
      viewCam.updateProjectionMatrix();
      _frustumInv.multiplyMatrices(viewCam.matrixWorld, viewCam.projectionMatrixInverse);
      viewCam.getWorldDirection(_fwd);

      const pts = [];
      const camPos = viewCam.position;
      for (const z of [-1, 1]) {
        for (const y of [-1, 1]) {
          for (const x of [-1, 1]) {
            _ndc.set(x, y, z).applyMatrix4(_frustumInv);
            const dirY = _ndc.y - camPos.y;
            const dirX = _ndc.x - camPos.x;
            const dirZ = _ndc.z - camPos.z;
            const len = Math.hypot(dirX, dirY, dirZ);
            if (len < 1e-5 || Math.abs(dirY) < 1e-4) continue;
            const t = -camPos.y / (dirY / len);
            const along = _fwd.x * dirX + _fwd.y * dirY + _fwd.z * dirZ;
            if (t > 0.3 && t < 70 && along > 0) {
              pts.push(new THREE.Vector3(
                camPos.x + (dirX / len) * t,
                0,
                camPos.z + (dirZ / len) * t,
              ));
            }
          }
        }
      }

      const box = new THREE.Box3().setFromObject(objectsGroup);
      if (!box.isEmpty()) {
        const xs = [box.min.x, box.max.x];
        const ys = [box.min.y, box.max.y];
        const zs = [box.min.z, box.max.z];
        for (const x of xs) {
          for (const y of ys) {
            for (const z of zs) {
              _hit.set(x, y, z);
              if (_hit.clone().sub(camPos).dot(_fwd) > 0) pts.push(_hit.clone());
            }
          }
        }
      }
      if (!pts.length) return;

      _shadowFocus.set(0, 0, 0);
      for (const p of pts) _shadowFocus.add(p);
      _shadowFocus.multiplyScalar(1 / pts.length);

      const sunDist = 48;
      key.target.position.copy(_shadowFocus);
      key.position.copy(_shadowFocus).addScaledVector(sunDir, sunDist);
      key.target.updateMatrixWorld();
      key.updateMatrixWorld();

      _shadowCam.position.copy(key.position);
      _shadowCam.up.set(0, 1, 0);
      _shadowCam.lookAt(key.target.position);
      _shadowCam.updateMatrixWorld();
      const view = _shadowCam.matrixWorldInverse;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of pts) {
        _viewPt.copy(p).applyMatrix4(view);
        minX = Math.min(minX, _viewPt.x);
        maxX = Math.max(maxX, _viewPt.x);
        minY = Math.min(minY, _viewPt.y);
        maxY = Math.max(maxY, _viewPt.y);
        minZ = Math.min(minZ, _viewPt.z);
        maxZ = Math.max(maxZ, _viewPt.z);
      }
      const pad = 2;
      const minSpan = 8;
      const widen = (min, max) => {
        if (max - min >= minSpan) return [min, max];
        const mid = (min + max) / 2;
        return [mid - minSpan / 2, mid + minSpan / 2];
      };
      const [left, right] = widen(minX - pad, maxX + pad);
      const [bottom, top] = widen(minY - pad, maxY + pad);
      const shadowCam = key.shadow.camera;
      shadowCam.left = left;
      shadowCam.right = right;
      shadowCam.bottom = bottom;
      shadowCam.top = top;
      shadowCam.near = Math.max(0.5, -maxZ - 6);
      shadowCam.far = Math.max(shadowCam.near + 12, -minZ + 10);
      shadowCam.updateProjectionMatrix();
    }

    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const st = stateRef.current;

      if (st.playing && pathCurves) {
        // 1× walks the whole path in the chosen take length (4–15s).
        // Only the focused (selected) camera rides the path — others stay put.
        const takeSec = Math.min(15, Math.max(4, Number(st.playDuration) || 15));
        animT += (dt / takeSec) * st.playSpeed;
        if (animT >= 1) animT -= Math.floor(animT);
        cameraDirty = true;
        const e = animT < 0.5 ? 2 * animT * animT : 1 - Math.pow(-2 * animT + 2, 2) / 2;
        const pos = pathCurves.cam.getPoint(e);
        const look = pathCurves.look.getPoint(e);
        const focusId = focusCameraId();
        const rig = focusId ? rigs.get(focusId) : null;
        if (rig) {
          rig.position.copy(pos);
          rig.lookAt(look);
        }
      }
      if (cameraDirty) {
        st.onProgress?.(animT);
        cameraDirty = false;
      }

      // 成片预览 / 进入取景：主画布用当前机位；成片视界框必须与机位 PIP 同 FOV/宽高比
      const focusId = focusCameraId();
      const focusRig = focusId ? rigs.get(focusId) : null;
      const focusCam = (st.cameras || []).find((c) => c.id === focusId);
      const isRenderPreview = st.viewMode === 'render';
      const shot = st.lookThrough || isRenderPreview;
      const OUTPUT_ASPECT = 16 / 9;

      /** Hide editor overlays (paths, cams, grid, gizmos) for a clean lens render. */
      function withCleanShot(renderFn) {
        const prev = {
          cams: camerasGroup.visible,
          path: pathGroup.visible,
          grid: grid.visible,
          helpers: transforms.map((tc) => tc.getHelper().visible),
        };
        camerasGroup.visible = false;
        pathGroup.visible = false;
        grid.visible = false;
        transforms.forEach((tc) => {
          tc.getHelper().visible = false;
        });
        try {
          renderFn();
        } finally {
          camerasGroup.visible = prev.cams;
          pathGroup.visible = prev.path;
          grid.visible = prev.grid;
          transforms.forEach((tc, i) => {
            tc.getHelper().visible = prev.helpers[i];
          });
        }
      }

      if (shot && focusRig) {
        // 成片预览是同一机位的一张画面，16:9 视界只由遮罩标出，不再叠第二遍渲染。
        pointShotCamera(shotCamera, focusRig, focusCam);
        controls.enabled = false;
        shotCamera.aspect = camera.aspect;
        shotCamera.updateProjectionMatrix();
        const fullW = mount.clientWidth || 1;
        const fullH = mount.clientHeight || 1;
        fitKeyShadow(shotCamera);
        withCleanShot(() => {
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, fullW, fullH);
          renderer.render(scene, shotCamera);
        });
      } else {
        controls.enabled = !gizmoDragging && !st.drawMode;
        // While a take is being recorded the stage must stay clean, so the
        // per-frame overlay logic steps aside.
        if (!recordingTake) {
          camerasGroup.visible = st.viewMode === 'edit';
          pathGroup.visible = st.showPath && st.viewMode === 'edit';
          grid.visible = st.viewMode === 'edit';
        }
        if (!st.drawMode && !recordingTake) syncGizmoVisibility();
        else {
          transforms.forEach((tc) => {
            tc.getHelper().visible = false;
            tc.enabled = false;
          });
        }
        renderer.setScissorTest(false);
        fitKeyShadow(camera);
        renderer.render(scene, camera);
      }

      // Edit-mode PIP. Drawn by the main renderer into a target, then copied
      // onto the viewfinder canvas so a lost second WebGL context cannot blank it.
      const monitorEl = monitorRef?.current;
      const monitorRig =
        !isRenderPreview ? rigs.get(st.selectedCameraId || st.activeCameraId) : null;
      if (monitorEl && monitorRig) {
        const w = Math.max(2, Math.floor(monitorEl.clientWidth));
        const h = Math.max(2, Math.floor(monitorEl.clientHeight));
        if (!monitorCanvas) {
          monitorCanvas = document.createElement('canvas');
          monitorCanvas.className = 'monitor-canvas';
          monitorEl.appendChild(monitorCanvas);
          monitorCtx = monitorCanvas.getContext('2d', { alpha: false });
        }
        if (w !== monitorW || h !== monitorH) {
          monitorW = w;
          monitorH = h;
          monitorCanvas.width = w;
          monitorCanvas.height = h;
          monitorTarget?.dispose();
          monitorTarget = new THREE.WebGLRenderTarget(w, h, {
            type: THREE.UnsignedByteType,
            format: THREE.RGBAFormat,
            depthBuffer: true,
          });
          monitorTarget.texture.colorSpace = THREE.SRGBColorSpace;
          monitorPixels = new Uint8Array(w * h * 4);
          monitorImage = new ImageData(w, h);
        }
        const monitorCam =
          (st.cameras || []).find((c) => c.id === (st.selectedCameraId || st.activeCameraId));
        pointShotCamera(monitorCamera, monitorRig, monitorCam);
        monitorCamera.aspect = OUTPUT_ASPECT;
        monitorCamera.updateProjectionMatrix();
        const fullW = mount.clientWidth || 1;
        const fullH = mount.clientHeight || 1;
        try {
          fitKeyShadow(monitorCamera);
          withCleanShot(() => {
            renderer.setRenderTarget(monitorTarget);
            renderer.setViewport(0, 0, w, h);
            renderer.setScissorTest(false);
            renderer.clear();
            renderer.render(scene, monitorCamera);
            renderer.readRenderTargetPixels(monitorTarget, 0, 0, w, h, monitorPixels);
          });
          const row = w * 4;
          const dst = monitorImage.data;
          for (let y = 0; y < h; y++) {
            dst.set(monitorPixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
          }
          monitorCtx.putImageData(monitorImage, 0, 0);
        } finally {
          renderer.setRenderTarget(null);
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, fullW, fullH);
        }
        monitorEl.classList.add('has-feed');
      } else if (monitorEl) {
        monitorEl.classList.remove('has-feed');
      }

      controls.update();

      // Keep path nodes a constant size on screen as the camera moves.
      if (pathKnots.length && !recordingTake) updateAllNodeScales();
    }
    tick();

    mount.__viewport = apiRef;
    stateRef.current.onReady?.(apiRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pickWinningGizmo, true);
      renderer.domElement.removeEventListener('pointerup', releaseGizmoExclusive);
      renderer.domElement.removeEventListener('pointercancel', releaseGizmoExclusive);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      transforms.forEach((tc) => tc.dispose());
      controls.dispose();
      disposeGroup(objectsGroup);
      disposeGroup(pathGroup);
      disposeGroup(camerasGroup);
      ground.geometry.dispose();
      ground.material.dispose();
      monitorTarget?.dispose();
      monitorCanvas?.remove();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      mount.__viewport = null;
    };
    // 依赖保持非空，热更新才会拆掉上一轮 WebGL 循环并重挂机位小窗。
  }, [1]);

  useEffect(() => {
    if (!sceneData) return;
    apiRef.current?.loadScene(sceneData);
    apiRef.current?.rebuildCameraRigs();
    apiRef.current?.rebuildPath();
    apiRef.current?.applyViewMode(stateRef.current.viewMode);
  }, [sceneKey]);

  // rebuild the rigs only when cameras are added/removed/renamed — moving a rig
  // through the gizmo must not tear down and recreate it mid-drag
  useEffect(() => {
    if (!cameras) return;
    apiRef.current?.rebuildCameraRigs();
  }, [camerasKey]);

  useEffect(() => {
    apiRef.current?.rebuildPath();
    apiRef.current?.refreshRigStyles?.();
  }, [activeCameraId, selectedCameraId]);

  const pathKey = (() => {
    const focusId = selectedCameraId || activeCameraId;
    const cam = cameras?.find((c) => c.id === focusId);
    if (!cam?.keyframes?.length) return `empty:${focusId || 'none'}`;
    return `${focusId}|${cam.keyframes.map((k) => `${k.pos},${k.lookAt},${k.time}`).join('|')}`;
  })();

  useEffect(() => {
    apiRef.current?.rebuildPath();
  }, [pathKey]);

  useEffect(() => {
    apiRef.current?.syncCameraSelection(selectedCameraId);
    apiRef.current?.applyViewMode(stateRef.current.viewMode);
  }, [selectedCameraId]);

  useEffect(() => {
    apiRef.current?.syncSelection(selectedId);
    apiRef.current?.applyViewMode(stateRef.current.viewMode);
  }, [selectedId]);

  useEffect(() => {
    apiRef.current?.applyObjectFlags();
  }, [objectFlags, cameras]);

  useEffect(() => {
    apiRef.current?.syncKeyframeSelection(selectedKeyframeIndex);
  }, [selectedKeyframeIndex]);

  useEffect(() => {
    apiRef.current?.setShowPath(showPath);
  }, [showPath]);

  useEffect(() => {
    apiRef.current?.applySceneTheme(theme);
  }, [theme]);

  useEffect(() => {
    apiRef.current?.setTransformMode(transformMode);
  }, [transformMode, selectedCameraId, selectedId, selectedKeyframeIndex]);

  useEffect(() => {
    apiRef.current?.applyViewMode(viewMode);
    if (viewMode !== 'edit') apiRef.current?.syncSelection(null);
  }, [viewMode]);

  useEffect(() => {
    if (!frameRequest) return;
    onFrame?.(apiRef.current?.capture());
  }, [frameRequest]);

  return <div className="viewport" ref={mountRef} />;
}
