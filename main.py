"""3DBox backend: prompt -> structured 3D scene JSON.

Run:  python main.py
Frontend dev server: npm run dev  (Vite proxies /api to this server)
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).parent
DIST = ROOT / "dist"

MODEL = os.getenv("SCENE_MODEL", "claude-opus-5-5")

app = FastAPI(title="3DBox Scene Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8008", "http://127.0.0.1:8008", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """你是 3D 白模沙盘的场景设计师。根据用户的文字描述，设计一个可以用基础几何体搭建的 3D 场景，并设计一段镜头运动。

设计原则：
- 只使用 box / sphere / cylinder 三种基础体，靠比例和摆放表达物体，不要试图做细节。
- 场景要有地面感：至少一个扁平的大 box 作为地板或底座。
- 物体之间不能明显穿插，落地物体要贴合 y=0 平面（pos[1] 约等于 scale[1]/2）。
- 尺度统一用「米」：房间高度约 3，沙发长约 2，茶几高约 0.45。
- 物体的 scale 是它在世界坐标下的完整尺寸，不是缩放倍数。
- color 用接近白色的灰阶（#c0c0c0 ~ #f0f0f0）体现白模质感，偶尔用低饱和度色做点缀。
- camera_path 是一段有运镜叙事的镜头：至少 3 个关键点，时间 0 到 1 递增。
  常见运镜：从门口缓慢推进、环绕主体、低角度仰拍、从高处俯冲。
  镜头高度保持在 1.2~4 之间，不要穿模到物体内部。
