import { useEffect, useRef } from 'react'
import Phaser from 'phaser'

interface GameCanvasProps {
  guests: number
}

export function GameCanvas({ guests }: GameCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const textRef = useRef<Phaser.GameObjects.Text | null>(null)

  useEffect(() => {
    if (!rootRef.current || gameRef.current) {
      return
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 300,
      height: 120,
      parent: rootRef.current,
      transparent: true,
      scene: {
        create() {
          this.add.rectangle(150, 60, 270, 95, 0x234f3b, 0.8).setStrokeStyle(2, 0x6ed6a3)
          this.add.text(16, 16, 'GamedIn Onsen', {
            color: '#dfffea',
            fontSize: '14px',
            fontFamily: 'Arial',
          })
          textRef.current = this.add.text(16, 44, `Guests: ${guests}`, {
            color: '#dfffea',
            fontSize: '13px',
            fontFamily: 'Arial',
          })
        },
      },
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      textRef.current = null
    }
  }, [guests])

  useEffect(() => {
    textRef.current?.setText(`Guests relaxing: ${guests}`)
  }, [guests])

  return <div className="game-canvas" ref={rootRef} />
}
