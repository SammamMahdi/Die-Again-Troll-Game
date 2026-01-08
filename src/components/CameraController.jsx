import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const CAM_DIST = 40.0;
const CAM_YAW = 90.0; // degrees
const CAM_PITCH = -15.0; // degrees

// Export yaw ref so Player can access camera direction
export const cameraYawRef = { current: CAM_YAW };

function CameraController({ target }) {
  const { camera, gl } = useThree();
  const yawRef = useRef(CAM_YAW);
  const pitchRef = useRef(CAM_PITCH);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Arrow keys to rotate camera (same as Python version)
      const rotSpeed = 2.0;
      if (e.key === 'ArrowLeft') {
        yawRef.current -= rotSpeed;
        cameraYawRef.current = yawRef.current;
      }
      if (e.key === 'ArrowRight') {
        yawRef.current += rotSpeed;
        cameraYawRef.current = yawRef.current;
      }
      if (e.key === 'ArrowUp') {
        pitchRef.current = Math.min(89, pitchRef.current + rotSpeed);
      }
      if (e.key === 'ArrowDown') {
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

  useFrame(() => {
    if (!target) return;

    const [cx, cy, cz] = target;
    const radYaw = THREE.MathUtils.degToRad(yawRef.current);
    const radPitch = THREE.MathUtils.degToRad(pitchRef.current);

    // Calculate camera position based on yaw, pitch, and distance (like Python)
    const eyeX = cx + CAM_DIST * Math.cos(radPitch) * Math.cos(radYaw);
    const eyeY = cy + CAM_DIST * Math.sin(radPitch);
    const eyeZ = cz + CAM_DIST * Math.cos(radPitch) * Math.sin(radYaw);

    camera.position.set(eyeX, eyeY, eyeZ);
    camera.lookAt(cx, cy, cz);
  });

  return null;
}

export default CameraController;
