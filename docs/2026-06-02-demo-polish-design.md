# cbct-viewer-demo: 폴리시 + WL/WW + 회전 mesh + 프로 도구 — Design

**Date:** 2026-06-02
**Status:** Draft (awaiting user review)
**Author:** Brainstorming session

## 1. Background & Goal

`cbct-viewer-demo`(`/Users/fotogrammer/Projects/cbct-viewer-demo`)는 `@volgl/renderer`를 Three.js 씬에 통합한 Vite + TypeScript 데모. 현재:

- 우측 320px 사이드바 + 뷰포트 그리드 레이아웃
- 다크 테마 + orange(`#ff8a3d`) + blue(`#58a6ff`) 액센트
- Drop zone + file picker (둘 다 이미 구현됨)
- Step size / ERT 슬라이더
- bone ↔ softTissue 프리셋 토글
- Auto-rotate 체크박스
- 씬: axes, grid, cube(orange), torus knot(blue), ground plane

큰 그림 (사용자 비전): Three.js 기반의 CBCT 3D 볼륨 렌더러를 단계적으로 만들어가고, **유려한 모델 표시 → ROI 수정 → 색상 적용** 같은 고급 도구를 차근차근 얹는 것. 이 spec은 그 첫 단계 — **지금 데모의 완성도/전문성 폴리시**에 집중한다. ROI/색조정은 별도 후속 spec.

**이 spec의 Goal**:
1. 데모의 시각적 완성도를 "전문 제품 데모" 수준으로 끌어올림
2. WL/WW 슬라이더 + LUNG 프리셋을 추가해 HU 컨트롤 노출
3. 카메라 리셋, FPS 카운터, dim/extent readout 등 운영 도구 추가
4. 기존 torus knot을 정적 → 회전으로 바꿔 데모의 생동감

**라이브러리 변경 최소화**: 셰이더/파이프라인은 손대지 않고, `TransferFunction1D`에 작은 API 추가 + `LUNG_PRESET` export + `VolumeRenderer.setWindowLevel/Width/setPreset` 위임 메서드 정도.

## 2. Non-Goals

- 2D MPR 뷰포트
- 모바일/태블릿 반응형
- ROI 그리기/측정/마스크 (Future work)
- 볼륨 컬러 매핑(임의 색상) (Future work)
- DICOM orientation (LPS/RAS) 적용 (이전 VolGL PR 범위 밖)
- 새 외부 의존성 추가

## 3. 결정 사항 (사용자 확정)

| # | 결정 | 선택 |
|---|---|---|
| 스타일 | 기존 dark + orange/blue 톤 유지, 카드/그림자/타이포 폴리시 | ✓ |
| 레이아웃 | 우측 320px 사이드바 유지 (현재 구조 존중) | ✓ |
| HU 컨트롤 | WL/WW 슬라이더 + LUNG 프리셋 칩 (BONE/SOFT/LUNG 3칩) | ✓ |
| 렌더 그룹 | Step / ERT 슬라이더 별도 유지 | ✓ |
| 3D mesh 애니메이션 | 기존 torus knot을 회전 (살짝, ~6°/s) | ✓ |
| 폴더 입력 | drop zone + file picker 유지 | ✓ |
| 추가 프로 기능 | FPS 카운터 + 카메라 리셋 버튼 + dim/extent readout | ✓ |

## 4. 현재 vs 신규 매트릭스

| 항목 | 현재 상태 | 이번 작업 |
|---|---|---|
| Drop zone + file picker | 있음 (`src/ui.ts:13`) | 손대지 않음 |
| Step/ERT 슬라이더 | 있음 | 손대지 않음 |
| bone/softTissue 프리셋 | 토글 버튼 (`src/ui.ts:108`) | 3칩 pill로 교체 + LUNG 추가 |
| Auto-rotate 체크박스 | 있음 (카메라 회전) | 손대지 않음 |
| Axes/grid/cube/ground | 있음 | 손대지 않음 |
| **Torus knot** | 정적 | **회전 추가** (매 프레임 Y축) |
| **WL/WW 슬라이더** | 없음 | **신규** (라이브러리 API 추가 동반) |
| **LUNG 프리셋** | 없음 | **신규** (라이브러리에 export) |
| **카메라 리셋** | 없음 | **신규** (fit-to-volume 로직) |
| **FPS 카운터** | 없음 | **신규** (rAF 카운터, 1Hz) |
| **Dim/extent readout** | 없음 (status에 텍스트만) | **신규** (mm extent 표시) |
| 디자인 폴리시 | dark/orange 단순 | **카드/그림자/타이포 개선** |

