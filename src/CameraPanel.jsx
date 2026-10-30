const FOV_PRESETS = [
  { label: '超广角', value: 84 },
  { label: '广角', value: 60 },
  { label: '标准', value: 48 },
  { label: '长焦', value: 28 },
  { label: '特写', value: 16 },
];

const ICON_PATHS = {
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff:
    'M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.1 3.7M6.3 7.1C3.7 8.9 2 12 2 12s3.6 6 10 6c1 0 1.9-.15 2.7-.4',
  lock: 'M6 10.5h12v9H6zM8.5 10.5V7a3.5 3.5 0 1 1 7 0v3.5',
  unlock: 'M6 10.5h12v9H6zM8.5 10.5V7a3.5 3.5 0 0 1 6.8-1.2',
};

function CameraIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name] || ICON_PATHS.eye} />
    </svg>
  );
}

export default function CameraPanel({
  cameras,
  selectedCameraId,
  activeCameraId,
  lookThrough,
  transformMode,
  onTransformMode,
  onSelect,
  onAdd,
  onDelete,
  onToggleFlag,
  onDuplicate,
  selectedKeyframeIndex,
  onKeyframeSelect,
  onCaptureKeyframe,
  onRemoveKeyframe,
  onFov,
  onActivate,
  onLookThrough,
  onLookFrom,
}) {
  const cam = cameras.find((c) => c.id === selectedCameraId) || null;

  return (
    <div className="camera-embed">
      <div className="camera-embed-head">
        <span>机位列表</span>
        <button className="add-cam" onClick={onAdd} title="新增机位" type="button">
          +
        </button>
      </div>

      <ul className="camera-list">
        {cameras.map((c) => (
          <li key={c.id}>
            <div
              className={`camera-row ${c.id === selectedCameraId ? 'active' : ''} ${
                c.id === activeCameraId ? 'shooting' : ''
              } ${c.hidden ? 'is-hidden' : ''} ${c.locked ? 'is-locked' : ''}`}
              onClick={() => onSelect(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(c.id);
                }
              }}
            >
              <span className={`cam-dot ${c.id === activeCameraId ? 'live' : ''}`} />
              <span className="cam-name">{c.name}</span>
              <span className="cam-meta">
                {c.fov}° · {c.keyframes.length}帧
              </span>
              <span className="row-actions">
                <button
                  type="button"
                  className={`row-icon ${c.hidden ? 'off' : ''}`}
                  title={c.hidden ? '显示机位' : '隐藏机位'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(c.id, 'hidden');
                  }}
                >
                  <CameraIcon name={c.hidden ? 'eyeOff' : 'eye'} />
                </button>
                <button
                  type="button"
                  className={`row-icon ${c.locked ? 'on' : ''}`}
                  title={c.locked ? '解锁机位' : '锁定机位'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(c.id, 'locked');
                  }}
                >
                  <CameraIcon name={c.locked ? 'lock' : 'unlock'} />
                </button>
              </span>
            </div>
          </li>
        ))}
        {!cameras.length && <li className="cam-empty">还没有机位，点 + 新建一个</li>}
      </ul>

      {cam && (
        <div className="cam-controls">
          <div className="cam-transform-head">
            <span>变换</span>
            <div className="seg">
              {['translate', 'rotate', 'scale'].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={transformMode === m ? 'active' : ''}
                  onClick={() => onTransformMode(m)}
                  title={{ translate: '移动', rotate: '旋转', scale: '缩放' }[m]}
                >
                  {m === 'translate' ? '移动' : m === 'rotate' ? '旋转' : '缩放'}
                </button>
              ))}
            </div>
          </div>

          <div className="cam-row">
            <button
              type="button"
              className={`cam-btn ${cam.id === activeCameraId ? 'live' : ''}`}
              onClick={() => onActivate(cam.id)}
              title="设为当前拍摄机位，时间轴播放它"
            >
              {cam.id === activeCameraId ? '● 拍摄中' : '设为机位'}
            </button>
            <button
              type="button"
              className={`cam-btn ${lookThrough ? 'on' : ''}`}
              onClick={() => onLookThrough(!lookThrough)}
              title="主视图切到该机位取景"
            >
              {lookThrough ? '退出取景' : '进入取景'}
            </button>
          </div>

          <div className="cam-row">
            <button type="button" className="cam-btn" onClick={() => onLookFrom(cam.id)} title="导演视角移到机位后方">
              机位视角
            </button>
            <button type="button" className="cam-btn" onClick={() => onDuplicate(cam.id)} title="复制机位">
              复制
            </button>
            <button type="button" className="cam-btn danger" onClick={() => onDelete(cam.id)} title="删除机位">
              删除
            </button>
          </div>

          <div className="cam-field">
            <label>
              焦距
              <em>
                {cam.fov}° · {FOV_PRESETS.find((p) => p.value === cam.fov)?.label || '自定义'}
              </em>
            </label>
            <input
              type="range"
              min="12"
              max="100"
              step="1"
              value={cam.fov}
              onChange={(e) => onFov(cam.id, Number(e.target.value))}
            />
            <div className="fov-presets">
              {FOV_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={cam.fov === p.value ? 'active' : ''}
                  onClick={() => onFov(cam.id, p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cam-field">
            <label>
              运动轨迹<em>{cam.keyframes.length}</em>
            </label>
            <p className="cam-hint">点菱形节点拖拽 · 双击轨迹线在起点与终点之间加点</p>
            {cam.keyframes.length > 0 && (
              <ul className="keyframe-list">
                {cam.keyframes.map((k, i) => (
                  <li key={`${cam.id}-kf-${i}`}>
                    <button
                      type="button"
                      className={`keyframe-row ${selectedKeyframeIndex === i ? 'active' : ''}`}
                      onClick={() => onKeyframeSelect?.(i)}
                    >
                      <span
                        className={`kf-dot ${i === 0 ? 'start' : i === cam.keyframes.length - 1 ? 'end' : ''}`}
                      />
                      <span className="kf-label">
                        {i === 0 ? '起点' : i === cam.keyframes.length - 1 ? '终点' : `节点 ${i + 1}`}
                      </span>
                      <span className="kf-time">{(k.time ?? 0).toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="cam-row">
              <button
                type="button"
                className="cam-btn primary"
                disabled={cam.keyframes.length < 2}
                title={cam.keyframes.length < 2 ? '需要先有起点和终点' : '在起点与终点之间添加节点'}
                onClick={() => onCaptureKeyframe(cam.id)}
              >
                添加节点
              </button>
              <button
                type="button"
                className="cam-btn"
                disabled={cam.keyframes.length <= 2 || selectedKeyframeIndex == null}
                title={
                  cam.keyframes.length <= 2
                    ? '至少要保留起点和终点'
                    : selectedKeyframeIndex == null
                      ? '请先选中要删除的节点'
                      : '删除选中的节点'
                }
                onClick={() => onRemoveKeyframe(cam.id, selectedKeyframeIndex)}
              >
                删除选中
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
