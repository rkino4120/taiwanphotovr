import {
  useRef,
  useMemo,
  Suspense,
  useState,
  useEffect,
  useCallback,
  memo,
  type RefObject,
  type CSSProperties,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { XR, createXRStore, useXR } from '@react-three/xr';
import { OrbitControls, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useWorks } from './hooks/useWorks';
import type { Work } from './types/work';

// --- 定数・ユーティリティ関数 ---

const FLOOR_Y = 0;
const FONT_URL = './fonts/NotoSansJP-Regular.ttf';
const MAX_FRAME_DELTA = 0.1;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function htmlToText(html: string): string {
  if (!html) return '';
  const replaced = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  const doc = new DOMParser().parseFromString(replaced, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

function formatShootingDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function getTextureDimensions(texture: THREE.Texture): { width: number; height: number } | null {
  const img = texture.image as { width?: number; height?: number } | undefined;
  if (img && typeof img.width === 'number' && typeof img.height === 'number' && img.height > 0) {
    return { width: img.width, height: img.height };
  }
  return null;
}

// XRストアの作成（本番ではエミュレータ無効、VR専用オファー、Foveated Rendering有効）
const store = createXRStore({
  emulate: import.meta.env.DEV ? 'metaQuest3' : false,
  offerSession: 'immersive-vr',
  foveation: 1,
});

// --- 3D コンポーネント群 ---

const Ground = memo(function Ground() {
  const [colorMap, roughnessMap] = useTexture(
    ['./images/concrete_diff.jpg', './images/concrete_rough.png'],
    ([c, r]) => {
      for (const tex of [c, r]) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(5, 5);
      }
      // 色用テクスチャは sRGB、bump/roughness 用は非カラー（線形）として扱う
      c.colorSpace = THREE.SRGBColorSpace;
      r.colorSpace = THREE.NoColorSpace;
      c.needsUpdate = true;
      r.needsUpdate = true;
    },
  );

  return (
    <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 12]} />
      <meshStandardMaterial map={colorMap} bumpMap={roughnessMap} bumpScale={0.1} />
    </mesh>
  );
});