## 5. 디자인 토큰 (확정)

기존 토큰은 유지하고, 다음을 추가/정제:

| 토큰 | 값 | 비고 |
|---|---|---|
| `--bg` | `#0e1116` | body |
| `--panel` | `#161b22` | 사이드바 |
| `--panel-2` | `#1c232c` | 그룹 카드 (살짝 밝게) |
| `--border` | `#30363d` | 카드 테두리 |
| `--border-strong` | `#3a4148` | 입력 포커스 |
| `--text` | `#c9d1d9` | 본문 |
| `--muted` | `#8b949e` | 보조 |
| `--accent` | `#ff8a3d` | orange (이미 scene cube와 통일) |
| `--accent-2` | `#58a6ff` | blue (knot과 통일) |
| `--accent-grad` | `linear-gradient(135deg, #ff8a3d, #58a6ff)` | 액션 버튼, 활성 칩, 슬라이더 채움 |
| `--danger` | `#f85149` | 에러 |
| 그림자 | `0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 14px rgba(0,0,0,0.4)` | 카드 |
| `--radius-card` | `8px` | 그룹 카드 |
| `--radius-chip` | `10px` | 프리셋 칩 |

**타이포그래피**:
- h1: 16px 600 (현재 유지)
- 레이블: 11px 500 + letter-spacing 0.2px + `--muted` (한 단계 진하게)
- 값/숫자: 12px 500 + mono variant

**모션**:
- 슬라이더 호버: thumb이 살짝 글로우
- 프리셋 칩 호버: 배경 fade 120ms
- 카메라 리셋: 200ms ease로 복귀 (현재 OrbitControls의 damping과 충돌 없음)

## 6. 사이드바 구조 (신규)

```
<h1> CBCT Viewer Demo </h1>
<p class="subtitle"> @volgl/renderer · Three.js integration </p>

[ Drop zone (기존) ]

[ Status: dim/extent/FPS를 한 줄로 ]
   e.g. "800×800×5 · 160×160×1 mm · 60 FPS"

[ group: Transfer Function (카드) ]
   [BONE] [SOFT] [LUNG]      ← 3 pill chip (LUNG 신규)
   Window Level  ───●────   [ -200 ]
   Window Width  ──●─────   [ 1500 ]

[ group: Render (카드) ]
   Step size       ──●────   [ 0.010 ]
   Early ray term. ────●──   [ 0.99 ]

[ group: Camera (카드, 신규) ]
   [Reset view]   (full-width ghost button)

[ group: Scene (카드, 기존 체크박스) ]
   ☐ Auto-rotate

[ footer (설명 텍스트, 기존) ]
```

## 7. 컴포넌트

### 7.1 프리셋 칩 (3개)

- 위치: "Transfer Function" 그룹 맨 위
- 모양: 가로 3 pill, radius 10px, padding 5px 10px
- 비활성: 배경 `--panel-2`, 글자 `--muted`, border 1px `--border`
- 활성: 배경 `--accent-grad`, 글자 흰색, border 0
- 클릭: 즉시 `VolumeController.setPreset('bone' | 'softTissue' | 'lung')` 호출
- 기본 활성: bone (현재 `CBCT_PRESETS.bone` 사용하던 것과 동일)

### 7.2 WL/WW 슬라이더 (신규)

- 위치: "Transfer Function" 그룹, 프리셋 칩 아래
- 모양: 기존 `.group` + `.group label` + `input[type=range]` 재사용
- 라벨: `Window Level` / `Window Width`, 값 mono tabular-nums
- 범위:
  - WL: `[-1000, 3000]`, step 1
  - WW: `[50, 4000]`, step 1
- 트랙: 4px (기존 1줄 input보다 살짝 두껍게), 채움 `--accent-grad`
- 드래그: `input` 이벤트마다 `VolumeController.setWindowLevel(level, width)` 호출
- 동작 모델 — **WL/WW은 현재 활성 preset 위에 윈도잉으로 적용**:
  - 사용자가 프리셋(BONE/SOFT/LUNG)을 고르면, 그 preset의 `domain`/`controlPoints`가 `TransferFunction1D`에 로드됨
  - 사용자가 WL/WW 슬라이더를 움직이면, **현재 transfer function의 `domain`을 `[level - width/2, level + width/2]`로 재매핑**하고 control points는 새 domain 안에서 비례 재배치
  - 즉, 프리셋이 골라주는 "색/투명도 곡선 형태"는 유지하면서 "어떤 HU 구간을 볼지"만 WL/WW가 조절 (방사선 의사 워크플로와 일치)
  - 프리셋을 바꾸면 WL/WW는 해당 preset의 기본값으로 리셋 (예: BONE → WL=400/WW=1500, SOFT → WL=50/WW=400, LUNG → WL=-600/WW=1500)
