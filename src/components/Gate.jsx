import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gateFrameColor, gateFinialColor } from '../utils/palette';
import { useGraphics } from './GraphicsProvider';

/**
 * Goal gate frame + themed floating jewel.
 *
 * The `position` prop is the BASE of the gate (where the pillars rest on the
 * platform). Internally we shift everything up so the pillars stand on the
 * platform instead of half-sinking into it.
 *
 * `jewelColor` drives the whole gate palette: the jewel itself, the gate
 * frame (darker desaturated variant), and the finials (brighter near-white
 * accent). The goal platform under the gate uses a pastel variant of the
 * same hue so the structure reads as one unified themed group.
 *
 * `grand` swaps in a thicker, taller, more ornamented variant — wider pillar
 * spacing, base trim, a center crown ornament above the arch, and brighter
 * emissives. Used for the final level so the gate reads as an end-game
 * monument rather than a checkpoint frame.
 */
function Gate({ position, jewelColor = '#ffd966', grand = false }) {
  const q = useGraphics();
  const isHigh = q.id === 'high';
  const gateRef = useRef();
  const jewelRef = useRef();
  const ringRef = useRef();
  const crownRef = useRef();
  // Material refs for the breathing frame glow (only animated at high quality).
  const frameMatRefs = useRef([]);
  const finialMatRefs = useRef([]);
  const accentLightRef = useRef();
  const t = useRef(0);

  // Geometry + emissive constants per variant. At high quality both variants
  // get a stronger emissive baseline so the metal glows and catches bloom.
  const baseEmissive = grand
    ? (isHigh ? 0.7 : 0.45)
    : (isHigh ? 0.4 : 0.22);
  const finialEmissive = grand
    ? (isHigh ? 1.2 : 0.8)
    : (isHigh ? 0.85 : 0.5);
  const cfg = grand
    ? {
        pillarW: 0.78, pillarH: 6.2, pillarD: 0.78,
        pillarX: 2.1,
        topY: 2.9, topW: 4.9, topH: 0.78, topD: 0.78,
        finialR: 0.42, finialY: 3.3,
        groupY: 3.1,            // taller pillars → shift base up so they sit on the platform
        haloOuter: 4.2, haloInner: 1.6,
        accentOuter: 2.8, accentInner: 2.95,
        jewelY: 2.5,
        emissive: baseEmissive,
        baseTrim: true,
        topCrown: true,
      }
    : {
        pillarW: 0.5, pillarH: 5, pillarD: 0.5,
        pillarX: 1.5,
        topY: 2.25, topW: 3.5, topH: 0.5, topD: 0.5,
        finialR: 0.3, finialY: 2.5,
        groupY: 2.5,
        haloOuter: 3.4, haloInner: 1.4,
        accentOuter: 2.3, accentInner: 2.45,
        jewelY: 2.0,
        emissive: baseEmissive,
        baseTrim: false,
        topCrown: false,
      };

  // Helpers that collect material refs for the breathing animation.
  const collectFrameMat = (mat, idx) => { if (mat) frameMatRefs.current[idx] = mat; };
  const collectFinialMat = (mat, idx) => { if (mat) finialMatRefs.current[idx] = mat; };

  useFrame((_, delta) => {
    t.current += delta;
    if (gateRef.current) {
      gateRef.current.rotation.y += delta * (grand ? 0.32 : 0.5);
    }
    if (jewelRef.current) {
      jewelRef.current.rotation.y += delta * 1.6;
      jewelRef.current.rotation.x = Math.sin(t.current * 0.7) * 0.25;
      jewelRef.current.position.y = cfg.jewelY + Math.sin(t.current * 1.8) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.4;
      const pulse = 1 + 0.06 * Math.sin(t.current * 2.0);
      ringRef.current.scale.set(pulse, pulse, 1);
    }
    if (crownRef.current) {
      // Slow counter-rotating ornament above the arch.
      crownRef.current.rotation.y -= delta * 0.25;
    }
    // High-quality breathing glow: subtle ±25% pulse on frame & finial emissive
    // so the gate visibly inhales/exhales light. Skipped on Potato to keep
    // those builds rock-still and cheap.
    if (isHigh) {
      const breath = 1 + 0.28 * Math.sin(t.current * 1.4);
      const beat   = 1 + 0.35 * Math.sin(t.current * 2.6 + 0.7);
      for (const m of frameMatRefs.current) {
        if (m) m.emissiveIntensity = cfg.emissive * breath;
      }
      for (const m of finialMatRefs.current) {
        if (m) m.emissiveIntensity = finialEmissive * beat;
      }
      if (accentLightRef.current) {
        accentLightRef.current.intensity = (grand ? 2.4 : 1.4) * breath;
      }
    }
  });

  // All three frame tones derive from the jewel hex via shared palette helpers.
  const frameColor  = useMemo(() => gateFrameColor(jewelColor),  [jewelColor]);
  const finialColor = useMemo(() => gateFinialColor(jewelColor), [jewelColor]);
  const jewelThree  = useMemo(() => new THREE.Color(jewelColor), [jewelColor]);

  return (
    <group position={position}>
      {/* Themed ground halo at platform level */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cfg.haloInner, cfg.haloOuter, 64]} />
        <meshBasicMaterial color={jewelThree} transparent opacity={grand ? 0.32 : 0.22} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* A slow-rotating thin accent ring on the platform, matches theme */}
      <mesh ref={ringRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cfg.accentOuter, cfg.accentInner, 64]} />
        <meshBasicMaterial color={jewelThree} transparent opacity={grand ? 0.8 : 0.65} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* High-quality only: themed accent point light above the arch so the
          gate casts colored light on the surrounding platform. Skipped on
          Potato (no extra lights) and when the level requests minimalLights. */}
      {isHigh && !q.minimalLights && (
        <pointLight
          ref={accentLightRef}
          position={[0, cfg.groupY + cfg.topY + 0.6, 0]}
          color={jewelThree}
          intensity={grand ? 2.4 : 1.4}
          distance={grand ? 14 : 9}
          decay={2}
        />
      )}

      {/* Gate frame — shifted up so pillar bottoms rest on the platform. */}
      <group ref={gateRef} position={[0, cfg.groupY, 0]}>
        {/* Left pillar */}
        <mesh position={[-cfg.pillarX, 0, 0]}>
          <boxGeometry args={[cfg.pillarW, cfg.pillarH, cfg.pillarD]} />
          <meshStandardMaterial
            ref={(m) => collectFrameMat(m, 0)}
            color={frameColor} emissive={frameColor}
            emissiveIntensity={cfg.emissive}
            roughness={0.22} metalness={0.78}
          />
        </mesh>

        {/* Right pillar */}
        <mesh position={[cfg.pillarX, 0, 0]}>
          <boxGeometry args={[cfg.pillarW, cfg.pillarH, cfg.pillarD]} />
          <meshStandardMaterial
            ref={(m) => collectFrameMat(m, 1)}
            color={frameColor} emissive={frameColor}
            emissiveIntensity={cfg.emissive}
            roughness={0.22} metalness={0.78}
          />
        </mesh>

        {/* Base trim on each pillar — grand variant only */}
        {cfg.baseTrim && (
          <>
            <mesh position={[-cfg.pillarX, -cfg.pillarH / 2 + 0.18, 0]}>
              <boxGeometry args={[cfg.pillarW * 1.6, 0.35, cfg.pillarD * 1.6]} />
              <meshStandardMaterial
                ref={(m) => collectFrameMat(m, 4)}
                color={frameColor} emissive={jewelThree}
                emissiveIntensity={isHigh ? 0.6 : 0.35}
                roughness={0.3} metalness={0.7}
              />
            </mesh>
            <mesh position={[cfg.pillarX, -cfg.pillarH / 2 + 0.18, 0]}>
              <boxGeometry args={[cfg.pillarW * 1.6, 0.35, cfg.pillarD * 1.6]} />
              <meshStandardMaterial
                ref={(m) => collectFrameMat(m, 5)}
                color={frameColor} emissive={jewelThree}
                emissiveIntensity={isHigh ? 0.6 : 0.35}
                roughness={0.3} metalness={0.7}
              />
            </mesh>
          </>
        )}

        {/* Top bar */}
        <mesh position={[0, cfg.topY, 0]}>
          <boxGeometry args={[cfg.topW, cfg.topH, cfg.topD]} />
          <meshStandardMaterial
            ref={(m) => collectFrameMat(m, 2)}
            color={frameColor} emissive={frameColor}
            emissiveIntensity={cfg.emissive}
            roughness={0.22} metalness={0.78}
          />
        </mesh>

        {/* Decorative finials — bright accent of same hue */}
        <mesh position={[-cfg.pillarX, cfg.finialY, 0]}>
          <sphereGeometry args={[cfg.finialR, 18, 18]} />
          <meshStandardMaterial
            ref={(m) => collectFinialMat(m, 0)}
            color={finialColor} emissive={jewelThree}
            emissiveIntensity={finialEmissive}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[cfg.pillarX, cfg.finialY, 0]}>
          <sphereGeometry args={[cfg.finialR, 18, 18]} />
          <meshStandardMaterial
            ref={(m) => collectFinialMat(m, 1)}
            color={finialColor} emissive={jewelThree}
            emissiveIntensity={finialEmissive}
            toneMapped={false}
          />
        </mesh>

        {/* Center crown ornament above the arch — grand variant only */}
        {cfg.topCrown && (
          <group ref={crownRef} position={[0, cfg.topY + 0.7, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.55, 0.08, 14, 32]} />
              <meshStandardMaterial
                ref={(m) => collectFinialMat(m, 2)}
                color={finialColor} emissive={jewelThree}
                emissiveIntensity={isHigh ? 1.4 : 1.0}
                roughness={0.2} metalness={0.85} toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <octahedronGeometry args={[0.28, 0]} />
              <meshStandardMaterial
                ref={(m) => collectFinialMat(m, 3)}
                color={jewelThree} emissive={jewelThree}
                emissiveIntensity={isHigh ? 1.6 : 1.2}
                roughness={0.12} metalness={0.85} toneMapped={false}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Themed floating jewel inside the gate opening */}
      <group ref={jewelRef} position={[0, cfg.jewelY, 0]}>
        {/* Main octahedron facet */}
        <mesh>
          <octahedronGeometry args={[grand ? 0.7 : 0.52, 0]} />
          <meshStandardMaterial
            color={jewelThree}
            emissive={jewelThree}
            emissiveIntensity={grand ? 0.9 : 0.6}
            roughness={0.12}
            metalness={0.8}
            toneMapped={false}
          />
        </mesh>
        {/* Inner core for bloom anchor */}
        <mesh>
          <octahedronGeometry args={[grand ? 0.3 : 0.22, 0]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* Faint outer aura */}
        <mesh>
          <sphereGeometry args={[grand ? 1.0 : 0.75, 24, 16]} />
          <meshBasicMaterial color={jewelThree} transparent opacity={grand ? 0.12 : 0.08} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default Gate;
