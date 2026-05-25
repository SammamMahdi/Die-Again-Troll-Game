import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { matches } from '../utils/controls';

const CAM_DIST = 40.0;
const CAM_YAW = 90.0; // degrees
const CAM_PITCH = -15.0; // degrees

// Export yaw ref so Player can access camera direction
export const cameraYawRef = { current: CAM_YAW };

function CameraController({ target, cameraControlRef }) {
  const { camera, gl } = useThree();
  const yawRef = useRef(CAM_YAW);
  const pitchRef = useRef(CAM_PITCH);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  
  // Expose camera control function via ref
  useEffect(() => {
    if (cameraControlRef) {
      cameraControlRef.current = {
        rotate: (deltaX, deltaY) => {
          const sensitivity = 0.3;
          yawRef.current += deltaX * sensitivity;
          cameraYawRef.current = yawRef.current;
          pitchRef.current = Math.max(-89, Math.min(89, pitchRef.current + deltaY * sensitivity));
        }
      };
    }
  }, [cameraControlRef]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Rotate camera via the rebindable Camera bindings (default
      // ← / → / ↑ / ↓). matches() handles the key-string normalization.
      const rotSpeed = 2.0;
      if (matches(e.key, 'camLeft')) {
        yawRef.current -= rotSpeed;
        cameraYawRef.current = yawRef.current;
      }
      if (matches(e.key, 'camRight')) {
        yawRef.current += rotSpeed;
        cameraYawRef.current = yawRef.current;
      }
      if (matches(e.key, 'camUp')) {
        pitchRef.current = Math.min(89, pitchRef.current + rotSpeed);
      }
      if (matches(e.key, 'camDown')) {
        pitchRef.current = Math.max(-89, pitchRef.current - rotSpeed);
      }
    };
    
    const handleMouseDown = (e) => {
      if (e.button === 0 || e.button === 2) { // Left or right click
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        gl.domElement.style.cursor = 'grabbing';
      }
    };
    
    const handleMouseMove = (e) => {
      if (isDragging.current) {
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        
        // Mouse sensitivity
        const sensitivity = 0.3;
        yawRef.current += deltaX * sensitivity;
        cameraYawRef.current = yawRef.current;
        pitchRef.current = Math.max(-89, Math.min(89, pitchRef.current + deltaY * sensitivity));
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      gl.domElement.style.cursor = 'default';
    };
    
    const handleContextMenu = (e) => {
      e.preventDefault(); // Prevent right-click menu
    };

    window.addEventListener('keydown', handleKeyDown);
    gl.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    gl.domElement.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      gl.domElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl]);

  // Damping state: previous camera position + look-at, lerped toward target.
  const smoothPos = useRef(new THREE.Vector3(0, 5, 30));
  const smoothLook = useRef(new THREE.Vector3(0, 0, 0));
  const initialFOV = useRef(camera.fov);

  useFrame((_, delta) => {
    if (!target) return;
    const dt = Math.min(delta, 0.05);

    const [cx, cy, cz] = target;
    const radYaw = THREE.MathUtils.degToRad(yawRef.current);
    const radPitch = THREE.MathUtils.degToRad(pitchRef.current);

    const desiredX = cx + CAM_DIST * Math.cos(radPitch) * Math.cos(radYaw);
    const desiredY = cy + CAM_DIST * Math.sin(radPitch);
    const desiredZ = cz + CAM_DIST * Math.cos(radPitch) * Math.sin(radYaw);

    // Damped lerp toward the desired camera position (frame-rate independent).
    const alpha = 1 - Math.exp(-dt * 9.0);
    smoothPos.current.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), alpha);
    smoothLook.current.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.exp(-dt * 12.0));

    // Optional shake decay
    if (shakeRef.current > 0.001) {
      const s = shakeRef.current;
      camera.position.set(
        smoothPos.current.x + (Math.random() - 0.5) * s,
        smoothPos.current.y + (Math.random() - 0.5) * s,
        smoothPos.current.z + (Math.random() - 0.5) * s,
      );
      shakeRef.current *= Math.exp(-dt * 7.0);
    } else {
      camera.position.copy(smoothPos.current);
    }
    camera.lookAt(smoothLook.current);

    // Subtle FOV "breath" + decay back to default
    if (fovPulseRef.current !== 0) {
      camera.fov = initialFOV.current + fovPulseRef.current;
      fovPulseRef.current *= Math.exp(-dt * 5.0);
      if (Math.abs(fovPulseRef.current) < 0.05) fovPulseRef.current = 0;
      camera.updateProjectionMatrix();
    } else if (Math.abs(camera.fov - initialFOV.current) > 0.01) {
      camera.fov = initialFOV.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

// Exported refs other components can use to push transient FX into the camera.
export const shakeRef = { current: 0 };       // additive — bigger = more shake
export const fovPulseRef = { current: 0 };    // additive FOV delta (decays out)
export function pushShake(amount) { shakeRef.current = Math.min(2.5, shakeRef.current + amount); }
export function pushFovPulse(amount) { fovPulseRef.current += amount; }

export default CameraController;