- 라이브러리 API: `TransferFunction1D.setWindowLevel(level, width)`가 `domain` 재매핑 + control points 재배치 후 `buildLut()` 트리거
  - 셰이더는 변경 없음 (LUT만 다시 샘플)

### 7.3 Step / ERT 슬라이더 (기존 유지)

- 위치: "Render" 그룹
- 모양/범위/동작: 현재 그대로
- 단, 트랙을 4px로 통일 (디자인 일관성)

### 7.4 Camera reset 버튼 (신규)

- 위치: "Camera" 그룹 (신규 그룹, presets/render와 같은 카드 스타일)
- 모양: full-width ghost button (`--panel-2` 배경, 1px `--border`)
- 라벨: `Reset view` + 작은 🔄 아이콘
- 동작: 카메라 fit-to-volume + OrbitControls.target을 `(0,0,0)`으로 복귀
- 비활성: `vol`에 volume 없으면 `disabled` (회색)
- 보너스: 200ms ease로 부드럽게 복귀 (OrbitControls의 damping과 자연스럽게 어울림)

### 7.5 dim/extent/FPS status (신규)

- 위치: drop zone 아래 (기존 `#status` 자리)
- 형식: 단일 라인, mono, 11px
- 내용:
  - idle: "Awaiting DICOM data." (현재)
  - loading: "Loading N file(s)…"
  - loaded: "W×H×D · ex×ey×ez mm · FPS N"
  - error: 빨간색
- 색: 기본 `--muted`, 로딩 중 `--accent-2`, 에러 `--danger`

### 7.6 Torus knot 회전 (신규)

- 위치: scene-objects.ts의 `knot` mesh
- 동작: `mesh.rotation.y += delta * 0.1` (rad/frame, 약 6°/s) — render loop `tick()`에서
- delta: `clock.getDelta()` 사용 (현재 cbct-viewer-demo는 `clock` 안 쓰므로 도입 필요)
- 자기 자신만 회전, 카메라 auto-rotate와 독립

## 8. 데이터 흐름

```
[file/drop] ─► FileList
                 │
                 ▼
       controller.setVolume(files)
                 │
                 ▼
        VolumeData (dicom loaded)
                 │
                 ├─► vol.setVolume(data) (라이브러리)
                 │
                 ├─► status.text = "Loading N file(s)…"
                 │
                 ├─► status.text = "W×H×D · ex×ey×ez mm · FPS N"
                 │
                 └─► cameraResetEnabled = true   (Reset view 활성)

[preset chip] ─► controller.setPreset('bone'|'softTissue'|'lung')
                    │
                    └─► vol.setPreset(name) → TransferFunction1D.setTransferFunction(CBCT_PRESETS[name]) → rayMarch.setTransferFunction(lut)

[WL/WW slider] ─► controller.setWindowLevel(level, width)
                     │
                     └─► vol.setWindowLevel(level, width) → TransferFunction1D.setWindowLevel/Width(level, width) → rebuild LUT with windowing → rayMarch.setTransferFunction(lut)

[Step/ERT slider] ─► vol.setStepSize(v) / vol.setEarlyRayTermination(v)  (기존)

[Reset view] ─► cameraFitToVolume() + controls.target.set(0,0,0) + controls.update()
                    │
                    └─► 200ms ease (tween)

[FPS]  ─► rAF 카운터, 1초마다 카운터 리셋 + status 갱신
[Tick] ─► knot.rotation.y += clock.getDelta() * 0.1
```

## 9. Three.js 씬 (변경)

```
Scene
├─ AmbientLight(0xffffff, 0.55)
├─ DirectionalLight(0xffffff, 0.9) at (3,4,2)
├─ DirectionalLight(0xa0b8ff, 0.3) at (-3,2,-1)
├─ AxesHelper(1.0)
├─ GridHelper(10, 20, 0x444c56, 0x2a313a) at y=-0.5
├─ Mesh cube (BoxGeometry 0.4³, 0xff8a3d) at (0.7, 0, 0)     ← 정적 유지
├─ Mesh knot (TorusKnotGeometry, 0x58a6ff) at (-0.7, 0, 0)   ← 회전 추가
├─ Mesh ground (CircleGeometry, 0x20262e)                     ← 정적 유지
└─ VolumeRenderer.root
    ├─ back-face mesh (scaled to mm)                          ← VolGL PR 이전 변경
    └─ ray-march mesh (scaled to mm)                          ← VolGL PR 이전 변경

Camera: PerspectiveCamera(45, ...) — reset 버튼이 fit-to-volume 호출
Controls: OrbitControls — target (0,0,0), damping
Clock: THREE.Clock() — knot 회전 delta 계산용
Render loop: tick() 안에 knot 회전 + controls.update() + renderer.render()
```

