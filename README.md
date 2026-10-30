# 3DBox

文本描述 → 3D 白模沙盘 + 相机运镜。用于镜头预演：先把镜头想清楚，再进视频模型。

## 技术栈

- 前端：React + Three.js（Vite 构建）
- 后端：FastAPI，调用 Claude 结构化输出生成场景 JSON
- 无 LLM 配置时自动降级为 3 个内置离线场景，UI 功能全部可用

## 运行

```bash
pip install -r requirements.txt
npm install
```

**开发模式**（热更新，双端口）

```bash
dev.cmd
```

后端 `:8000`，前端 `:8008`，Vite 把 `/api` 代理到后端。

**单进程模式**（先构建前端，FastAPI 一起托管）

```bash
run.cmd
```

## 接入真实模型

```bash
set ANTHROPIC_API_KEY=sk-ant-...
```

可选：`set SCENE_MODEL=claude-sonnet-5-5` 换更便宜的模型（默认 `claude-opus-5-5`）。

未配置 key 时后端返回内置示例场景，右上角状态栏会显示"离线示例场景"。

## 功能

| 区域 | 能力 |
| --- | --- |
| 底部输入框 | 文字生成场景；回车提交 |
| 场景调度 / 成片预览 | 编辑模式下有网格和轨迹线；预览模式隐藏辅助元素，并自动切换到当前机位取景 |
| 右侧对象列表 | 点选物体（也可直接点 3D 里的物体） |
| 检视面板 | 移动 / 旋转 / 缩放 gizmo，实时改物体变换，数字自动同步。缩放时自动隐藏机位环和轨迹导轨，让方块手柄不被遮挡 |
| 时间轴 | 播放当前机位的运镜、拖拽定格到任意帧、0.5×/1×/2× 变速 |
| 截帧 | 导出当前画面 PNG |
| 向下箭头按钮 | 导出场景 JSON |

## 导演台

左侧面板，把 LLM 生成的单条镜头延伸成可编辑的多机位系统。

| 操作 | 说明 |
| --- | --- |
| `+` | 新增机位。落在导演镜头前方偏右，不会挡住场景 |
| 点机位行 | 选中该机位，3D 视图中高亮并挂上 gizmo |
| 取景器 | 选中机位的实时画面（独立 WebGL canvas） |
| 设为机位 | 指定"拍摄中"机位，时间轴播放它的轨迹 |
| 进入取景 | 主视图直接切到该机位镜头 |
| 机位视角 | 导演相机跳到机位后方，看清它对着什么 |
| 复制 / 删除 | 复制整个机位含关键帧 |
| 焦距 | 12°–100° 滑块，或 5 档预设（超广角/广角/标准/长焦/特写） |
| 捕获当前视角 | 把当前导演视角存为该机位的一个关键帧 |

3D 视图里机位显示为相机模型 + FOV 视锥 + 指向主体的虚线瞄准线。相机机身是深灰机壳，带镜头筒、取景器凸起和侧手柄；外面套三色万向环：

| 环 | 颜色 | 拖动效果 |
| --- | --- | --- |
| 水平环 | 黄 | 左右摇镜（yaw） |
| 竖直环 | 红 | 上下俯仰（pitch） |
| 画面内环 | 蓝 | 滚转（roll） |

拖环时相机机身跟着转、视锥和瞄准线同步，环本身保持不动（像真实稳定器）。拖动 gizmo 平移整个机位。拍摄中的机位用橙色标示，其余为蓝色。

每个机位带自己的关键帧列表；机位有 2 帧以上时，轨迹线和播放都跟随该机位，否则回退到场景自带的 `camera_path`。

## 场景 JSON 格式

```json
{
  "title": "客厅推镜",
  "summary": "从门口推进到茶几",
  "objects": [
    {
      "name": "沙发", "type": "box",
      "pos": [0, 0.45, 0], "scale": [3, 0.9, 1],
      "rot": [0, 0, 0], "color": "#dedede"
    }
  ],
  "camera_path": [
    { "time": 0, "pos": [4, 1.6, 5], "lookAt": [0, 1, 0] }
  ]
}
```

- `type`: `box` | `sphere` | `cylinder`
- `scale` 是物体的完整尺寸，不是缩放倍数
- `camera_path` 至少 2 个关键帧，会被插值成 Catmull-Rom 平滑曲线
- 后端 `normalize()` 会兜底补全字段、排序关键帧、剔除坏数据

## API

- `POST /api/gen_scene` `{"text": "..."}` → 场景 JSON
- `GET /api/demo?kind=living|street|setup` → 内置场景
- `GET /api/health` → 模型与 key 状态

## 文件结构

```
main.py                    FastAPI 后端 + 离线场景 + 输出规整
src/App.jsx                UI 外壳、状态管理、机位增删改
src/Viewport.jsx           Three.js 场景、相机曲线、机位 rig、gizmo、取景器
src/CameraPanel.jsx        导演台面板
src/index.css              界面样式
scripts/smoke.mjs          浏览器端到端冒烟测试
scripts/drag-test.mjs      物体 gizmo 拖拽测试
scripts/camera-test.mjs    导演台功能测试
scripts/camera-drag-test.mjs 机位拖拽与取景器联动测试
scripts/gimbal-test.mjs    万向环拾取与旋转测试
scripts/no-camera-drift-test.mjs 拖动物体时相机不跟着动
scripts/scale-test.mjs     缩放模式与手柄拖拽测试
```

## 测试

后端和前端都起来之后：

```bash
npm run smoke
npm run test:drag
npm run test:camera
npm run test:camera-drag
```

截图输出到 `shots/`。需要本机装有 Chrome。
