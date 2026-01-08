import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

function SequenceManager({ 
  gameState,
  startTriggered,
  sequenceState, 
  setSequenceState,
  vanishTimer,
  setVanishTimer,
  trapTimer,
  setTrapTimer,
  currentBlockIndex,
  gateFloating,
  gateAtStart,
  reverseVanishActive,
  setReverseVanishActive,
  reverseVanishTimer,
  setReverseVanishTimer,
  reverseVanishIndex,
  setReverseVanishIndex,
  setMiddleBlocks,
  setBlocks
}) {
  const prevBlockIndexRef = useRef(-1);
  const block0Hidden = useRef(false);
  const block1Hidden = useRef(false);
  const block2Hidden = useRef(false);
  const reverseVanishTriggered = useRef(false);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;

    // Sequence state machine
    if (startTriggered && !gateFloating) {
      if (sequenceState === 1) {
        // Countdown timer
        setVanishTimer(prev => {
          const newTimer = prev - delta;
          if (newTimer <= 0) {
            setSequenceState(2);
            // Show first middle block
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[0]) updated[0].visible = true;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 0);
              if (idx !== -1) updated[idx].visible = true;
              return updated;
            });
          }
          return newTimer;
        });
      } else if (sequenceState === 2 && currentBlockIndex === 0 && prevBlockIndexRef.current !== 0) {
        setSequenceState(3);
        setMiddleBlocks(prevMiddle => {
          const updated = [...prevMiddle];
          if (updated[1]) updated[1].visible = true;
          return updated;
        });
        setBlocks(prevBlocks => {
          const updated = [...prevBlocks];
          const idx = updated.findIndex(b => b.index === 1);
          if (idx !== -1) updated[idx].visible = true;
          return updated;
        });
      } else if (sequenceState === 3 && currentBlockIndex === 1 && prevBlockIndexRef.current !== 1) {
        setSequenceState(4);
        setMiddleBlocks(prevMiddle => {
          const updated = [...prevMiddle];
          if (updated[2]) updated[2].visible = true;
          return updated;
        });
        setBlocks(prevBlocks => {
          const updated = [...prevBlocks];
          const idx = updated.findIndex(b => b.index === 2);
          if (idx !== -1) updated[idx].visible = true;
          return updated;
        });
      } else if (sequenceState === 4 && currentBlockIndex === 2 && prevBlockIndexRef.current !== 2) {
        setSequenceState(5);
        setMiddleBlocks(prevMiddle => {
          const updated = [...prevMiddle];
          if (updated[3]) updated[3].visible = true;
          return updated;
        });
        setBlocks(prevBlocks => {
          const updated = [...prevBlocks];
          const idx = updated.findIndex(b => b.index === 3);
          if (idx !== -1) updated[idx].visible = true;
          return updated;
        });
      } else if (sequenceState === 5 && currentBlockIndex === 3 && prevBlockIndexRef.current !== 3) {
        setSequenceState(6);
        setTrapTimer(0);
        block0Hidden.current = false;
        block1Hidden.current = false;
        block2Hidden.current = false;
      } else if (sequenceState === 6) {
        setTrapTimer(prev => {
          const newTimer = prev + delta;
          
          if (newTimer > 0 && !block0Hidden.current) {
            block0Hidden.current = true;
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[0]) updated[0].visible = false;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 0);
              if (idx !== -1) updated[idx].visible = false;
              return updated;
            });
          }
          if (newTimer > 0.5 && !block1Hidden.current) {
            block1Hidden.current = true;
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[1]) updated[1].visible = false;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 1);
              if (idx !== -1) updated[idx].visible = false;
              return updated;
            });
          }
          if (newTimer > 1.0 && !block2Hidden.current) {
            block2Hidden.current = true;
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[2]) updated[2].visible = false;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 2);
              if (idx !== -1) updated[idx].visible = false;
              return updated;
            });
            
            // Show block 4 briefly
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[4]) updated[4].visible = true;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 4);
              if (idx !== -1) updated[idx].visible = true;
              return updated;
            });
          }
          if (newTimer >= 1.6 && newTimer < 2.6) {
            // Hide block 4
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[4]) updated[4].visible = false;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 4);
              if (idx !== -1) updated[idx].visible = false;
              return updated;
            });
          } else if (newTimer >= 2.6 && newTimer < 3.0) {
            // Show block 4 permanently
            setMiddleBlocks(prevMiddle => {
              const updated = [...prevMiddle];
              if (updated[4]) updated[4].visible = true;
              return updated;
            });
            setBlocks(prevBlocks => {
              const updated = [...prevBlocks];
              const idx = updated.findIndex(b => b.index === 4);
              if (idx !== -1) updated[idx].visible = true;
              return updated;
            });
          }
          if (newTimer > 3.0) {
            setMiddleBlocks(prevMiddle => prevMiddle.map(b => ({ ...b, visible: true })));
            setBlocks(prevBlocks => prevBlocks.map(b => {
              if (b.index >= 0 && b.index <= 4) return { ...b, visible: true };
              return b;
            }));
            setSequenceState(7);
          }
          
          return newTimer;
        });
      }
    }

    // Reverse vanish sequence - triggers when player lands on block 4 after gate teleports
    if (gateAtStart && currentBlockIndex === 4 && !reverseVanishTriggered.current && prevBlockIndexRef.current !== 4) {
      reverseVanishTriggered.current = true;
      setReverseVanishActive(true);
      setReverseVanishTimer(0);
      setReverseVanishIndex(4);
    }

    if (reverseVanishActive) {
      setReverseVanishTimer(prev => {
        const newTimer = prev + delta;
        if (newTimer > 1.3) {
          setReverseVanishIndex(prevIdx => {
            if (prevIdx >= 0) {
              setMiddleBlocks(prevMiddle => {
                const updated = [...prevMiddle];
                if (updated[prevIdx]) updated[prevIdx].visible = false;
                return updated;
              });
              setBlocks(prevBlocks => {
                const updated = [...prevBlocks];
                const idx = updated.findIndex(b => b.index === prevIdx);
                if (idx !== -1) updated[idx].visible = false;
                return updated;
              });
              return prevIdx - 1;
            }
            return prevIdx;
          });
          return 0;
        }
        return newTimer;
      });
    }

    prevBlockIndexRef.current = currentBlockIndex;
  });

  return null;
}

export default SequenceManager;