**fit-to-volume 로직** (cbct-viewer-demo에 새로 도입):
- VolGL/demo의 `dist = (maxExtent * 0.6) / tan(fovRad * 0.5)` 공식을 그대로 사용
- `mesh.scale = dims × spacing`은 VolGL에서 이미 적용됨 (이전 PR)
- cbct-viewer-demo의 `vol.setVolume()` 다음에 호출

## 10. 라이브러리 API 추가 (VolGL 변경)

### 10.1 `src/core/transfer-function.ts`

- `LUNG_PRESET: TransferFunction` 신규 export
  - domain `[-1100, -200]` (폐 공기/연부조직 범위)
  - controlPoints: 공기(투명) → 폐 실질(연한 청회색) → 연부조직(살짝) → 혈관(선)
- `TransferFunction1D`에 `setWindowLevel(level, width)` 추가
  - 현재 `domain`을 `[level - width/2, level + width/2]`로 재매핑
  - 기존 control points의 density를 새 domain에 대해 비례 재배치 (즉, 가장 작은/큰 control point가 새 domain 경계에 맞춰 정규화)
  - `buildLut()`을 호출해 LUT 재빌드
- 결정: 슬라이더 동작 모델은 7.2절에 명시 (프리셋 위에 윈도잉). preset 선택 시 라이브러리가 그 preset의 기본 level/width로 reset (라이브러리 `setTransferFunction`이 `setWindowLevel`을 무효화)

### 10.2 `src/renderer/presets.ts`

- `CBCT_PRESETS`에 `lung: LUNG_PRESET as TransferFunction` 추가

### 10.3 `src/renderer/volume-renderer.ts`

- `setWindowLevel(level: number, width: number): void` 추가
- `setPreset(name: 'bone' | 'softTissue' | 'lung'): void` 추가 (라이브러리 디폴트는 cbct-viewer-demo에서 쓸 일은 없을 수도 있지만 일관성 위해)

### 10.4 영향받지 않는 파일 (라이브러리)

- `src/three/volume-core.ts` — `setVolume`의 mesh scale, 카메라 fit 그대로
- `src/three/back-face-pass.ts`, `src/three/ray-march-pass.ts` — 셰이더/파이프라인 그대로
- `src/core/shaders/*` — 셰이더 변경 없음
- `src/dicom/dicom-adapter.ts` — DICOM 파싱 그대로
- 기존 테스트 — 모두 그대로

## 11. cbct-viewer-demo 파일 변경

| 파일 | 변경 종류 |
|---|---|
| `index.html` | 디자인 토큰 추가/정제, 사이드바 그룹 카드화, 프리셋 3칩 + WL/WW + Camera 그룹 + dim/extent/FPS 통합 status |
| `src/main.ts` | `VolumeController`에 `setWindowLevel/Width`, `setPreset` 추가. `cameraFitToVolume()` 추가. `Clock` 도입, knot 회전. reset/camera wiring |
| `src/ui.ts` | 기존 `bindUi` 확장: 3칩 프리셋 + WL/WW 슬라이더 + Camera 리셋 + dim/extent/FPS status |
| `src/scene-objects.ts` | 변경 없음 (knot은 main.ts에서 회전) |
| `src/__tests__/*` | UI 단위 테스트는 없음 (현재도 없음). 수동 검증으로 충분 |

## 12. 테스트

### 라이브러리 유닛 (VolGL)
- `src/__tests__/core/transfer-function.test.ts` (신규) — `LUNG_PRESET` 유효성, `setWindowLevel/Width`이 LUT을 변경하는지
- `src/__tests__/renderer/presets.test.ts` (신규) — `CBCT_PRESETS.lung`이 `TransferFunction` 형태인지

### 수동 검증 (Playwright, cbct-viewer-demo)
1. `npm run dev`로 vite 띄움 (5180 포트 가정)
2. 브라우저에서:
   - DICOM 5개 드롭 → 사이드바 status에 "800×800×5 · 160×160×1 mm · 60 FPS" 표시 확인
   - 프리셋 3칩 (BONE/SOFT/LUNG) 클릭 → 외관 변화
   - WL 슬라이더 → 색/대비 변화
   - WW 슬라이더 → 동일
   - Step/ERT 슬라이더 → 기존처럼 동작
   - Reset view → 카메라 fit 위치로 복귀 (부드럽게)
   - Auto-rotate → 카메라 궤도 회전
   - Torus knot이 자체적으로도 천천히 회전 (auto-rotate와 독립)
   - FPS 숫자가 1Hz로 갱신
