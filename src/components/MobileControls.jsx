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

  const handleButtonPress = (button, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Button pressed:', button);
    setActiveButtons(prev => ({ ...prev, [button]: true }));
    if (button === 'jump') {
      if (onJump) onJump(true);
    } else {
      if (onMove) onMove(button, true);
    }
  };

  const handleButtonRelease = (button, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Button released:', button);
    setActiveButtons(prev => ({ ...prev, [button]: false }));
    if (button === 'jump') {
      if (onJump) onJump(false);
    } else {
      if (onMove) onMove(button, false);
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
              onTouchStart={(e) => handleButtonPress('forward', e)}
              onTouchEnd={(e) => handleButtonRelease('forward', e)}
              onTouchCancel={(e) => handleButtonRelease('forward', e)}
              onMouseDown={(e) => handleButtonPress('forward', e)}
              onMouseUp={(e) => handleButtonRelease('forward', e)}
              onMouseLeave={(e) => handleButtonRelease('forward', e)}
            >
              ▲
            </button>
            <div className="dpad-middle">
              <button
                className={`dpad-btn dpad-left ${activeButtons.left ? 'active' : ''}`}
                onTouchStart={(e) => handleButtonPress('left', e)}
                onTouchEnd={(e) => handleButtonRelease('left', e)}
                onTouchCancel={(e) => handleButtonRelease('left', e)}
                onMouseDown={(e) => handleButtonPress('left', e)}
                onMouseUp={(e) => handleButtonRelease('left', e)}
                onMouseLeave={(e) => handleButtonRelease('left', e)}
              >
                ◄
              </button>
              <div className="dpad-center"></div>
              <button
                className={`dpad-btn dpad-right ${activeButtons.right ? 'active' : ''}`}
                onTouchStart={(e) => handleButtonPress('right', e)}
                onTouchEnd={(e) => handleButtonRelease('right', e)}
                onTouchCancel={(e) => handleButtonRelease('right', e)}
                onMouseDown={(e) => handleButtonPress('right', e)}
                onMouseUp={(e) => handleButtonRelease('right', e)}
                onMouseLeave={(e) => handleButtonRelease('right', e)}
              >
                ►
              </button>
            </div>
            <button
              className={`dpad-btn dpad-down ${activeButtons.backward ? 'active' : ''}`}
              onTouchStart={(e) => handleButtonPress('backward', e)}
              onTouchEnd={(e) => handleButtonRelease('backward', e)}
              onTouchCancel={(e) => handleButtonRelease('backward', e)}
              onMouseDown={(e) => handleButtonPress('backward', e)}
              onMouseUp={(e) => handleButtonRelease('backward', e)}
              onMouseLeave={(e) => handleButtonRelease('backward', e)}
            >
              ▼
            </button>
          </div>
        </div>

        {/* Right side - Jump button */}
        <div className="action-controls">
          <button
            className={`jump-btn ${activeButtons.jump ? 'active' : ''}`}
            onTouchStart={(e) => handleButtonPress('jump', e)}
            onTouchEnd={(e) => handleButtonRelease('jump', e)}
            onTouchCancel={(e) => handleButtonRelease('jump', e)}
            onMouseDown={(e) => handleButtonPress('jump', e)}
            onMouseUp={(e) => handleButtonRelease('jump', e)}
            onMouseLeave={(e) => handleButtonRelease('jump', e)}
          >
            JUMP
          </button>
        </div>
      </div>
    </>
  );
}

export default MobileControls;
