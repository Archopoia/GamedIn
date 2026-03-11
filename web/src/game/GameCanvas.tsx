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
      width: 420,
      height: 180,
      parent: rootRef.current,
      transparent: true,
      scene: {
        create() {
          this.add.rectangle(210, 95, 390, 145, 0x234f3b, 0.8).setStrokeStyle(2, 0x6ed6a3)
          this.add.text(24, 26, 'GamedIn Onsen', {
            color: '#dfffea',
            fontSize: '20px',
            fontFamily: 'Arial',
          })
          textRef.current = this.add.text(24, 66, `Guests relaxing: ${guests}`, {
            color: '#dfffea',
            fontSize: '17px',
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