3. 콘솔 에러 0건, 경고는 favicon 404만 허용
4. 스크린샷 1장 캡처해서 사이드바 그룹 카드 + 뷰포트 + knot 회전 + 슬라이더 다 보이는지

## 13. 영향받는 라이브러리 파일 (요약)

| 파일 | 변경 종류 |
|---|---|
| `VolGL/src/core/transfer-function.ts` | `LUNG_PRESET` export, `setWindowLevel/Width` 메서드 |
| `VolGL/src/renderer/presets.ts` | `CBCT_PRESETS.lung` 추가 |
| `VolGL/src/renderer/volume-renderer.ts` | `setWindowLevel`, `setPreset` 메서드 |
| `VolGL/src/__tests__/core/transfer-function.test.ts` (신규 가능) | 단위 테스트 |
| `VolGL/src/__tests__/renderer/presets.test.ts` (신규 가능) | 단위 테스트 |

## 14. 리스크 / 주의

- **라이브러리 API 추가 후 마이너 버전 bump 필요**: cbct-viewer-demo는 VolGL을 로컬 파일로 import (workspace). cbct-viewer-demo의 `package.json`에서 `@volgl/renderer`가 `file:../VolGL` 같은 식으로 참조되고 있는지 확인 필요. (이번 spec의 PR에 bump 동반)
- **셰이더 미변경**: WL/WW는 LUT 빌드 시 반영 → 셰이더는 그대로. 검증된 ray-march 코드 보존.
- **Camera fit-to-volume과 기존 카메라 위치 충돌**: cbct-viewer-demo의 초기 카메라 위치 `(2.2, 1.6, 2.4)`는 단위 큐브 기준. Volume이 mm 스케일(예: 160×160×1)이면 fit 거리 ~500mm로 카메라가 멀어짐. Reset view는 fit 위치로, 초기 로드 시점에도 fit 적용. (단, 빈 상태에서는 단위 큐브 위치 유지)
- **Torus knot 회전 delta 안정성**: `THREE.Clock`의 첫 frame delta가 0이 아닐 수 있어 첫 회전이 살짝 점프할 수 있음. 첫 frame guard(`if (delta > 0.1) delta = 0.016`) 추가.
- **FPS 카운터가 status 텍스트를 매초 갱신**: 1Hz 갱신은 가벼움. 다만 volume이 회전/리사이즈로 render 비용이 바뀌면 FPS가 흔들리는 게 정상이라 사용자 시연 시 변동 OK.
- **LUNG 프리셋은 DICOM HU 스케일 가정**: 모든 CBCT가 HU를 쓰진 않음 (일부는 0~1 normalized). 5슬라이스 테스트 데이터가 HU를 쓰는지(grep "RescaleIntercept"로 확인) — 이번 spec 범위에서 LUNG의 domain을 보수적으로 잡고, 잘 안 보이면 사용자 워크플로에서 bone/softTissue로 폴백.
- **드래그 중 topbar 글로우**: cbct-viewer-demo는 drop zone에 이미 hover 스타일 있음. 추가 글로우 없음.

## 15. Future work (사용자 비전)

이 spec은 "전문성 폴리시"까지. 사용자가 언급한 큰 그림 — Three.js 기반 CBCT 3D 뷰어 — 의 다음 단계:

1. **ROI 도구**: 박스/구/폴리곤 ROI, 마스크 export
2. **클리핑 평면**: 6축 슬라이스, obliques
3. **컬러 매핑**: 임의 색상 LUT (현재 bone/softTissue/lung 고정 → 사용자 정의)
4. **측정**: 거리/각도/볼륨 계산
5. **애니메이션 트랜지션**: preset/slider 변경 시 보간
6. **DICOM orientation (LPS/RAS)**: 5슬라이스 데이터가 뒤집혀 보이는 이슈 해결
7. **DICOM 메타데이터 패널**: 환자/시리즈/슬라이스 정보
8. **세그멘테이션 export**: STL로 변환 (별도 `cbct2stl` 프로젝트와 연동 가능)
9. **WebGPU 폴백**: Three.js의 WebGPURenderer로 동일 로직 재구현

각 항목은 별도 spec으로 다룰 예정.
