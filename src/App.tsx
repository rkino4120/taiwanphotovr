import { useRef, useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { XR, createXRStore, useXR } from '@react-three/xr';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

// --- ユーティリティ関数 ---

function htmlToText(html: string): string {
  if (!html) return '';
  const replaced = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  const tmp = document.createElement('div');
  tmp.innerHTML = replaced;
  return tmp.textContent || tmp.innerText || '';
}

function formatShootingDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// XRストアの作成
const store = createXRStore();

// 定数
const FLOOR_Y = 0;

// --- コンポーネント群 ---


function Ground() {
  // ファイルパスを元に戻す
  const [colorMap, roughnessMap] = useLoader(THREE.TextureLoader, [
    './images/concrete_diff.jpg',
    './images/concrete_rough.png'
  ]);

  useMemo(() => {
    [colorMap, roughnessMap].forEach(tex => {
      if(tex) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(5, 5);
        tex.needsUpdate = true;
      }
    });
  }, [colorMap, roughnessMap]);

  return (
    <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 12]} />
      <meshStandardMaterial 
        map={colorMap}
        bumpMap={roughnessMap}
        bumpScale={0.1}
      />
    </mesh>
  );
}

function FloatingBoard({ onPrev, onNext }: { onPrev?: () => void, onNext?: () => void }) {
  // ファイルパスを元に戻す
  const [frontTex, backTex] = useLoader(THREE.TextureLoader, ['./images/frontpage.webp', './images/profilepage.webp'], (loader) => {
    loader.crossOrigin = 'anonymous';
  });

  useMemo(() => {
    [frontTex, backTex].forEach((t) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      try { (t as any).colorSpace = THREE.SRGBColorSpace; } catch (e) { /* ignore old three versions */ }
      t.needsUpdate = true;
    });
  }, [frontTex, backTex]);

  const DEFAULT_HEIGHT = 0.5;
  const aspect = useMemo(() => {
    if (frontTex && frontTex.image && (frontTex.image as any).width && (frontTex.image as any).height) {
      return (frontTex.image as any).width / (frontTex.image as any).height;
    }
    return 1.5;
  }, [frontTex]);

  const HEIGHT = DEFAULT_HEIGHT;
  const WIDTH = HEIGHT * aspect;
  const EPS = 0.001;

  const [flipped, setFlipped] = useState(false);
  const animRef = useRef({ start: 0, end: 0, t: 1 });
  const currentY = useRef(0);
  const rootRef = useRef<THREE.Group>(null);
  const boardRef = useRef<THREE.Group>(null);
  const DURATION = 0.6;

  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  useFrame((_, delta) => {
    if (animRef.current.t < 1) {
      animRef.current.t = Math.min(1, animRef.current.t + delta / DURATION);
      const eased = easeInOutCubic(animRef.current.t);
      currentY.current = THREE.MathUtils.lerp(animRef.current.start, animRef.current.end, eased);
      if (boardRef.current) {
        boardRef.current.rotation.y = currentY.current;
      }
    }
  });

  const toggleFlip = () => {
    const from = currentY.current;
    const to = flipped ? 0 : Math.PI;
    animRef.current = { start: from, end: to, t: 0 };
    setFlipped((f) => !f);
  };

  // import.meta.env.BASE_URL のエラー回避のため、相対パスを直接指定
  const fontUrl = './fonts/NotoSansJP-Regular.ttf';

  return (
    <group ref={rootRef} position={[0, FLOOR_Y + 1.3, -1.3]}> 
      <group ref={boardRef} rotation={[0, 0, 0]}> 
        <mesh position={[0, 0, 0]}>
           <boxGeometry args={[WIDTH + 0.04, HEIGHT + 0.04, 0.02]} />
           <meshStandardMaterial color="#222" />
        </mesh>

        <mesh position={[0, 0, EPS + 0.015]} onPointerDown={toggleFlip}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>

        {/* 正面 */}
        <mesh position={[0, 0, 0.011]} rotation={[0, 0, 0]}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial map={frontTex} side={THREE.FrontSide} />
        </mesh>

        {/* 裏面 */}
        <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial map={backTex} side={THREE.FrontSide} />
        </mesh>
      </group>

      {/* 左矢印 */}
      <group position={[-WIDTH / 2 - 0.25, 0, 0]}>
        <mesh 
          onPointerDown={(e) => { e.stopPropagation(); onPrev && onPrev(); }}
          onPointerEnter={(e) => { (e.object as THREE.Mesh).scale.set(1.2, 1.2, 1.2); }}
          onPointerLeave={(e) => { (e.object as THREE.Mesh).scale.set(1, 1, 1); }}
          rotation={[Math.PI / 2, 0, Math.PI / 2]}
        >
          <coneGeometry args={[0.04, 0.18, 32]} />
          <meshStandardMaterial color="#dddddd" emissive="#dddddd" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, -0.12, 0]}
          fontSize={0.03}
          color="white"
          anchorX="center"
          anchorY="top"
          font={fontUrl}
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
          onPointerDown={(e) => { e.stopPropagation(); onNext && onNext(); }}
          onPointerEnter={(e) => { (e.object as THREE.Mesh).scale.set(1.2, 1.2, 1.2); }}
          onPointerLeave={(e) => { (e.object as THREE.Mesh).scale.set(1, 1, 1); }}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
        >
          <coneGeometry args={[0.04, 0.18, 32]} />
          <meshStandardMaterial color="#dddddd" emissive="#dddddd" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, -0.12, 0]}
          fontSize={0.03}
          color="white"
          anchorX="center"
          anchorY="top"
          font={fontUrl}
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
}