const FloatingBoard = memo(function FloatingBoard({
  onPrev,
  onNext,
}: {
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [frontTex, backTex] = useTexture(
    ['./images/frontpage.webp', './images/profilepage.webp'],
    (textures) => {
      for (const tex of textures) {
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      }
    },
  );

  const DEFAULT_HEIGHT = 0.5;
  const aspect = useMemo(() => {
    const dims = getTextureDimensions(frontTex);
    return dims ? dims.width / dims.height : 1.5;
  }, [frontTex]);

  const HEIGHT = DEFAULT_HEIGHT;
  const WIDTH = HEIGHT * aspect;
  const EPS = 0.001;
  const DURATION = 0.6;

  const [flipped, setFlipped] = useState(false);
  const animRef = useRef({ start: 0, end: 0, t: 1 });
  const currentY = useRef(0);
  const boardRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (animRef.current.t < 1) {
      const dt = Math.min(delta, MAX_FRAME_DELTA);
      animRef.current.t = Math.min(1, animRef.current.t + dt / DURATION);
      const eased = easeInOutCubic(animRef.current.t);
      currentY.current = THREE.MathUtils.lerp(animRef.current.start, animRef.current.end, eased);
      if (boardRef.current) {
        boardRef.current.rotation.y = currentY.current;
      }
    }
  });

  const toggleFlip = useCallback(() => {
    const from = currentY.current;
    const to = flipped ? 0 : Math.PI;
    animRef.current = { start: from, end: to, t: 0 };
    setFlipped((f) => !f);
  }, [flipped]);

  return (
    <group position={[0, FLOOR_Y + 1.3, -1.3]}>
      <group ref={boardRef} rotation={[0, 0, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[WIDTH + 0.04, HEIGHT + 0.04, 0.02]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        <mesh
          position={[0, 0, EPS + 0.015]}
          onPointerDown={toggleFlip}
          receiveShadow={false}
          castShadow={false}
        >
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {/* 正面 */}
        <mesh
          position={[0, 0, 0.011]}
          rotation={[0, 0, 0]}
          receiveShadow={false}
          castShadow={false}
        >
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial map={frontTex} side={THREE.FrontSide} toneMapped={false} />
        </mesh>

        {/* 裏面 */}
        <mesh
          position={[0, 0, -0.011]}
          rotation={[0, Math.PI, 0]}
          receiveShadow={false}
          castShadow={false}
        >
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial map={backTex} side={THREE.FrontSide} toneMapped={false} />
        </mesh>
      </group>

      {/* 左矢印 */}
      <group position={[-WIDTH / 2 - 0.25, 0, 0]}>
        <mesh
          onPointerDown={(e) => {
            e.stopPropagation();
            onPrev?.();
          }}
          onPointerEnter={(e) => {
            (e.object as THREE.Mesh).scale.set(1.2, 1.2, 1.2);
          }}
          onPointerLeave={(e) => {
            (e.object as THREE.Mesh).scale.set(1, 1, 1);
          }}
          rotation={[Math.PI / 2, 0, Math.PI / 2]}
        >
          <coneGeometry args={[0.04, 0.18, 24]} />
          <meshStandardMaterial color="#dddddd" emissive="#dddddd" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, -0.12, 0]}
          fontSize={0.03}
          color="white"
          anchorX="center"
          anchorY="top"
          font={FONT_URL}
          outlineWidth={0.005}
          outlineColor="#000000"
          maxWidth={1}
          renderOrder={1}
        >
          前へ
        </Text>
      </group>

      {/* 右矢印 */}
      <group position={[WIDTH / 2 + 0.25, 0, 0]}>
        <mesh
          onPointerDown={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          onPointerEnter={(e) => {
            (e.object as THREE.Mesh).scale.set(1.2, 1.2, 1.2);
          }}
          onPointerLeave={(e) => {
            (e.object as THREE.Mesh).scale.set(1, 1, 1);
          }}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
        >
          <coneGeometry args={[0.04, 0.18, 24]} />
          <meshStandardMaterial color="#dddddd" emissive="#dddddd" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, -0.12, 0]}
          fontSize={0.03}
          color="white"
          anchorX="center"
          anchorY="top"
          font={FONT_URL}
          outlineWidth={0.005}
          outlineColor="#000000"
          maxWidth={1}
          renderOrder={1}
        >
          次へ
        </Text>
      </group>
    </group>
  );
});

