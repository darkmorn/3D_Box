import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Viewport from './Viewport';
import CameraPanel from './CameraPanel';
import DrawTrajectory from './DrawTrajectory';

const TYPE_LABEL = {
  box: '立方体',
  sphere: '球体',
  cylinder: '圆柱',
  pyramid: '棱锥',
  directionalLight: '太阳光',
  pointLight: '点光源',
  spotLight: '聚光灯',
  glb: 'GLB',
};

const ADD_ELEMENT_GROUPS = [
  [
    { type: 'sphere', label: '球体', icon: 'sphere' },
    { type: 'box', label: '立方体', icon: 'cube' },
    { type: 'pyramid', label: '棱锥', icon: 'pyramid' },
  ],
  [
    { type: 'directionalLight', label: '太阳光', icon: 'sun' },
    { type: 'pointLight', label: '点光源', icon: 'bulb' },
    { type: 'spotLight', label: '聚光灯', icon: 'spot' },
  ],
  [{ type: 'camera', label: '机位', icon: 'camera' }],
  [{ type: 'glb', label: '导入 GLB', icon: 'importGlb' }],
];

const NEW_OBJECT_DEFAULTS = {
  sphere: { name: '球体', color: '#6ea8fe', scale: [1, 1, 1], pos: [0, 1, 0] },
  box: { name: '立方体', color: '#7db0ff', scale: [1, 1, 1], pos: [0, 1, 0] },
  pyramid: { name: '棱锥', color: '#8ec5ff', scale: [1, 1, 1], pos: [0, 1, 0] },
  directionalLight: {
    name: '太阳光',
    color: '#fff1c2',
    intensity: 2.6,
    scale: [1, 1, 1],
    pos: [4, 8, 3],
    rot: [0, 0, 0],
  },
  pointLight: {
    name: '点光源',
    color: '#ffe08a',
    intensity: 80,
    distance: 8,
    scale: [1, 1, 1],
    pos: [0, 3.2, 0],
  },
  spotLight: {
    name: '聚光灯',
    color: '#ffd27a',
    intensity: 120,
    distance: 12,
    angle: Math.PI / 7,
    scale: [1, 1, 1],
    pos: [1.6, 4.5, 2.2],
    rot: [0, 0, 0],
  },
};
/** Long-take length at 1×. The timeline, preview and export all follow this. */
const DURATION_MIN = 4;
const DURATION_MAX = 15;