// BGM を制御する 3D UI（FloatingBoard の下に配置）
function Bgm3DControls({ position = [0, FLOOR_Y + 1.0, -1.3], bgmEnabled, toggleBgm }: { position?: [number, number, number], bgmEnabled: boolean, toggleBgm: () => void }) {
  const [hover, setHover] = useState(false);
  const sizeX = 0.2;
  const sizeY = 0.08;
  return (
    <group position={position}>
      <mesh position={[0, -0.09, 0]} onPointerDown={(e) => { e.stopPropagation(); toggleBgm(); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <boxGeometry args={[sizeX, sizeY, 0.02]} />
        <meshStandardMaterial color={hover ? 0x88ccff : 0x666666} metalness={0.2} roughness={0.4} />
      </mesh>
      <Text
        position={[0, -0.08, 0.03]}
        rotation={[0, 0, 0]}
        fontSize={0.02}
        color="white"
        anchorX="center"
        anchorY="middle"
        font={`./fonts/NotoSansJP-Regular.ttf`}
      >
        {bgmEnabled ? 'Pause BGM' : 'Play BGM'}
      </Text>
    </group>
  );
}

function PhotoFrame({ url, position = [-0.89, FLOOR_Y + 1.5, 0], rotation = [0, Math.PI / 2, 0], title, body, shootingdate, index }: { url: string, position?: [number, number, number], rotation?: [number, number, number], title?: string, body?: string, shootingdate?: string, index?: number }) {
  const texture = useLoader(THREE.TextureLoader, url, (loader) => {
    loader.crossOrigin = 'anonymous';
  });
  
  // VRパフォーマンス向上のためテクスチャ設定を最適化
  useMemo(() => {
    if (texture) {
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 1; // 異方性フィルタリングを最小に
    }
  }, [texture]);
  
  const { width, height } = useMemo(() => {
    if (texture.image?.width && texture.image?.height) {
      const aspect = texture.image.width / texture.image.height;
      const h = 0.75; 
      return { width: h * aspect, height: h };
    }
    return { width: 0.75, height: 0.75 };
  }, [texture]);
  
  const GLOBAL_Y_SHIFT = 0.3;
  const localPos: [number, number, number] = [position[0], position[1] + GLOBAL_Y_SHIFT, position[2]];

  const indexLabel = typeof index === 'number' ? String(index).padStart(2, '0') : null;
  // import.meta.env.BASE_URL エラー回避のため相対パスを使用
  const fontUrl = './fonts/NotoSansJP-Regular.ttf';

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
        <meshBasicMaterial map={texture} />
      </mesh>

      {indexLabel && (
        <Text
          position={[0, height / 2 + 0.08, 0]}
          fontSize={0.05}
          color="white"
          anchorX="center"
          anchorY="bottom"
          maxWidth={width}
          font={fontUrl}
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
          font={fontUrl}
          outlineWidth={0.003}
          outlineColor="#000000"
        >
          {title}
        </Text>
      )}
      {body && (
        <Text
          position={[0, -height / 2 - 0.18, 0]}
          fontSize={0.018}
          color="#eeeeee"
          lineHeight={1.4}
          anchorX="center"
          anchorY="top"
          textAlign="center"
          maxWidth={width * 1.2}
          font={fontUrl}
          outlineWidth={0.001}
          outlineColor="#000000"
        >
          {htmlToText(body)}
        </Text>
      )}
      {shootingdate && (
        <Text
          position={[0, -height / 2 - 0.35, 0]}
          fontSize={0.015}
          color="#aaaaaa"
          anchorX="center"
          anchorY="top"
          textAlign="center"
          maxWidth={width}
          font={fontUrl}
          outlineWidth={0.001}
          outlineColor="#000000"
        >
          {`撮影日: ${formatShootingDate(shootingdate)}`}
        </Text>
      )}
    </group>
  );
}

function PhotoWall({ works, startCarouselRef }: { works: any[], startCarouselRef?: React.MutableRefObject<(dir: 'next' | 'prev') => void> }) {
  const [startIndex, setStartIndex] = useState(0);
  
  const verticalOffsetRef = useRef(0);
  const phaseRef = useRef<'idle' | 'moveBack' | 'moveForward'>('idle');
  const progressRef = useRef(0);
  const [, setTick] = useState(0);
  const directionRef = useRef<'next' | 'prev'>('next');

  const DURATION = 0.6; 
  const DIST = 2.0; 

  const easeInOutCubic = (t: number) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const startCarousel = (direction: 'next' | 'prev') => {
    if (phaseRef.current !== 'idle') return;
    directionRef.current = direction;
    phaseRef.current = 'moveBack';
    progressRef.current = 0;
  };

  useEffect(() => {
    if (startCarouselRef) startCarouselRef.current = startCarousel;
  }, [startCarouselRef]);

  useFrame((_, delta) => {
    if (phaseRef.current === 'idle') return;
    progressRef.current += delta;
    const p = Math.min(progressRef.current / DURATION, 1);

    if (phaseRef.current === 'moveBack') {
      const eased = easeInOutCubic(p);
      verticalOffsetRef.current = THREE.MathUtils.lerp(0, -DIST, eased);
      setTick(t => t + 1);
      
      if (p >= 1) {
        setStartIndex(s => {
          const len = Math.max(works.length, 1);
          if (directionRef.current === 'next') {
            return (s + 3) % len;
          } else {
            return (s - 3 + len) % len; 
          }
        });
        
        verticalOffsetRef.current = -DIST;
        progressRef.current = 0;
        phaseRef.current = 'moveForward';
      }
    } else if (phaseRef.current === 'moveForward') {
      const eased = easeInOutCubic(p);
      verticalOffsetRef.current = THREE.MathUtils.lerp(-DIST, 0, eased);
      setTick(t => t + 1);
      
      if (p >= 1) {
        verticalOffsetRef.current = 0;
        progressRef.current = 0;
        phaseRef.current = 'idle';
      }
    }
  });

  const getWork = (offset: number) => {
     if (!works || works.length === 0) return null;
     const idx = (startIndex + offset) % works.length;
     return works[idx < 0 ? idx + works.length : idx];
  };

  const w1 = getWork(0);
  const w2 = getWork(1);
  const w3 = getWork(2);

  if (!works.length) return null;

  return (
    <>
      {w3?.photo?.url && (
        <PhotoFrame 
          key={`w3-${startIndex}`}
          url={w3.photo.url} 
          position={[-0.89, FLOOR_Y + 1.5 + verticalOffsetRef.current, 0.7]} 
          rotation={[0, Math.PI / 2, 0]} 
          title={w3.title} 
          body={w3.body} 
          shootingdate={w3.shootingdate} 
          index={((startIndex + 2) % works.length) + 1}
        />
      )}
      {w1?.photo?.url && (
        <PhotoFrame 
          key={`w1-${startIndex}`}
          url={w1.photo.url} 
          position={[-0.89, FLOOR_Y + 1.5 + verticalOffsetRef.current, -0.7]} 
          rotation={[0, Math.PI / 2, 0]} 
          title={w1.title} 
          body={w1.body} 
          shootingdate={w1.shootingdate} 
          index={((startIndex + 0) % works.length) + 1}
        />
      )}
      {w2?.photo?.url && (
        <PhotoFrame 
          key={`w2-${startIndex}`}
          url={w2.photo.url} 
          position={[0.89, FLOOR_Y + 1.5 + verticalOffsetRef.current, 0]} 
          rotation={[0, -Math.PI / 2, 0]} 
          title={w2.title} 
          body={w2.body} 
          shootingdate={w2.shootingdate} 
          index={((startIndex + 1) % works.length) + 1}
        />
      )}
    </>
  );
}

function Walls() {
  const colorMap = useLoader(THREE.TextureLoader, './images/plastered_wall_03_diff_1k.jpg');

  useMemo(() => {
    if (colorMap) {
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(5, 2);
      colorMap.needsUpdate = true;
    }
  }, [colorMap]);

  const wallMaterialProps = {
    map: colorMap,
    roughness: 0.8,
  } as any;

  return (
    <group>
       {/* 左 */}
       <mesh position={[-1, FLOOR_Y + 2, 0]}>
         <boxGeometry args={[0.2, 4, 10]} />
         <meshStandardMaterial {...wallMaterialProps} />
       </mesh>
       {/* 右 */}
       <mesh position={[1, FLOOR_Y + 2, 0]}>
         <boxGeometry args={[0.2, 4, 10]} />
         <meshStandardMaterial {...wallMaterialProps} />
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
}

function SingleSpot({ position }: { position: [number, number, number] }) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
      lightRef.current.shadow.bias = -0.0001; 
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
      <mesh ref={targetRef} position={[position[0], FLOOR_Y, position[2]]} visible={false} />
    </>
  );
}