// BGM を制御する 3D UI（FloatingBoard の下に配置）
const Bgm3DControls = memo(function Bgm3DControls({
  position = [0, FLOOR_Y + 1.0, -1.3],
  bgmEnabled,
  toggleBgm,
}: {
  position?: [number, number, number];
  bgmEnabled: boolean;
  toggleBgm: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <group position={position}>
      <mesh
        position={[0, -0.09, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          toggleBgm();
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[0.2, 0.08, 0.02]} />
        <meshStandardMaterial
          color={hover ? 0x88ccff : 0x666666}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
      <Text
        position={[0, -0.08, 0.03]}
        rotation={[0, 0, 0]}
        fontSize={0.02}
        color="white"
        anchorX="center"
        anchorY="middle"
        font={FONT_URL}
      >
        {bgmEnabled ? 'Pause BGM' : 'Play BGM'}
      </Text>
    </group>
  );
});

const PhotoFrame = memo(function PhotoFrame({
  url,
  position = [-0.89, FLOOR_Y + 1.5, 0],
  rotation = [0, Math.PI / 2, 0],
  title,
  body,
  shootingdate,
  index,
}: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  title?: string;
  body?: string;
  shootingdate?: string;
  index?: number;
}) {
  // VRパフォーマンス向上のためテクスチャ設定を最適化
  const texture = useTexture(url, (tex) => {
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  });

  const { width, height } = useMemo(() => {
    const dims = getTextureDimensions(texture);
    const h = 0.75;
    if (dims) {
      return { width: h * (dims.width / dims.height), height: h };
    }
    return { width: h, height: h };
  }, [texture]);

  const bodyText = useMemo(() => (body ? htmlToText(body) : ''), [body]);
  const formattedDate = useMemo(
    () => (shootingdate ? formatShootingDate(shootingdate) : ''),
    [shootingdate],
  );

  const GLOBAL_Y_SHIFT = 0.3;
  const localPos: [number, number, number] = [
    position[0],
    position[1] + GLOBAL_Y_SHIFT,
    position[2],
  ];
  const indexLabel = typeof index === 'number' ? String(index).padStart(2, '0') : null;

  return (
    <group position={localPos} rotation={rotation}>
      <mesh position={[0, 0, -0.015]}>
        <boxGeometry args={[width + 0.06, height + 0.06, 0.03]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[width + 0.02, height + 0.02, 0.035]} />
        <meshStandardMaterial color="#dddddd" />
      </mesh>

      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {indexLabel && (
        <Text
          position={[0, height / 2 + 0.08, 0]}
          fontSize={0.05}
          color="white"
          anchorX="center"
          anchorY="bottom"
          maxWidth={width}
          font={FONT_URL}
          outlineWidth={0.002}
          outlineColor="#000000"
        >
          {indexLabel}
        </Text>
      )}

      {title && (
        <Text
          position={[0, -height / 2 - 0.1, 0]}
          fontSize={0.035}
          color="white"
          anchorX="center"
          anchorY="top"
          maxWidth={width * 1.2}
          font={FONT_URL}
          outlineWidth={0.003}
          outlineColor="#000000"
        >
          {title}
        </Text>
      )}
      {bodyText && (
        <Text
          position={[0, -height / 2 - 0.18, 0]}
          fontSize={0.018}
          color="#eeeeee"
          lineHeight={1.4}
          anchorX="center"
          anchorY="top"
          textAlign="center"
          maxWidth={width * 1.2}
          font={FONT_URL}
          outlineWidth={0.001}
          outlineColor="#000000"
        >
          {bodyText}
        </Text>
      )}
      {formattedDate && (
        <Text
          position={[0, -height / 2 - 0.35, 0]}
          fontSize={0.015}
          color="#aaaaaa"
          anchorX="center"
          anchorY="top"
          textAlign="center"
          maxWidth={width}
          font={FONT_URL}
          outlineWidth={0.001}
          outlineColor="#000000"
        >
          {`撮影日: ${formattedDate}`}
        </Text>
      )}
    </group>
  );
});