function formatClock(seconds, max = DURATION_MAX) {
  const s = Math.max(0, Math.min(max, seconds));
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function Icon({ name }) {
  const paths = {
    reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
    center: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z',
    camera: 'M4 7h3l1.5-2h7L17 7h3v12H4zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    download: 'M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16',
    play: 'M7 4.5v15l13-7.5z',
    pause: 'M8 4h3v16H8zM14 4h3v16h-3z',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.1 3.7M6.3 7.1C3.7 8.9 2 12 2 12s3.6 6 10 6c1 0 1.9-.15 2.7-.4',
    lock: 'M6 10.5h12v9H6zM8.5 10.5V7a3.5 3.5 0 1 1 7 0v3.5',
    unlock: 'M6 10.5h12v9H6zM8.5 10.5V7a3.5 3.5 0 0 1 6.8-1.2',
    path: 'M4 19c4-9 12-9 16 0M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
    move: 'M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3',
    rotate: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v6h-6',
    scale: 'M4 20V8m0 12h12M4 20 20 4M20 4h-6m6 0v6',
    sparkle: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    plus: 'M12 5v14M5 12h14',
    expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
    paperclip: 'M21.4 11.6 12.1 20.9a5 5 0 0 1-7.1-7.1l9.2-9.2a3.2 3.2 0 0 1 4.5 4.5l-9.2 9.2a1.4 1.4 0 0 1-2-2l8.5-8.5',
    history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
    trajectory: 'M4 18c3-8 7-10 12-10M16 8l4 0 0 4M7 18a2 2 0 1 0 0-.01M14 12a2 2 0 1 0 0-.01M20 8a1.5 1.5 0 1 0 0-.01',
    cube: 'M12 2 21 7v10l-9 5-9-5V7zM12 22V12M3 7l9 5 9-5',
    folder: 'M3 7h5l2 2h11v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
    sphere: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z',
    pyramid: 'M12 3 21 20H3L12 3zM12 3v17',
    sun: 'M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M20.5 15.2A8.6 8.6 0 1 1 9.3 3.6a6.9 6.9 0 0 0 11.2 11.6z',
    video: 'M3 7.5A2.5 2.5 0 0 1 5.5 5h7A2.5 2.5 0 0 1 15 7.5v9A2.5 2.5 0 0 1 12.5 19h-7A2.5 2.5 0 0 1 3 16.5zM15 10.5l6-3.5v10l-6-3.5z',
    bulb: 'M9 18h6M10 21h4M12 3a5 5 0 0 1 3.5 8.4c-.7.7-1.2 1.5-1.4 2.6H9.9c-.2-1.1-.7-1.9-1.4-2.6A5 5 0 0 1 12 3z',
    spot: 'M8 4h8l2 4H6l2-4zM10 8v4l-4 8h12l-4-8V8',
    importGlb: 'M12 5v14M5 12h14M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.cube} />
    </svg>
  );
}

async function requestScene(text) {
  const res = await fetch('/api/gen_scene', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`服务返回 ${res.status}`);
  return res.json();
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('3dbox.theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [scene, setScene] = useState(null);
  const [sceneKey, setSceneKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  // Per-object visibility / edit lock, keyed by object id. Locked objects cannot
  // be transformed; hidden ones are not drawn and cannot be picked.
  const [objectFlags, setObjectFlags] = useState({});
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('正在载入场景…');
  const [pipExpanded, setPipExpanded] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [refMenuOpen, setRefMenuOpen] = useState(false);
  const [references, setReferences] = useState([]);
  const composerRef = useRef(null);
  const refInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('3dbox.theme', theme);
    } catch {
      /* private mode — theme just won't persist */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [durationSec, setDurationSec] = useState(DURATION_MAX);
  const [showPath, setShowPath] = useState(true);
  const [viewMode, setViewMode] = useState('edit');
  // 'all' = move + rotate + scale gizmos together; a concrete mode pins one.
  const [transformMode, setTransformMode] = useState('all');
  const [frameRequest, setFrameRequest] = useState(0);
  const [lastFrame, setLastFrame] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [camerasKey, setCamerasKey] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState(null);
  const [sideTab, setSideTab] = useState('scene'); // 'scene' | 'camera'
  const [lookThrough, setLookThrough] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawAnnotation, setDrawAnnotation] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [glbDropOver, setGlbDropOver] = useState(false);
  const viewportApi = useRef(null);
  const monitorRef = useRef(null);
  const cameraCounter = useRef(1);
  const objectCounter = useRef(1);
  const addMenuRef = useRef(null);
  const glbInputRef = useRef(null);

  const bumpCameras = useCallback(() => setCamerasKey((k) => k + 1), []);

  /** Turn the LLM's single camera move into the first editable camera rig. */
  const seedCameras = useCallback(
    (data) => {
      const keys = data?.camera_path || [];
      if (!keys.length) {
        setCameras([]);
        setSelectedCameraId(null);
        setActiveCameraId(null);
        setSelectedKeyframeIndex(null);
        return;
      }
      const first = keys[0];
      const id = `cam_${cameraCounter.current++}`;
      const cam = {
        id,
        name: '机位 1',
        fov: 48,
        keyframes: keys.map((k, i) => ({
          time: k.time ?? i / Math.max(1, keys.length - 1),
          pos: [...k.pos],
          lookAt: [...k.lookAt],
        })),
        pos: [...first.pos],
        lookAt: [...first.lookAt],
      };
      setCameras([cam]);
      setCamerasKey((k) => k + 1);
      setSelectedCameraId(id);
      setActiveCameraId(id);
      setSelectedKeyframeIndex(null);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    fetch('/api/demo')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setScene(data);
        setSceneKey((k) => k + 1);
        seedCameras(data);
        const maxObj = (data.objects || []).reduce((m, o) => {
          const n = Number(String(o.id || '').replace(/\D/g, '')) || 0;
          return Math.max(m, n);
        }, 0);
        objectCounter.current = Math.max(objectCounter.current, maxObj + 1);
        setStatus('已载入示例场景，输入描述可重新生成');
      })
      .catch(() => alive && setStatus('后端未启动：先运行 python main.py'));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const onDown = (e) => {
      if (!addMenuRef.current?.contains(e.target)) setAddMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [addMenuOpen]);

  const selected = useMemo(
    () => scene?.objects?.find((o) => o.id === selectedId) || null,
    [scene, selectedId],
  );

  const handleSelect = useCallback((id) => {
    if (!id) {
      // Clicking empty space clears every selection so the transform gizmos go
      // away and nothing looks "still active".
      setSelectedId(null);
      setSelectedCameraId(null);
      setSelectedKeyframeIndex(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev === id) return null;
      setSelectedCameraId(null);
      setSelectedKeyframeIndex(null);
      setSideTab('scene');
      return id;
    });
  }, []);

  const toggleObjectFlag = useCallback((id, key) => {
    setObjectFlags((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: !prev[id]?.[key] },
    }));
  }, []);

  const toggleCameraFlag = useCallback((id, key) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: !c[key] } : c)),
    );
    // a locked or hidden rig must not stay selected for editing
    if (key === 'locked' || key === 'hidden') {
      setSelectedCameraId((cur) => (cur === id ? null : cur));
    }
  }, []);

  const handleTransform = useCallback((id, next) => {
    setScene((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        objects: prev.objects.map((o) => (o.id === id ? { ...o, ...next } : o)),
      };
    });
  }, []);

  const handleProgress = useCallback((t) => setProgress(t), []);

  const selectedCamera = useMemo(
    () => cameras.find((c) => c.id === selectedCameraId) || null,
    [cameras, selectedCameraId],
  );

  const patchCamera = useCallback((id, patch) => {
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const addSceneObject = useCallback((type, extra = {}) => {
    const defaults = NEW_OBJECT_DEFAULTS[type] || {
      name: '物体',
      color: '#dedede',
      scale: [1, 1, 1],
      pos: [0, 1, 0],
    };
    const n = objectCounter.current++;
    const count = (scene?.objects || []).filter((o) => o.type === type).length + 1;
    const baseName = extra.name || defaults.name;
    const obj = {
      id: `obj_${n}`,
      type,
      name: extra.name ? baseName : count > 1 ? `${baseName} ${count}` : baseName,
      color: extra.color || defaults.color,
      intensity: extra.intensity ?? defaults.intensity,
      pos: [...(extra.pos || defaults.pos || [0, 1, 0])],
      scale: [...(extra.scale || defaults.scale || [1, 1, 1])],
      rot: [...(extra.rot || defaults.rot || [0, 0, 0])],
    };
    if (extra.url) obj.url = extra.url;
    if (extra.distance != null || defaults.distance != null) {
      obj.distance = extra.distance ?? defaults.distance;
    }
    if (extra.angle != null || defaults.angle != null) {
      obj.angle = extra.angle ?? defaults.angle;
    }

    setScene((prev) => ({
      summary: prev?.summary || '',
      camera_path: prev?.camera_path || [],
      ...(prev || {}),
      objects: [...(prev?.objects || []), obj],
    }));
    setSceneKey((k) => k + 1);
    setSelectedId(obj.id);
    setSelectedCameraId(null);
    setSelectedKeyframeIndex(null);
    setSideTab('scene');
    setAddMenuOpen(false);
    setStatus(`已添加 ${obj.name}`);
    return obj;
  }, [scene]);

  const patchSceneObject = useCallback((id, patch) => {
    setScene((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        objects: prev.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      };
    });
    viewportApi.current?.patchObject?.(id, patch);
  }, []);

  const importGlbFile = useCallback(
    (file) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      const base = file.name.replace(/\.(glb|gltf)$/i, '') || '模型';
      addSceneObject('glb', {
        name: base,
        url,
        color: '#8aa4c8',
        scale: [1, 1, 1],
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      });
      setStatus(`正在载入 ${base}…`);
    },
    [addSceneObject],
  );

  const addCamera = useCallback(() => {
    const view = viewportApi.current?.captureView();
    const n = cameraCounter.current++;
    const id = `cam_${n}`;
    const index = cameras.length;

    // Place beside existing cameras so the new rig is obvious and does not
    // overwrite / sit on top of 机位 1.
    const anchor = cameras[cameras.length - 1];
    let pos = anchor?.pos ? [...anchor.pos] : [8, 5, 8];
    let lookAt = anchor?.lookAt ? [...anchor.lookAt] : view?.lookAt || [0, 1, 0];
    if (view && !anchor) {
      const d = [lookAt[0] - view.pos[0], lookAt[1] - view.pos[1], lookAt[2] - view.pos[2]];
      const len = Math.hypot(...d) || 1;
      const fwd = [d[0] / len, d[1] / len, d[2] / len];
      const right = [-fwd[2], 0, fwd[0]];
      const rLen = Math.hypot(...right) || 1;
      pos = [
        view.pos[0] + fwd[0] * 2.5 + (right[0] / rLen) * 3.2,
        Math.max(1.0, view.pos[1] + fwd[1] * 2.5 + 0.6),
        view.pos[2] + fwd[2] * 2.5 + (right[2] / rLen) * 3.2,
      ];
      lookAt = [...(view.lookAt || lookAt)];
    } else if (anchor) {
      const d = [lookAt[0] - pos[0], lookAt[1] - pos[1], lookAt[2] - pos[2]];
      const len = Math.hypot(...d) || 1;
      const fwd = [d[0] / len, d[1] / len, d[2] / len];
      const right = [-fwd[2], 0, fwd[0]];
      const rLen = Math.hypot(...right) || 1;
      const side = index % 2 === 0 ? 1 : -1;
      pos = [
        pos[0] + (right[0] / rLen) * 2.8 * side + fwd[0] * 0.6,
        Math.max(1.0, pos[1] + 0.35),
        pos[2] + (right[2] / rLen) * 2.8 * side + fwd[2] * 0.6,
      ];
    }

    const cam = {
      id,
      name: `机位 ${index + 1}`,
      fov: anchor?.fov || 48,
      keyframes: [],
      pos,
      lookAt,
    };
    // Append only — never mutate existing cameras (机位 1 stays put).
    setCameras((prev) => [...prev, cam]);
    bumpCameras();
    setSelectedCameraId(id);
    setSelectedId(null);
    setSelectedKeyframeIndex(null);
    setSideTab('camera');
    // Keep current "拍摄中" camera; only assign if none exists yet.
    setActiveCameraId((prev) => prev || id);
    setStatus(`已添加 ${cam.name}（未改动其他机位）`);
  }, [cameras, bumpCameras]);

  const handleAddElement = useCallback(
    (type) => {
      if (type === 'camera') {
        setAddMenuOpen(false);
        addCamera();
        return;
      }
      if (type === 'glb') {
        setAddMenuOpen(false);
        glbInputRef.current?.click();
        return;
      }
      addSceneObject(type);
    },
    [addCamera, addSceneObject],
  );

  const deleteCamera = useCallback(
    (id) => {
      setCameras((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (selectedCameraId === id) setSelectedCameraId(next[0]?.id || null);
        if (activeCameraId === id) setActiveCameraId(next[0]?.id || null);
        return next;
      });
      bumpCameras();
    },
    [selectedCameraId, activeCameraId, bumpCameras],
  );

  const duplicateCamera = useCallback(
    (id) => {
      const src = cameras.find((c) => c.id === id);
      if (!src) return;
      const n = cameraCounter.current++;
      const copy = {
        ...src,
        id: `cam_${n}`,
        name: `${src.name} 副本`,
        keyframes: src.keyframes.map((k) => ({ ...k, pos: [...k.pos], lookAt: [...k.lookAt] })),
        pos: [...src.pos],
        lookAt: [...src.lookAt],
      };
      setCameras((prev) => [...prev, copy]);
      bumpCameras();
      setSelectedCameraId(copy.id);
    },
    [cameras, bumpCameras],
  );

  const captureKeyframe = useCallback(
    (id) => {
      const cam = cameras.find((c) => c.id === id);
      if (!cam) return;

      // Nodes may only be inserted between an existing start and end.
      if (cam.keyframes.length < 2) {
        setStatus('需要先有起点和终点，才能在中间添加节点');
        return;
      }

      // Insert right after the selected node so the new one lands where the user
      // is looking; otherwise fall back to just before the end node.
      const insertAt =
        selectedKeyframeIndex != null &&
        selectedKeyframeIndex >= 0 &&
        selectedKeyframeIndex < cam.keyframes.length - 1
          ? selectedKeyframeIndex + 1
          : cam.keyframes.length - 1;

      // Take the sample from the existing curve: the added node then sits exactly
      // on the current path, so the motion the user already shaped is preserved.
      const sampled = viewportApi.current?.samplePathBetween?.(insertAt);
      const view = sampled || viewportApi.current?.captureView?.();
      if (!view) return;

      setCameras((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const keyframes = [...c.keyframes];
          const before = keyframes[insertAt - 1];
          const after = keyframes[insertAt];
          const t =
            sampled?.time ??
            (before && after
              ? ((before.time ?? 0) + (after.time ?? 1)) / 2
              : (before?.time ?? 0) + 0.1);
          keyframes.splice(insertAt, 0, {
            time: t,
            pos: view.pos,
            lookAt: view.lookAt,
          });
          return { ...c, keyframes };
        }),
      );
      setSelectedKeyframeIndex(insertAt);
      setSelectedId(null);
      setStatus('已添加节点');
    },
    [cameras, selectedKeyframeIndex],
  );

  const removeKeyframe = useCallback(
    (id, index) => {
      const cam = cameras.find((c) => c.id === id);
      if (!cam) return;
      if (cam.keyframes.length <= 2) {
        setStatus('至少要保留起点和终点');
        return;
      }
      if (index == null || index < 0 || index >= cam.keyframes.length) {
        setStatus('请先选中要删除的节点');
        return;
      }
      setCameras((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          // Removing a node must not re-time the ones that remain.
          const keyframes = c.keyframes.filter((_, i) => i !== index);
          return { ...c, keyframes, pos: keyframes[0].pos, lookAt: keyframes[0].lookAt };
        }),
      );
      setSelectedKeyframeIndex((sel) => {
        if (sel == null) return null;
        if (sel === index) return Math.min(index, cam.keyframes.length - 2);
        if (sel > index) return sel - 1;
        return sel;
      });
    },
    [cameras],
  );

  const handleKeyframeTransform = useCallback((cameraId, index, next) => {
    setCameras((prev) =>
      prev.map((c) => {
        if (c.id !== cameraId) return c;
        const keyframes = c.keyframes.map((k, i) => (i === index ? { ...k, ...next } : k));
        const patch = index === 0 ? { pos: next.pos, lookAt: next.lookAt } : {};
        return { ...c, keyframes, ...patch };
      }),
    );
  }, []);

  const handleKeyframeInsert = useCallback((cameraId, index, keyframe) => {
    setCameras((prev) =>
      prev.map((c) => {
        if (c.id !== cameraId) return c;
        if (c.keyframes.length < 2) return c;
        // Clamp insert index to (0, last) — never before start or after end.
        const insertAt = Math.max(1, Math.min(c.keyframes.length - 1, index));
        const keyframes = [...c.keyframes];
        // Keep every existing keyframe exactly where the user put it; the new node
        // only adds a stop between two of them.
        keyframes.splice(insertAt, 0, keyframe);
        return { ...c, keyframes };
      }),
    );
  }, []);

  const handleCameraTransform = useCallback((id, next) => {
    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              pos: next.pos,
              lookAt: next.lookAt,
              keyframes: c.keyframes.length
                ? c.keyframes.map((k, i) => (i === 0 ? { ...k, ...next } : k))
                : c.keyframes,
            }
          : c,
      ),
    );
  }, []);

  const handleCameraSelect = useCallback((id) => {
    setSelectedCameraId((prev) => {
      if (id && prev === id) return null;
      return id;
    });
    if (id) {
      setSelectedId(null);
      setSelectedKeyframeIndex(null);
      setSideTab('camera');
    }
  }, []);

  const play = () => {
    if (progress >= 1) {
      setProgress(0);
      viewportApi.current?.seek(0);
    }
    setPlaying((p) => !p);
  };

  /** Play continuous preview of the currently selected camera path / lens. */
  const playPreview = () => {
    const camId = selectedCameraId || activeCameraId;
    if (!camId) {
      setStatus('请先选中一个机位');
      return;
    }
    // Preview follows selection; do not steal the "拍摄中" assignment.
    if (selectedCameraId !== camId) setSelectedCameraId(camId);
    if (progress >= 1 || (!playing && progress > 0.98)) {
      setProgress(0);
      viewportApi.current?.seek(0);
    }
    setPlaying((p) => !p);
  };

  /** Adjust selected object/camera via the floating prompt (no scene regen). */
  const submitAdjust = () => {
    const text = prompt.trim();
    if (!text || loading) return;
    const target = selected?.name || selectedCamera?.name;
    if (!target) {
      setStatus('请先选中一个元素或机位');
      setComposerExpanded(true);
      return;
    }
    const refHint = references.length ? `（含 ${references.length} 个参考）` : '';
    setStatus(`已记录对「${target}」的调整${refHint}：${text}`);
    setPrompt('');
    setComposerExpanded(false);
    setRefMenuOpen(false);
  };

  const openTrajectorySettings = useCallback(() => {
    setShowPath(true);
    setSideTab('camera');
    setRefMenuOpen(false);
    setComposerExpanded(false);
    setPlaying(false);
    setViewMode('edit');
    setLookThrough(false);
    setDrawMode(true);
    viewportApi.current?.setDrawMode(true);
    const camId = selectedCameraId || activeCameraId || cameras[0]?.id;
    if (camId) {
      setSelectedCameraId(camId);
      setSelectedId(null);
    }
    setStatus('绘制运镜轨迹：在画面上画路径，完成后点 ✓');
  }, [selectedCameraId, activeCameraId, cameras]);

  const cancelDrawTrajectory = useCallback(() => {
    setDrawMode(false);
    viewportApi.current?.setDrawMode(false);
    setStatus('已取消绘制运镜轨迹');
  }, []);

  const confirmDrawTrajectory = useCallback(
    (draft) => {
      const keyframes = viewportApi.current?.strokeToKeyframes(draft.points) || [];
      if (keyframes.length < 2) {
        setStatus('轨迹太短，请画一条更长的路径');
        return;
      }

      let camId = selectedCameraId || activeCameraId;
      if (!camId) {
        const id = `cam_${cameraCounter.current++}`;
        const cam = {
          id,
          name: `机位 ${cameras.length + 1}`,
          fov: 48,
          keyframes,
          pos: [...keyframes[0].pos],
          lookAt: [...keyframes[0].lookAt],
        };
        setCameras((prev) => [...prev, cam]);
        camId = id;
        setSelectedCameraId(id);
        setActiveCameraId((prev) => prev || id);
      } else {
        setCameras((prev) =>
          prev.map((c) =>
            c.id === camId
              ? {
                  ...c,
                  keyframes,
                  pos: [...keyframes[0].pos],
                  lookAt: [...keyframes[0].lookAt],
                }
              : c,
          ),
        );
      }

      bumpCameras();
      setShowPath(true);
      setSideTab('camera');
      setSelectedKeyframeIndex(null);
      setDrawMode(false);
      viewportApi.current?.setDrawMode(false);
      setDrawAnnotation({
        id: `ann_${Date.now()}`,
        name: `标注-${Date.now().toString().slice(-7)}`,
        color: draft.color,
        thumb: viewportApi.current?.capture?.() || null,
      });
      setStatus(`运镜轨迹已生成（${keyframes.length} 个节点）`);
      setProgress(0);
      viewportApi.current?.seek(0);
    },
    [selectedCameraId, activeCameraId, cameras.length, bumpCameras],
  );

  const addLocalReference = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setReferences((prev) => [
      ...prev,
      { id: `ref_${Date.now()}`, name: file.name, url, kind: 'local' },
    ]);
    setStatus(`已添加参考：${file.name}`);
    setRefMenuOpen(false);
    setComposerExpanded(true);
  };

  const addHistoryReference = () => {
    const stub = {
      id: `ref_hist_${Date.now()}`,
      name: `历史参考 ${references.length + 1}`,
      url: null,
      kind: 'history',
    };
    setReferences((prev) => [...prev, stub]);
    setStatus(`已从生成历史选择：${stub.name}`);
    setRefMenuOpen(false);
    setComposerExpanded(true);
  };

  const removeReference = (id) => {
    setReferences((prev) => {
      const hit = prev.find((r) => r.id === id);
      if (hit?.url) URL.revokeObjectURL(hit.url);
      return prev.filter((r) => r.id !== id);
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        openTrajectorySettings();
      }
      if (e.key === 'Escape') {
        if (drawMode) {
          e.preventDefault();
          cancelDrawTrajectory();
          return;
        }
        setRefMenuOpen(false);
        if (!prompt.trim()) setComposerExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTrajectorySettings, prompt, drawMode, cancelDrawTrajectory]);

  useEffect(() => {
    if (!refMenuOpen && !composerExpanded) return undefined;
    const onDown = (e) => {
      if (composerRef.current && !composerRef.current.contains(e.target)) {
        setRefMenuOpen(false);
        if (!prompt.trim() && !references.length) setComposerExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [refMenuOpen, composerExpanded, prompt, references.length]);

  const captureFrame = () => {
    setFrameRequest((n) => n + 1);
  };

  const handleFrame = useCallback((dataUrl) => {
    if (!dataUrl) return;
    setLastFrame(dataUrl);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `3dbox-frame-${Date.now()}.png`;
    a.click();
  }, []);

  const exportJson = () => {
    if (!scene) return;
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `3dbox-scene-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const [recording, setRecording] = useState(false);

  const exportVideo = async () => {
    if (recording) return;
    const api = viewportApi.current;
    if (!api?.recordShot) return;

    setRecording(true);
    setPlaying(false);
    setStatus('正在渲染白模视频…');
    try {
      const blob = await api.recordShot({ fps: 30, seconds: durationSec });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `3dbox-${scene?.title || 'shot'}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('白模视频已导出');
    } catch (err) {
      setStatus(`视频导出失败：${err.message}`);
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="scene-app">
      <header className="top-chrome">
        <div className="top-chrome-left">
          <div className="brand">
            <span className="brand-mark"><Icon name="cube" /></span>
            <div className="brand-text">
              <strong>3DBox</strong>
              <span>{scene?.title || '场景沙盘'}</span>
            </div>
          </div>
          <div className="toolbox">
            <button className="tool-button" title="重置机位" onClick={() => viewportApi.current?.resetCamera()}>
              <Icon name="reset" />
            </button>
            <button
              className="tool-button"
              title="定位到中心"
              onClick={() => viewportApi.current?.focusCenter()}
            >
              <Icon name="center" />
            </button>
            <button
              className={`tool-button ${showPath ? 'on' : ''}`}
              title="显示相机轨迹"
              onClick={() => setShowPath((v) => !v)}
            >
              <Icon name={showPath ? 'eye' : 'eyeOff'} />
            </button>
          </div>
        </div>

        <div className="mode-switch">
          <button
            className={`mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
            onClick={() => {
              setPlaying(false);
              setViewMode('edit');
            }}
          >
            <Icon name="move" />
            场景调度
          </button>
          <button
            className={`mode-btn ${viewMode === 'render' ? 'active' : ''}`}
            onClick={() => {
              setSelectedId(null);
              // Prefer the camera currently selected in the list.
              if (!selectedCameraId && activeCameraId) setSelectedCameraId(activeCameraId);
              setViewMode('render');
            }}
          >
            <Icon name="camera" />
            成片预览
          </button>
        </div>

        <div className="top-chrome-right">
          <button
            className="tool-button theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            aria-label="切换主题"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button
            className="export-btn is-secondary"
            onClick={exportJson}
            title="导出场景 JSON"
          >
            <Icon name="download" />
            JSON
          </button>
          <button
            className="export-btn"
            onClick={exportVideo}
            disabled={recording}
            title="按当前机位轨迹渲染白模视频（WebM）"
          >
            {recording ? <span className="spinner" /> : <Icon name="video" />}
            {recording ? '渲染中…' : '导出白模视频'}
          </button>
        </div>
      </header>

      <div className="workspace">
        <div
          className={`viewport-stage ${viewMode === 'render' ? 'is-render' : ''} ${
            glbDropOver ? 'is-drop' : ''
          }`}
          onDragOver={(e) => {
            if (![...e.dataTransfer.items].some((item) => item.kind === 'file')) return;
            e.preventDefault();
            setGlbDropOver(true);
          }}
          onDragLeave={() => setGlbDropOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setGlbDropOver(false);
            const file = [...e.dataTransfer.files].find((f) => /\.(glb|gltf)$/i.test(f.name));
            if (file) importGlbFile(file);
            else if (e.dataTransfer.files.length) setStatus('请拖入 .glb 或 .gltf 文件');
          }}
        >
          <Viewport
            sceneData={scene}
            sceneKey={sceneKey}
            objectFlags={objectFlags}
            cameras={cameras}
            camerasKey={camerasKey}
            selectedId={selectedId}
            onSelect={handleSelect}
            onTransform={handleTransform}
            selectedCameraId={selectedCameraId}
            onCameraSelect={handleCameraSelect}
            onCameraTransform={handleCameraTransform}
            selectedKeyframeIndex={selectedKeyframeIndex}
            onKeyframeSelect={(i) => {
              setSelectedKeyframeIndex((prev) => (i != null && prev === i ? null : i));
              if (i != null) setSelectedId(null);
            }}
            onKeyframeTransform={handleKeyframeTransform}
            onKeyframeInsert={handleKeyframeInsert}
            activeCameraId={activeCameraId}
            lookThrough={lookThrough}
            playing={playing}
            playSpeed={speed}
            playDuration={durationSec}
            showPath={showPath}
            viewMode={viewMode}
            transformMode={transformMode}
            onProgress={handleProgress}
            frameRequest={frameRequest}
            onFrame={handleFrame}
            onStatus={setStatus}
            monitorRef={monitorRef}
            theme={theme}
            onReady={(api) => {
              viewportApi.current = api;
            }}
          />

          {viewMode === 'render' && (
            <div className="vision-matte" aria-hidden="true">
              <div className="vision-matte-frame">
                <span className="vision-matte-label">
                  <Icon name="camera" />
                  {selectedCamera?.name ||
                    cameras.find((c) => c.id === activeCameraId)?.name ||
                    '机位'}
                  · 视界
                </span>
              </div>
            </div>
          )}

          <div
            className={`monitor-stack ${pipExpanded ? 'is-expanded' : ''} ${
              viewMode === 'render' ? 'is-hidden' : ''
            }`}
          >
            <div
              className={`monitor-pip ${selectedCameraId || activeCameraId ? 'has-feed' : ''} ${
                pipExpanded ? 'is-expanded' : ''
              }`}
            >
              <div className="monitor" ref={monitorRef}>
                {!(selectedCameraId || activeCameraId) && (
                  <span className="monitor-empty">选中机位后可播放取景预览</span>
                )}
              </div>
              <div className="monitor-pip-bar">
                <span className="monitor-pip-title">
                  {durationSec}秒连续预览
                  {selectedCamera?.name || cameras.find((c) => c.id === activeCameraId)?.name
                    ? ` · ${selectedCamera?.name || cameras.find((c) => c.id === activeCameraId)?.name}`
                    : ''}
                </span>
                <div className="monitor-pip-actions">
                  <button
                    type="button"
                    className="pip-btn"
                    title={playing ? '暂停预览' : '播放预览'}
                    onClick={playPreview}
                  >
                    <Icon name={playing ? 'pause' : 'play'} />
                  </button>
                  <button
                    type="button"
                    className="pip-btn"
                    title={pipExpanded ? '缩小' : '放大'}
                    onClick={() => setPipExpanded((v) => !v)}
                  >
                    <Icon name="expand" />
                  </button>
                </div>
              </div>
            </div>
            {drawAnnotation && (
              <div className="draw-annotation-bar">
                <button type="button" className="draw-ann-chip active" title={drawAnnotation.name}>
                  {drawAnnotation.thumb ? (
                    <img src={drawAnnotation.thumb} alt="" />
                  ) : (
                    <span className="draw-ann-fallback" style={{ background: drawAnnotation.color }} />
                  )}
                  <em>{drawAnnotation.name}</em>
                </button>
                <button
                  type="button"
                  className="draw-ann-chip"
                  title={`${durationSec}秒连续预览`}
                  onClick={playPreview}
                >
                  <Icon name="camera" />
                  <em>{durationSec}秒连续</em>
                </button>
              </div>
            )}
          </div>

          <DrawTrajectory
            active={drawMode}
            onCancel={cancelDrawTrajectory}
            onConfirm={confirmDrawTrajectory}
            onToolChange={(tool) => {
              viewportApi.current?.setDrawMode(true, { allowSelect: tool === 'select' });
            }}
          />

          <div
            ref={composerRef}
            className={`composer ${composerExpanded ? 'is-expanded' : 'is-collapsed'} ${
              drawMode ? 'is-hidden' : ''
            }`}
            onClick={() => {
              if (!composerExpanded) setComposerExpanded(true);
            }}
          >
            {(selected || selectedCamera || references.length > 0) && (
              <div className="composer-tags">
                {(selected || selectedCamera) && (
                  <div className="composer-chip" title={selected?.name || selectedCamera?.name}>
                    <Icon name={selectedCamera ? 'camera' : 'cube'} />
                    <span>{selected?.name || selectedCamera?.name}</span>
                  </div>
                )}
                {references.map((r) => (
                  <div key={r.id} className="composer-chip is-ref" title={r.name}>
                    {r.url ? <img src={r.url} alt="" /> : <Icon name="paperclip" />}
                    <span>{r.name}</span>
                    {composerExpanded && (
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeReference(r.id);
                        }}
                        aria-label="移除参考"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {composerExpanded ? (
              <>
                <textarea
                  className="prompt-input prompt-area"
                  value={prompt}
                  rows={3}
                  autoFocus
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitAdjust();
                    }
                  }}
                  placeholder="选中一个元素或机位，描述如何调整…"
                />
                <div className="composer-toolbar">
                  <div className="composer-tools">
                    <div className="composer-tool-wrap">
                      <button
                        type="button"
                        className={`composer-icon-btn ${refMenuOpen ? 'on' : ''}`}
                        title="添加参考"
                        aria-label="添加参考"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefMenuOpen((v) => !v);
                        }}
                      >
                        <Icon name="plus" />
                      </button>
                      {refMenuOpen && (
                        <div className="composer-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => refInputRef.current?.click()}
                          >
                            <Icon name="paperclip" />
                            本地上传
                          </button>
                          <button type="button" role="menuitem" onClick={addHistoryReference}>
                            <Icon name="history" />
                            从生成历史选择
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="composer-icon-btn"
                      title="运镜轨迹 ⇧P"
                      aria-label="运镜轨迹"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTrajectorySettings();
                      }}
                    >
                      <Icon name="trajectory" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="send-btn"
                    onClick={submitAdjust}
                    disabled={loading || !prompt.trim()}
                    title="提交调整"
                  >
                    {loading ? <span className="spinner" /> : <Icon name="sparkle" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="composer-row">
                <input
                  className="prompt-input"
                  value={prompt}
                  readOnly
                  placeholder={
                    selected || selectedCamera || references.length
                      ? ''
                      : '选中一个元素或机位，描述如何调整…'
                  }
                  onFocus={() => setComposerExpanded(true)}
                />
                <button
                  type="button"
                  className="send-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (prompt.trim()) submitAdjust();
                    else setComposerExpanded(true);
                  }}
                  disabled={loading}
                  title="展开或提交"
                >
                  <Icon name="sparkle" />
                </button>
              </div>
            )}

            <input
              ref={refInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                addLocalReference(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <aside className={`side-panel ${viewMode === 'render' ? 'is-preview' : ''}`}>
          <header>
            <span className="side-panel-title">
              <Icon name="folder" />
              项目资产
            </span>
            <div className="side-panel-actions" ref={addMenuRef}>
              <em>
                {sideTab === 'scene' ? scene?.objects?.length || 0 : cameras.length}
              </em>
              <button
                type="button"
                className={`add-asset-btn ${addMenuOpen ? 'on' : ''}`}
                title="添加元素"
                aria-expanded={addMenuOpen}
                onClick={() => setAddMenuOpen((v) => !v)}
              >
                <Icon name="plus" />
              </button>
              {addMenuOpen && (
                <div className="add-element-menu" role="menu">
                  <div className="add-element-title">添加元素</div>
                  {ADD_ELEMENT_GROUPS.map((group, gi) => (
                    <div key={group[0].type} className={gi ? 'add-element-group' : undefined}>
                      {group.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          role="menuitem"
                          onClick={() => handleAddElement(item.type)}
                        >
                          <Icon name={item.icon} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </header>
          <input
            ref={glbInputRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              importGlbFile(file);
              e.target.value = '';
            }}
          />

          <div className="side-tabs">
            <button
              type="button"
              className={sideTab === 'scene' ? 'active' : ''}
              onClick={() => setSideTab('scene')}
            >
              场景
            </button>
            <button
              type="button"
              className={sideTab === 'camera' ? 'active' : ''}
              onClick={() => setSideTab('camera')}
            >
              机位
            </button>
          </div>

          {sideTab === 'scene' ? (
            <div className="side-tab-body">
              <ul className="object-list">
                {(scene?.objects || []).map((obj) => {
                  const flags = objectFlags[obj.id] || {};
                  const hidden = !!flags.hidden;
                  const locked = !!flags.locked;
                  return (
                    <li key={obj.id}>
                      <div
                        className={`object-row ${obj.id === selectedId ? 'active' : ''} ${
                          hidden ? 'is-hidden' : ''
                        } ${locked ? 'is-locked' : ''}`}
                        onClick={() => handleSelect(obj.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(obj.id);
                          }
                        }}
                      >
                        <span className="swatch" style={{ background: obj.color }} />
                        <span className="object-name">{obj.name}</span>
                        <span className="object-type">{TYPE_LABEL[obj.type] || obj.type}</span>
                        <span className="row-actions">
                          <button
                            type="button"
                            className={`row-icon ${hidden ? 'off' : ''}`}
                            title={hidden ? '显示' : '隐藏'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleObjectFlag(obj.id, 'hidden');
                            }}
                          >
                            <Icon name={hidden ? 'eyeOff' : 'eye'} />
                          </button>
                          <button
                            type="button"
                            className={`row-icon ${locked ? 'on' : ''}`}
                            title={locked ? '解锁' : '锁定'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleObjectFlag(obj.id, 'locked');
                            }}
                          >
                            <Icon name={locked ? 'lock' : 'unlock'} />
                          </button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {selected && (
                <div className="inspector">
                  <div className="inspector-head">
                    <span>{selected.name}</span>
                    <div className="seg">
                      {['translate', 'rotate', 'scale'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={transformMode === m ? 'active' : ''}
                          onClick={() => setTransformMode((prev) => (prev === m ? 'all' : m))}
                          title={{ translate: '移动', rotate: '旋转', scale: '缩放' }[m]}
                        >
                          <Icon name={m === 'translate' ? 'move' : m === 'rotate' ? 'rotate' : 'scale'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <dl className="vec">
                    <dt>位置</dt>
                    <dd>{selected.pos.map((v) => v.toFixed(2)).join(' , ')}</dd>
                    <dt>尺寸</dt>
                    <dd>{selected.scale.map((v) => v.toFixed(2)).join(' , ')}</dd>
                  </dl>
                  {['directionalLight', 'pointLight', 'spotLight'].includes(selected.type) && (
                    <div className="light-fields">
                      <label>
                        <span>颜色</span>
                        <input
                          type="color"
                          value={selected.color || '#ffffff'}
                          onChange={(e) => patchSceneObject(selected.id, { color: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>强度 {Number(selected.intensity || 0).toFixed(0)}</span>
                        <input
                          type="range"
                          min="0"
                          max={selected.type === 'directionalLight' ? 8 : 200}
                          step={selected.type === 'directionalLight' ? 0.1 : 1}
                          value={selected.intensity ?? 1}
                          onChange={(e) =>
                            patchSceneObject(selected.id, { intensity: Number(e.target.value) })
                          }
                        />
                      </label>
                      {selected.type !== 'directionalLight' && (
                        <label>
                          <span>范围 {Number(selected.distance || 0).toFixed(1)}</span>
                          <input
                            type="range"
                            min="1"
                            max="30"
                            step="0.5"
                            value={selected.distance ?? 8}
                            onChange={(e) =>
                              patchSceneObject(selected.id, { distance: Number(e.target.value) })
                            }
                          />
                        </label>
                      )}
                      {selected.type === 'spotLight' && (
                        <label>
                          <span>
                            张角 {Math.round(((selected.angle || Math.PI / 7) * 180) / Math.PI)}°
                          </span>
                          <input
                            type="range"
                            min="8"
                            max="70"
                            step="1"
                            value={Math.round(((selected.angle || Math.PI / 7) * 180) / Math.PI)}
                            onChange={(e) =>
                              patchSceneObject(selected.id, {
                                angle: (Number(e.target.value) * Math.PI) / 180,
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {scene?.summary && <p className="scene-summary">{scene.summary}</p>}
            </div>
          ) : (
            <div className="side-tab-body">
              <CameraPanel
                cameras={cameras}
                selectedCameraId={selectedCameraId}
                activeCameraId={activeCameraId}
                lookThrough={lookThrough}
                transformMode={transformMode}
                onTransformMode={(m) => setTransformMode((prev) => (prev === m ? 'all' : m))}
                selectedKeyframeIndex={selectedKeyframeIndex}
                onKeyframeSelect={(i) => {
                  setSelectedKeyframeIndex(i);
                  setSelectedId(null);
                }}
                onSelect={handleCameraSelect}
                onAdd={addCamera}
                onDelete={deleteCamera}
                onToggleFlag={toggleCameraFlag}
                onDuplicate={duplicateCamera}
                onCaptureKeyframe={captureKeyframe}
                onRemoveKeyframe={removeKeyframe}
                onFov={(id, fov) => patchCamera(id, { fov })}
                onActivate={(id) => {
                  setActiveCameraId(id);
                  setSelectedCameraId(id);
                  setSelectedKeyframeIndex(null);
                }}
                onLookThrough={setLookThrough}
                onLookFrom={(id) => viewportApi.current?.lookFromCamera(id)}
              />
            </div>
          )}
        </aside>
      </div>

      <div className="timeline-dock">
        <button className="play-btn" onClick={play} title={playing ? '暂停' : '播放'}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>

        <div className="timeline-main">
          <div className="timeline-meta">
            <div className="speed">
              {[0.5, 1, 2].map((s) => (
                <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <span className="timecode">
              {formatClock(progress * durationSec, durationSec)}
              <em> / {formatClock(durationSec, durationSec)}</em>
            </span>
            <label className="duration-set" title="长镜时长，4 到 15 秒">
              <span>时长</span>
              <input
                type="range"
                min={DURATION_MIN}
                max={DURATION_MAX}
                step="1"
                value={durationSec}
                aria-label="长镜时长"
                onChange={(e) => setDurationSec(Number(e.target.value))}
              />
              <em>{durationSec}s</em>
            </label>
            <button className="ghost-btn" onClick={captureFrame} title="截取当前帧">
              <Icon name="camera" />
              截帧
            </button>
          </div>

          <div className="timeline-track">
            <div className="timeline-ruler" aria-hidden="true">
              {Array.from({ length: durationSec + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`tick ${i % 5 === 0 || i === durationSec ? 'major' : ''}`}
                  style={{ left: `${(i / durationSec) * 100}%` }}
                >
                  <i />
                  {`${i}s`}
                </span>
              ))}
            </div>
            <input
              className="scrub"
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              style={{ '--p': `${progress * 100}%` }}
              onChange={(e) => {
                setPlaying(false);
                const t = Number(e.target.value);
                setProgress(t);
                viewportApi.current?.seek(t);
              }}
            />
          </div>
        </div>
      </div>

      {lastFrame && (
        <div className="frame-peek" onClick={() => setLastFrame(null)} title="点击关闭">
          <img src={lastFrame} alt="截取帧" />
        </div>
      )}
    </div>
  );
}