- lookAt 是要看的焦点，通常落在主体物上，不要所有关键点都看同一点。"""

SCENE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "场景标题，6 字以内"},
        "summary": {"type": "string", "description": "一句话说明镜头设计思路"},
        "objects": {
            "type": "array",
            "description": "场景中的白模物体，5-20 个",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string", "enum": ["box", "sphere", "cylinder"]},
                    "pos": {"type": "array", "items": {"type": "number"}},
                    "scale": {"type": "array", "items": {"type": "number"}},
                    "rot": {"type": "array", "items": {"type": "number"}},
                    "color": {"type": "string"},
                },
                "required": ["name", "type", "pos", "scale", "color"],
                "additionalProperties": False,
            },
        },
        "camera_path": {
            "type": "array",
            "description": "镜头关键帧，按 time 升序",
            "items": {
                "type": "object",
                "properties": {
                    "time": {"type": "number"},
                    "pos": {"type": "array", "items": {"type": "number"}},
                    "lookAt": {"type": "array", "items": {"type": "number"}},
                },
                "required": ["time", "pos", "lookAt"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "summary", "objects", "camera_path"],
    "additionalProperties": False,
}


class PromptRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def box(name: str, pos, scale, color="#dedede", rot=None) -> dict:
    o = {"name": name, "type": "box", "pos": list(pos), "scale": list(scale), "color": color}
    if rot:
        o["rot"] = list(rot)
    return o


def ball(name: str, pos, scale, color="#d2d2d2") -> dict:
    return {"name": name, "type": "sphere", "pos": list(pos), "scale": list(scale), "color": color}


def cyl(name: str, pos, scale, color="#d8d8d8") -> dict:
    return {"name": name, "type": "cylinder", "pos": list(pos), "scale": list(scale), "color": color}


DEMO_SCENES: dict[str, dict[str, Any]] = {
    "living": {
        "title": "客厅推镜",
        "summary": "从门口缓慢推进到茶几，最后摇向沙发，营造访客入室的第一视角。",
        "objects": [
            box("地板", [0, -0.05, 0], [9, 0.1, 8], "#e8e8e8"),
            box("地毯", [0, 0.03, 0.2], [5.4, 0.06, 4.0], "#f2f2f2"),
            box("沙发", [-0.2, 0.45, -2.2], [3.0, 0.9, 0.95], "#e0e0e0"),
            box("沙发靠背", [-0.2, 0.95, -2.6], [3.0, 0.95, 0.3], "#dcdcdc"),
            box("茶几", [0, 0.22, 0.4], [1.8, 0.44, 0.95], "#d6d6d6"),
            box("电视柜", [0, 0.3, 2.6], [2.6, 0.6, 0.5], "#d0d0d0"),
            box("电视", [0, 1.25, 2.72], [1.6, 0.9, 0.08], "#c8c8c8"),
            ball("花瓶", [0.7, 0.62, 0.35], [0.36, 0.5, 0.36], "#c9c9c9"),
            cyl("落地灯", [-2.6, 0.75, -2.0], [0.12, 1.5, 0.12], "#c4c4c4"),
            box("门框", [3.9, 1.1, 3.4], [1.4, 2.2, 0.14], "#ececec"),
        ],
        "camera_path": [
            {"time": 0.0, "pos": [3.4, 1.65, 5.2], "lookAt": [0, 1.0, -0.6]},
            {"time": 0.35, "pos": [1.6, 1.5, 2.6], "lookAt": [0, 0.9, -0.2]},
            {"time": 0.7, "pos": [0.2, 1.35, 1.0], "lookAt": [0, 0.6, 0.4]},
            {"time": 1.0, "pos": [-0.5, 1.6, -0.4], "lookAt": [-0.2, 0.9, -2.2]},
        ],
    },
    "street": {
        "title": "街区横移",
        "summary": "贴地横移掠过街区，尾段抬起上升，交代整体体量。",
        "objects": [
            box("路面", [0, -0.05, 0], [18, 0.1, 14], "#e9e9e9"),
            box("人行道", [0, 0.08, -4.2], [18, 0.16, 2.4], "#f2f2f2"),
            box("建筑A", [-4.6, 3.0, -1.0], [3.0, 6.0, 3.4], "#dcdcdc"),
            box("建筑B", [-0.4, 4.0, -2.0], [3.6, 8.0, 3.0], "#d4d4d4"),
            box("建筑C", [4.4, 2.4, -1.4], [2.8, 4.8, 3.2], "#e2e2e2"),
            box("建筑D", [8.6, 3.6, -2.4], [2.6, 7.2, 2.8], "#d8d8d8"),
            box("路灯1", [-2.6, 1.6, -3.6], [0.12, 3.2, 0.12], "#c6c6c6"),
            box("路灯2", [3.2, 1.6, -3.6], [0.12, 3.2, 0.12], "#c6c6c6"),
            ball("树冠1", [-8.2, 2.2, -3.2], [1.8, 1.8, 1.8], "#cfcfcf"),
            cyl("树干1", [-8.2, 0.8, -3.2], [0.16, 1.6, 0.16], "#bfbfbf"),
            box("马路标线", [0, 0.02, 2.2], [16, 0.02, 0.16], "#fafafa"),
        ],
        "camera_path": [
            {"time": 0.0, "pos": [-9.0, 1.6, 4.6], "lookAt": [-4.6, 2.2, -1.0]},
            {"time": 0.4, "pos": [-3.2, 1.5, 4.2], "lookAt": [-0.4, 2.6, -2.0]},
            {"time": 0.7, "pos": [2.6, 1.7, 4.4], "lookAt": [4.4, 2.2, -1.4]},
            {"time": 1.0, "pos": [7.6, 6.0, 6.8], "lookAt": [1.0, 2.4, -1.4]},
        ],
    },
    "setup": {
        "title": "主体环绕",
        "summary": "半环绕主体的缓慢运镜，最后压近形成特写。",
        "objects": [
            box("展台", [0, 0.15, 0], [7, 0.3, 7], "#ececec"),
            box("主体", [0, 1.3, 0], [1.8, 2.0, 1.8], "#e6e6e6"),
            box("侧翼L", [-1.6, 0.65, 0.9], [0.8, 1.0, 0.8], "#dadada"),
            box("侧翼R", [1.6, 0.9, -0.6], [0.8, 1.5, 0.8], "#dadada"),
            ball("球体", [2.2, 0.55, 1.8], [1.1, 1.1, 1.1], "#d0d0d0"),
            cyl("立柱", [-2.6, 1.1, -1.8], [0.4, 2.2, 0.4], "#d6d6d6"),
        ],
        "camera_path": [
            {"time": 0.0, "pos": [6.4, 3.2, 6.4], "lookAt": [0, 1.3, 0]},
            {"time": 0.35, "pos": [7.2, 2.4, -0.6], "lookAt": [0, 1.3, 0]},
            {"time": 0.7, "pos": [0.6, 2.0, -7.0], "lookAt": [0, 1.3, 0]},
            {"time": 1.0, "pos": [-1.6, 1.45, -3.4], "lookAt": [0, 1.3, 0]},
        ],
    },
}


def pick_demo(prompt: str) -> dict[str, Any]:
    p = prompt.lower()
    if any(k in p for k in ("客厅", "房间", "室内", "沙发", "living", "room", "interior")):
        return DEMO_SCENES["living"]
    if any(k in p for k in ("街道", "城市", "建筑", "街区", "street", "city", "building")):
        return DEMO_SCENES["street"]
    return DEMO_SCENES["setup"]


def extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("模型返回中没有 JSON 对象")
    return json.loads(text[start : end + 1])


def normalize(scene: dict[str, Any]) -> dict[str, Any]:
    """兜底：补全缺省字段、纠正数量、按时间排序关键帧。保证前端拿到的东西一定能渲染。"""
    objects: list[dict[str, Any]] = []
    for i, raw in enumerate(scene.get("objects") or []):
        if not isinstance(raw, dict):
            continue
        kind = raw.get("type") if raw.get("type") in ("box", "sphere", "cylinder") else "box"
        pos = [float(x) for x in (raw.get("pos") or [0, 0, 0])[:3]] or [0, 0, 0]
        scale = [float(x) for x in (raw.get("scale") or [1, 1, 1])[:3]] or [1, 1, 1]
        while len(pos) < 3:
            pos.append(0.0)
        while len(scale) < 3:
            scale.append(1.0)
        scale = [max(0.02, s) for s in scale]
        rot = [float(x) for x in (raw.get("rot") or [])[:3]]
        rot += [0.0] * (3 - len(rot))
        objects.append(
            {
                "id": f"obj_{i}",
                "name": str(raw.get("name") or f"物体{i + 1}")[:24],
                "type": kind,
                "pos": pos,
                "scale": scale,
                "rot": rot,
                "color": str(raw.get("color") or "#dedede"),
            }
        )

    if not objects:
        objects = [dict(o) for o in DEMO_SCENES["setup"]["objects"]]

    path = []
    for kf in scene.get("camera_path") or []:
        if not isinstance(kf, dict):
            continue
        try:
            path.append(
                {
                    "time": float(kf.get("time", 0)),
                    "pos": [float(x) for x in kf["pos"][:3]],
                    "lookAt": [float(x) for x in kf["lookAt"][:3]],
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    path.sort(key=lambda k: k["time"])
    for i, kf in enumerate(path):
        kf["time"] = max(0.0, min(1.0, kf["time"]))
    if len(path) < 2:
        path = [dict(k) for k in DEMO_SCENES["setup"]["camera_path"]]

    return {
        "title": str(scene.get("title") or "未命名场景")[:24],
        "summary": str(scene.get("summary") or "")[:200],
        "objects": objects,
        "camera_path": path,
        "source": scene.get("source", "demo"),
    }


def call_llm(prompt: str) -> dict[str, Any]:
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("未安装 anthropic SDK，执行 pip install anthropic")

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        system=SYSTEM_PROMPT,
        output_config={
            "format": {"type": "json_schema", "schema": SCENE_SCHEMA},
            "effort": "medium",
        },
        messages=[{"role": "user", "content": prompt}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("模型拒绝生成该场景")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


@app.post("/api/gen_scene")
def gen_scene(req: PromptRequest):
    try:
        scene = call_llm(req.text)
        scene["source"] = "llm"
        return normalize(scene)
    except Exception as exc:  # 没有 key / 网络失败 / 解析失败，都退回离线 demo
        return JSONResponse(
            normalize({**pick_demo(req.text), "source": "demo", "error": str(exc)}),
            headers={"X-Scene-Source": "demo"},
        )


@app.get("/api/health")
def health():
    return {"ok": True, "model": MODEL, "anthropic": _has_anthropic()}


def _has_anthropic() -> bool:
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


@app.get("/api/demo")
def demo(kind: str = "setup"):
    return normalize({**DEMO_SCENES.get(kind, DEMO_SCENES["setup"]), "source": "demo"})


# ---- static frontend (built by `npm run build`) ----
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
else:

    @app.get("/")
    def no_build():
        return JSONResponse(
            {
                "hint": "前端尚未构建。开发模式：npm run dev → http://localhost:8008",
                "api": "/api/gen_scene",
            }
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