const PhotoWall = memo(function PhotoWall({
  works,
  startCarouselRef,
}: {
  works: Work[];
  startCarouselRef?: RefObject<(dir: 'next' | 'prev') => void>;
}) {
  const [startIndex, setStartIndex] = useState(0);

  const wallGroupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef<'idle' | 'moveBack' | 'moveForward'>('idle');
  const progressRef = useRef(0);
  const directionRef = useRef<'next' | 'prev'>('next');

  const DURATION = 0.6;
  const DIST = 2.0;

  const startCarousel = useCallback((direction: 'next' | 'prev') => {
    if (phaseRef.current !== 'idle') return;
    directionRef.current = direction;
    phaseRef.current = 'moveBack';
    progressRef.current = 0;
  }, []);

  useEffect(() => {
    if (startCarouselRef) {
      startCarouselRef.current = startCarousel;
    }
  }, [startCarouselRef, startCarousel]);

  // 次のページ・前のページのテクスチャを先読みして切替時のチラつきを防止
  useEffect(() => {
    if (works.length === 0) return;
    const len = works.length;
    const preloadOffsets = [-3, -2, -1, 3, 4, 5];
    const urls = new Set<string>();
    for (const offset of preloadOffsets) {
      const idx = (((startIndex + offset) % len) + len) % len;
      const url = works[idx]?.photo?.url;
      if (url) urls.add(url);
    }
    for (const url of urls) {
      useTexture.preload(url);
    }
  }, [works, startIndex]);

  // useFrame 内では React state を更新せず Three.js オブジェクトの position を直接操作
  useFrame((_, delta) => {
    if (phaseRef.current === 'idle' || !wallGroupRef.current) return;
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    progressRef.current += dt;
    const p = Math.min(progressRef.current / DURATION, 1);

    if (phaseRef.current === 'moveBack') {
      const eased = easeInOutCubic(p);
      wallGroupRef.current.position.y = THREE.MathUtils.lerp(0, -DIST, eased);

      if (p >= 1) {
        setStartIndex((s) => {
          const len = Math.max(works.length, 1);
          if (directionRef.current === 'next') {
            return (s + 3) % len;
          }
          return (((s - 3) % len) + len) % len;
        });

        wallGroupRef.current.position.y = -DIST;
        progressRef.current = 0;
        phaseRef.current = 'moveForward';
      }
    } else if (phaseRef.current === 'moveForward') {
      const eased = easeInOutCubic(p);
      wallGroupRef.current.position.y = THREE.MathUtils.lerp(-DIST, 0, eased);

      if (p >= 1) {
        wallGroupRef.current.position.y = 0;
        progressRef.current = 0;
        phaseRef.current = 'idle';
      }
    }
  });

  if (works.length === 0) return null;

  const getWork = (offset: number) => {
    const idx = (((startIndex + offset) % works.length) + works.length) % works.length;
    return works[idx];
  };

  const w1 = getWork(0);
  const w2 = getWork(1);
  const w3 = getWork(2);

  return (
    <group ref={wallGroupRef}>
      {w3?.photo?.url && (
        <PhotoFrame
          key={`w3-${w3.id}`}
          url={w3.photo.url}
          position={[-0.89, FLOOR_Y + 1.3, 0.7]}
          rotation={[0, Math.PI / 2, 0]}
          title={w3.title}
          body={w3.body}
          shootingdate={w3.shootingdate}
          index={((startIndex + 2) % works.length) + 1}
        />
      )}
      {w1?.photo?.url && (
        <PhotoFrame
          key={`w1-${w1.id}`}
          url={w1.photo.url}
          position={[-0.89, FLOOR_Y + 1.3, -0.7]}
          rotation={[0, Math.PI / 2, 0]}
          title={w1.title}
          body={w1.body}
          shootingdate={w1.shootingdate}
          index={(startIndex % works.length) + 1}
        />
      )}
      {w2?.photo?.url && (
        <PhotoFrame
          key={`w2-${w2.id}`}
          url={w2.photo.url}
          position={[0.89, FLOOR_Y + 1.3, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          title={w2.title}
          body={w2.body}
          shootingdate={w2.shootingdate}
          index={((startIndex + 1) % works.length) + 1}
        />
      )}
    </group>
  );
});

const Walls = memo(function Walls() {
  const colorMap = useTexture('./images/plastered_wall_03_diff_1k.jpg', (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  });

  return (
    <group>
      {/* 左 */}
      <mesh position={[-1, FLOOR_Y + 2, 0]}>
        <boxGeometry args={[0.2, 4, 10]} />
        <meshStandardMaterial map={colorMap} roughness={0.8} />
      </mesh>
      {/* 右 */}
      <mesh position={[1, FLOOR_Y + 2, 0]}>
        <boxGeometry args={[0.2, 4, 10]} />
        <meshStandardMaterial map={colorMap} roughness={0.8} />
      </mesh>
      {/* 前後壁（黒） */}
      <mesh position={[0, FLOOR_Y + 2, -5]}>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0, FLOOR_Y + 2, 5]}>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      {/* 左端黒 */}
      <mesh position={[-5, FLOOR_Y + 2, 0]}>
        <boxGeometry args={[0.2, 4, 10]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      {/* 右端黒 */}
      <mesh position={[5, FLOOR_Y + 2, 0]}>
        <boxGeometry args={[0.2, 4, 10]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      {/* 天井 */}
      <mesh position={[0, FLOOR_Y + 4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  );
});

const SingleSpot = memo(function SingleSpot({
  position,
}: {
  position: [number, number, number];
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        angle={Math.PI / 4}
        distance={8}
        intensity={4.5}
        penumbra={0.5}
      />
      <object3D ref={targetRef} position={[position[0], FLOOR_Y, position[2]]} />
    </>
  );
});

const SPOT_POSITIONS: ReadonlyArray<[number, number, number]> = [
  [0, 2, -3],
  [0, 2, 0],
  [0, 2, 3],
];

const SpotLightsRow = memo(function SpotLightsRow() {
  return (
    <>
      {SPOT_POSITIONS.map((pos, i) => (
        <SingleSpot key={i} position={pos} />
      ))}
    </>
  );
});

function Controls() {
  // VRセッション中はOrbitControlsを無効化する
  const session = useXR((state) => state.session);
  return (
    <OrbitControls
      enabled={!session}
      enableDamping
      dampingFactor={0.05}
      minDistance={0.5}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2}
    />
  );
}

// --- メイン App ---

function App() {
  const { works, loading: worksLoading, error: worksError, refetch } = useWorks();
  const [vrStarted, setVrStarted] = useState(false);
  const [vrSupported, setVrSupported] = useState<boolean | null>(() =>
    navigator.xr && typeof navigator.xr.isSessionSupported === 'function' ? null : false,
  );
  const [initialReady, setInitialReady] = useState(false);
  const startCarouselRef = useRef<(dir: 'next' | 'prev') => void>(() => {});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 初期は再生していない（ページ表示時はミュートにするため）
  const [bgmEnabled, setBgmEnabled] = useState(false);

  // VR対応チェック
  useEffect(() => {
    const xr = navigator.xr;
    if (!xr || typeof xr.isSessionSupported !== 'function') return;

    let active = true;
    xr.isSessionSupported('immersive-vr')
      .then((supported) => {
        if (active) setVrSupported(supported);
      })
      .catch(() => {
        if (active) setVrSupported(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // XRセッションの開始・終了（ヘッドセット側終了含む）を確実に同期
  useEffect(() => {
    const unsubscribeState = store.subscribe((state) => {
      setVrStarted(Boolean(state.session));
    });
    const unsubscribeEnd = store.onSessionEnd(() => {
      setVrStarted(false);
      setBgmEnabled(false);
    });
    return () => {
      unsubscribeState();
      unsubscribeEnd();
    };
  }, []);

  // 初期表示用の先頭画像のみ軽量プリロード（タイムアウト付きでブロックを防止）
  useEffect(() => {
    if (worksLoading || works.length === 0) return;

    let active = true;
    const initialUrls = works
      .slice(0, 3)
      .map((w) => w.photo?.url)
      .filter((url): url is string => Boolean(url));

    for (const url of initialUrls) {
      useTexture.preload(url);
    }

    const preloadPromise = Promise.all(
      initialUrls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
          }),
      ),
    );

    const timeoutPromise = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 4000);
    });

    void Promise.race([preloadPromise, timeoutPromise]).then(() => {
      if (active) setInitialReady(true);
    });

    return () => {
      active = false;
    };
  }, [works, worksLoading]);

  // ページ表示時はオーディオをミュートかつループ・ボリューム設定する
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.loop = true;
    audio.volume = 0.3;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (bgmEnabled) {
      audio.muted = false;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => setBgmEnabled(false));
      }
    } else {
      audio.pause();
    }
  }, [bgmEnabled]);

  const handleVRClick = useCallback(async () => {
    if (vrStarted) return;
    try {
      const session = await store.enterVR();
      if (session) {
        setVrStarted(true);
        // VR への入室はユーザー操作とみなされるため、ミュートを解除してから BGM を再生
        if (audioRef.current) {
          audioRef.current.muted = false;
          setBgmEnabled(true);
        }
      }
    } catch (error) {
      console.error('VR Error:', error);
      setVrStarted(false);
    }
  }, [vrStarted]);

  const toggleBgm = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (bgmEnabled) {
      audio.pause();
      setBgmEnabled(false);
    } else {
      try {
        audio.muted = false;
        await audio.play();
        setBgmEnabled(true);
      } catch {
        setBgmEnabled(false);
      }
    }
  }, [bgmEnabled]);

  const handlePrev = useCallback(() => {
    startCarouselRef.current('prev');
  }, []);

  const handleNext = useCallback(() => {
    startCarouselRef.current('next');
  }, []);

  const marqueeStyle = useMemo(
    () =>
      ({
        '--marquee-duration': `${Math.max(works.length * 4, 20)}s`,
      }) as CSSProperties,
    [works.length],
  );

  const loading = worksLoading || (works.length > 0 && !initialReady);

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-[#222] text-white text-3xl">
        <div className="mb-4">Loading...</div>
        <div className="w-15 h-15 border-6 border-[#888] border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* BGM audio element */}
      <audio ref={audioRef} src="./sound/bgm.mp3" preload="auto" />

      {/* 非VR時のPC向けプレビューオーバーレイ */}
      {!vrStarted && (
        <div className="fixed inset-0 bg-black text-white z-50 overflow-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex justify-center">
              <img
                src="./images/frontpage.webp"
                alt="VR台湾写真展「時勢使然」"
                className="max-w-3xl w-full h-auto"
                decoding="async"
              />
            </div>
            <div className="flex justify-center mb-20">
              {vrSupported ? (
                <button
                  type="button"
                  onClick={handleVRClick}
                  className="px-8 py-6 text-2xl font-bold rounded-lg border-none bg-white text-gray-900 hover:text-white hover:bg-gray-900 cursor-pointer font-noto transition-colors"
                >
                  VRで鑑賞する
                </button>
              ) : (
                <p className="text-xl text-gray-400 font-noto">VRゴーグルをご用意ください。</p>
              )}
            </div>

            <p className="mb-4 font-noto">展示写真</p>
            {/* 写真スライダー（CSS GPU アクセラレーション無限横スクロール） */}
            <div className="relative w-full h-80 bg-black rounded-lg overflow-hidden">
              {worksError ? (
                <div className="text-red-400 p-5 text-center font-noto flex flex-col items-center gap-3">
                  <p>展示写真の読み込みに失敗しました。</p>
                  <button
                    type="button"
                    onClick={() => void refetch(false)}
                    className="px-4 py-2 text-sm rounded bg-white text-gray-900 hover:bg-gray-200 cursor-pointer"
                  >
                    再読み込み
                  </button>
                </div>
              ) : works.length > 0 ? (
                <div className="animate-gallery-marquee gap-4" style={marqueeStyle}>
                  {/* 画像を2周分表示して途切れのない無限スクロール */}
                  {[...works, ...works].map((work, idx) => (
                    <div
                      key={`${work.id}-${idx}`}
                      className="w-[280px] h-[320px] shrink-0 rounded-lg overflow-hidden bg-neutral-900"
                    >
                      {work.photo?.url && (
                        <img
                          src={work.photo.url}
                          alt={work.title || '展示写真'}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 p-5 text-center font-noto">
                  表示するコンテンツがありません。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 75 }}
        style={{ width: '100vw', height: '100vh' }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
        }}
        dpr={[1, 1.5]}
      >
        <XR store={store}>
          <Controls />

          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 10, 7.5]} intensity={0.5} />

          <SpotLightsRow />
          <Suspense fallback={null}>
            <Ground />
            <Walls />
            <FloatingBoard onPrev={handlePrev} onNext={handleNext} />
          </Suspense>
          <Bgm3DControls bgmEnabled={bgmEnabled} toggleBgm={toggleBgm} />

          <Suspense fallback={null}>
            <PhotoWall works={works} startCarouselRef={startCarouselRef} />
          </Suspense>
        </XR>
      </Canvas>
    </>
  );
}

export default App;