function SpotLightsRow() {
  const positions = useMemo(() => {
    const arr: Array<[number, number, number]> = [];
    // VRパフォーマンス向上のためライト数を削減
    for (let z = -3; z <= 3; z += 3) {
      arr.push([0, 2, z]);
    }
    return arr;
  }, []);

  return (
    <>
      {positions.map((pos, i) => (
        <SingleSpot key={i} position={pos} />
      ))}
    </>
  );
}

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

// メイン App
function App() {
  const [vrStarted, setVrStarted] = useState(false);
  const [vrError, setVrError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [works, setWorks] = useState<any[]>([]);
  const startCarouselRef = useRef<(dir: 'next' | 'prev') => void>(() => {});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 初期は再生していない（ページ表示時はミュートにするため）
  const [bgmEnabled, setBgmEnabled] = useState(false);

  const preloadImages = async (urls: string[]): Promise<void> => {
    await Promise.all(urls.map(url => {
      return new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      });
    }));
  };

  useEffect(() => {
    (async () => {
      try {
        const MICROCMS_URL = 'https://liangworks.microcms.io/api/v1/taiwanphoto';
        const API_KEY = import.meta.env.VITE_MICROCMS_API_KEY || import.meta.env.MICROCMS_API_KEY;
        
        const headers: Record<string, string> = {};
        if (API_KEY) headers['X-MICROCMS-API-KEY'] = API_KEY;
        
        const allContents: any[] = [];
        const limit = 100;
        let offset = 0;
        let totalCount = Infinity;
        
        while (allContents.length < totalCount) {
          const url = `${MICROCMS_URL}?limit=${limit}&offset=${offset}`;
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`MicroCMS API error (${res.status})`);
          const data = await res.json();
          const contents: any[] = data.contents || [];
          if (typeof data.totalCount === 'number') totalCount = data.totalCount;
          allContents.push(...contents);
          offset += contents.length;
          if (contents.length === 0) break;
        }
        
        setWorks(allContents);
        const urls = allContents.map(w => w.photo?.url).filter(Boolean);
        await preloadImages(urls);
        setLoading(false);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setLoading(false);
      }
    })();
  }, []);

  const handleVRClick = async () => {
    if (!vrStarted) {
      try {
        await store.enterVR();
        setVrStarted(true);
        setVrError(null);
        // VR への入室はユーザー操作とみなされるため、ミュートを解除してから bgmEnabled を true にする
        if (audioRef.current) {
          audioRef.current.muted = false;
          setBgmEnabled(true); // これで useEffect が発火して play() される
        }
      } catch (error) {
        console.error('VR Error:', error);
        setVrError('VR not supported or blocked');
        setVrStarted(false);
      }
    }
  };

  // ページ表示時はオーディオをミュートかつループ・ボリューム設定する
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.loop = true;
    audio.volume = 0.6;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (bgmEnabled) {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => setBgmEnabled(false));
    } else {
      audio.pause();
    }
  }, [bgmEnabled]);

  const toggleBgm = async () => {
    if (!audioRef.current) return;
    if (bgmEnabled) {
      audioRef.current.pause();
      setBgmEnabled(false);
    } else {
      try {
        await audioRef.current.play();
        setBgmEnabled(true);
      } catch (e) {
        setBgmEnabled(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#222', color: '#fff', fontSize: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>Loading...</div>
        <div style={{ width: 60, height: 60, border: '6px solid #888', borderTop: '6px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleVRClick}
          disabled={vrStarted}
          style={{ 
            opacity: vrStarted ? 0.5 : 1, cursor: vrStarted ? 'not-allowed' : 'pointer'
          }}
        >
          {vrStarted ? 'VR Active' : 'Enter VR'}
        </button>

        <button
          onClick={toggleBgm}
          style={{ cursor: 'pointer' }}
        >
          {bgmEnabled ? 'BGM: ON' : 'BGM: OFF'}
        </button>
      </div>
      
      {vrError && (
        <div style={{ position: 'absolute', top: '50px', left: '10px', zIndex: 1000, color: 'red', backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px' }}>
          {vrError}
        </div>
      )}

      {/* BGM audio element */}
      <audio ref={audioRef} src="./sound/bgm.mp3" preload="auto" />

      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 75 }}
        style={{ width: '100vw', height: '100vh' }}
        gl={{ 
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true
        }}
        dpr={[1, 1.5]}
      >
        <XR store={store}>
          <Controls />
          
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 10, 7.5]} intensity={0.5} />
          
          <SpotLightsRow />
          <Ground />
          <Walls />
          <FloatingBoard onPrev={() => startCarouselRef.current('prev')} onNext={() => startCarouselRef.current('next')} />
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