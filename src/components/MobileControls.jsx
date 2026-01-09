import React, { useRef, useEffect, useState } from 'react';
import './MobileControls.css';

function MobileControls({ onCameraMove, onMove, onJump, enabled }) {
  const touchAreaRef = useRef(null);
  const [activeButtons, setActiveButtons] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
  });

  // Handle touch-based camera control
  useEffect(() => {
    if (!enabled) return;
    
    const touchArea = touchAreaRef.current;
    if (!touchArea) return;

    let lastTouchX = null;
    let lastTouchY = null;
    let touchId = null;

    const handleTouchStart = (e) => {
      if (e.touches.length > 0 && touchId === null) {
        const touch = e.touches[0];
        touchId = touch.identifier;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (touchId === null) return;
      
      // Find the touch with our ID
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === touchId) {
          const deltaX = touch.clientX - lastTouchX;
          const deltaY = touch.clientY - lastTouchY;
          
          if (onCameraMove) {
            onCameraMove(deltaX, deltaY);
          }
          
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          break;
        }
      }
      
      e.preventDefault();
    };

    const handleTouchEnd = (e) => {
      // Check if our tracked touch ended
      let found = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchId) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        touchId = null;
        lastTouchX = null;
        lastTouchY = null;
      }
    };

    touchArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    touchArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchArea.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      touchArea.removeEventListener('touchstart', handleTouchStart);
      touchArea.removeEventListener('touchmove', handleTouchMove);
      touchArea.removeEventListener('touchend', handleTouchEnd);
      touchArea.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, onCameraMove]);

  const handleButtonPress = (button) => {
    setActiveButtons(prev => ({ ...prev, [button]: true }));
    if (button === 'jump') {
      onJump(true);
    } else {
      onMove(button, true);
    }
  };

  const handleButtonRelease = (button) => {
    setActiveButtons(prev => ({ ...prev, [button]: false }));
    if (button === 'jump') {
      onJump(false);
    } else {
      onMove(button, false);
    }
  };

  if (!enabled) return null;

  return (
    <>
      {/* Touch area for camera control */}
      <div ref={touchAreaRef} className="mobile-touch-area">
        <div className="touch-hint">Touch & Drag to Look Around</div>
      </div>

      {/* Movement controls */}
      <div className="mobile-controls">
        {/* Left side - D-pad for movement */}
        <div className="movement-controls">
          <div className="dpad">
            <button
              className={`dpad-btn dpad-up ${activeButtons.forward ? 'active' : ''}`}
              onTouchStart={() => handleButtonPress('forward')}
              onTouchEnd={() => handleButtonRelease('forward')}
              onMouseDown={() => handleButtonPress('forward')}
              onMouseUp={() => handleButtonRelease('forward')}
              onMouseLeave={() => handleButtonRelease('forward')}
            >
              ▲
            </button>
            <div className="dpad-middle">
              <button
                className={`dpad-btn dpad-left ${activeButtons.left ? 'active' : ''}`}
                onTouchStart={() => handleButtonPress('left')}
                onTouchEnd={() => handleButtonRelease('left')}
                onMouseDown={() => handleButtonPress('left')}
                onMouseUp={() => handleButtonRelease('left')}
                onMouseLeave={() => handleButtonRelease('left')}
              >
                ◄
              </button>
              <div className="dpad-center"></div>
              <button
                className={`dpad-btn dpad-right ${activeButtons.right ? 'active' : ''}`}
                onTouchStart={() => handleButtonPress('right')}
                onTouchEnd={() => handleButtonRelease('right')}
                onMouseDown={() => handleButtonPress('right')}
                onMouseUp={() => handleButtonRelease('right')}
                onMouseLeave={() => handleButtonRelease('right')}
              >
                ►
              </button>
            </div>
            <button
              className={`dpad-btn dpad-down ${activeButtons.backward ? 'active' : ''}`}
              onTouchStart={() => handleButtonPress('backward')}
              onTouchEnd={() => handleButtonRelease('backward')}
              onMouseDown={() => handleButtonPress('backward')}
              onMouseUp={() => handleButtonRelease('backward')}
              onMouseLeave={() => handleButtonRelease('backward')}
            >
              ▼
            </button>
          </div>
        </div>

        {/* Right side - Jump button */}
        <div className="action-controls">
          <button
            className={`jump-btn ${activeButtons.jump ? 'active' : ''}`}
            onTouchStart={() => handleButtonPress('jump')}
            onTouchEnd={() => handleButtonRelease('jump')}
            onMouseDown={() => handleButtonPress('jump')}
            onMouseUp={() => handleButtonRelease('jump')}
            onMouseLeave={() => handleButtonRelease('jump')}
          >
            JUMP
          </button>
        </div>
      </div>
    </>
  );
}

export default MobileControls;
