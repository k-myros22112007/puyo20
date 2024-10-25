'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

// Types
type PuyoColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple' | null
type GameState = 'title' | 'active' | 'over' | 'pause'
type Grid = PuyoColor[][]
type ControlAction = 'left' | 'right' | 'down' | 'rotateLeft' | 'rotateRight' | 'hold'
type Controls = Record<ControlAction, string[]>

// Constants
const GRID_ROWS = 12
const GRID_COLS = 6
const COLORS: PuyoColor[] = ['red', 'green', 'blue', 'yellow', 'purple']

// Helper functions
const createEmptyGrid = (): Grid => Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
const randomPuyoColor = (): PuyoColor => COLORS[Math.floor(Math.random() * COLORS.length)]

interface PuyoPair {
  color1: PuyoColor
  color2: PuyoColor
  x: number
  y: number
  rotation: number
}

// Custom CSS classes (in case Tailwind classes are not available)
const customStyles = `
  .puyo-red { background-color: #EF4444; }
  .puyo-green { background-color: #10B981; }
  .puyo-blue { background-color: #3B82F6; }
  .puyo-yellow { background-color: #F59E0B; }
  .puyo-purple { background-color: #9333EA; }
  .puyo-cell {
    width: 2rem;
    height: 2rem;
    border: 1px solid #D1D5DB;
    transition: all 0.2s;
  }
`

export default function PuyoGame() {
  const [grid, setGrid] = useState<Grid>(createEmptyGrid())
  const [gameState, setGameState] = useState<GameState>('title')
  const [score, setScore] = useState(0)
  const [currentPuyo, setCurrentPuyo] = useState<PuyoPair | null>(null)
  const [nextPuyos, setNextPuyos] = useState<PuyoPair[]>([])
  const [chainCounter, setChainCounter] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const audioContext = useRef<AudioContext | null>(null)
  const [fallSpeed, setFallSpeed] = useState(1000) // 初期落下速度（ミリ秒）
  const fallSpeedRef = useRef(1000) // useEffectで使用するためのref
  const [heldPuyo, setHeldPuyo] = useState<PuyoPair | null>(null)
  const [canHold, setCanHold] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [volume, setVolume] = useState(50)
  const [controls, setControls] = useState<Controls>({
    left: ['a', 'ArrowLeft', ''],
    right: ['d', 'ArrowRight', ''],
    down: ['s', 'ArrowDown', ''],
    rotateLeft: ['o', '', ''],
    rotateRight: ['p', '', ''],
    hold: ['q', ' ', '']
  })

  const generatePuyoPair = useCallback((): PuyoPair => ({
    color1: randomPuyoColor(),
    color2: randomPuyoColor(),
    x: 2,
    y: 0,
    rotation: 0
  }), [])

  const generateNextPuyos = useCallback(() => {
    return Array(4).fill(null).map(() => generatePuyoPair())
  }, [generatePuyoPair])

  useEffect(() => {
    const storedHighScore = localStorage.getItem('puyoPuyoHighScore')
    if (storedHighScore) {
      setHighScore(parseInt(storedHighScore, 10))
    }

    audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }, [])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('puyoPuyoHighScore', score.toString())
    }
  }, [score, highScore])

  const playSound = (frequency: number, duration: number) => {
    if (audioContext.current) {
      const oscillator = audioContext.current.createOscillator()
      const gainNode = audioContext.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.current.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContext.current.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime)

      oscillator.start()
      oscillator.stop(audioContext.current.currentTime + duration)
    }
  }

  const startGame = () => {
    setGrid(createEmptyGrid())
    setScore(0)
    setChainCounter(0)
    const initialNextPuyos = generateNextPuyos()
    setCurrentPuyo(initialNextPuyos[0])
    setNextPuyos(initialNextPuyos.slice(1))
    setGameState('active')
    setIsPaused(false)
    setFallSpeed(1000)
    fallSpeedRef.current = 1000
    setHeldPuyo(null)
    setCanHold(true)
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  const movePuyo = (direction: 'left' | 'right' | 'down') => {
    if (!currentPuyo || gameState !== 'active' || isPaused) return

    const newPuyo = { ...currentPuyo }
    if (direction === 'left') newPuyo.x -= 1
    if (direction === 'right') newPuyo.x += 1
    if (direction === 'down') newPuyo.y += 1

    if (isValidMove(newPuyo)) {
      setCurrentPuyo(newPuyo)
    } else if (direction === 'down') {
      placePuyo()
    }
  }

  const rotatePuyo = (direction: 'left' | 'right') => {
    if (!currentPuyo || gameState !== 'active' || isPaused) return

    const newPuyo = { ...currentPuyo }
    newPuyo.rotation = (newPuyo.rotation + (direction === 'left' ? -1 : 1) + 4) % 4

    if (isValidMove(newPuyo)) {
      setCurrentPuyo(newPuyo)
    }
  }

  const isValidMove = (puyo: PuyoPair): boolean => {
    const { x, y, rotation } = puyo
    const [x2, y2] = getSecondPuyoPosition(x, y, rotation)

    return (
      x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS &&
      x2 >= 0 && x2 < GRID_COLS && y2 >= 0 && y2 < GRID_ROWS &&
      !grid[y][x] && !grid[y2][x2]
    )
  }

  const getSecondPuyoPosition = (x: number, y: number, rotation: number): [number, number] => {
    switch (rotation) {
      case 0: return [x, y - 1]
      case 1: return [x + 1, y]
      case 2: return [x, y + 1]
      case 3: return [x - 1, y]
      default: return [x, y]
    }
  }

  const placePuyo = () => {
    if (!currentPuyo) return

    const newGrid = [...grid]
    const { x, y, color1, color2, rotation } = currentPuyo
    const [x2, y2] = getSecondPuyoPosition(x, y, rotation)

    newGrid[y][x] = color1
    newGrid[y2][x2] = color2

    setGrid(newGrid)
    setCurrentPuyo(nextPuyos[0])
    const newNextPuyos = [...nextPuyos.slice(1), generatePuyoPair()]
    setNextPuyos(newNextPuyos)
    setCanHold(true)

    // 落下判定と消去チェックを行う
    applyGravityAndCheck(newGrid)
  }

  const applyGravityAndCheck = async (grid: Grid) => {
    setIsAnimating(true)
    let newGrid = applyGravity(grid)
    let chainCount = 0
    let hasMatches

    const checkAndUpdateChain = async () => {
      hasMatches = false
      const matchedPuyos: Set<string> = new Set()

      // マッチのチェック
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          if (newGrid[y][x]) {
            const matches = findConnectedPuyos(newGrid, x, y, newGrid[y][x])
            if (matches.size >= 4) {
              hasMatches = true
              matches.forEach(match => matchedPuyos.add(match))
            }
          }
        }
      }

      if (hasMatches) {
        chainCount++
        // マッチしたぷよを削除
        matchedPuyos.forEach(match => {
          const [x, y] = match.split(',').map(Number)
          newGrid[y][x] = null
        })

        // グリッドを更新して消去アニメーションを表示
        setGrid([...newGrid])
        await new Promise(resolve => setTimeout(resolve, 250)) // 0.25秒待機

        // スコア計算
        const puyosCleared = matchedPuyos.size
        const chainMultiplier = Math.pow(2, chainCount - 1)
        const groupSizeBonus = Math.max(0, puyosCleared - 4) * 5
        const points = puyosCleared * 10 * chainMultiplier + groupSizeBonus

        setScore(prevScore => prevScore + points)
        setChainCounter(chainCount)

        // 重力を再度適用
        newGrid = applyGravity(newGrid)
        setGrid([...newGrid])
        await new Promise(resolve => setTimeout(resolve, 250)) // 0.25秒待機

        playSound(500, 0.2) // チェーンリアクションの音を再生
      }
    }

    do {
      await checkAndUpdateChain()
    } while (hasMatches)

    setGrid(newGrid)
    
    // チェーンカウンターをリセットするタイミングを遅らせる
    setTimeout(() => {
      setChainCounter(0)
    }, 5000) // 3秒後にリセット

    // ゲームオーバーのチェック
    if (newGrid[1].some(cell => cell !== null)) {
      setGameState('over')
    }

    setIsAnimating(false)
  }

  const findConnectedPuyos = (grid: Grid, x: number, y: number, color: PuyoColor, visited: Set<string> = new Set()): Set<string> => {
    const key = `${x},${y}`
    if (
      x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS ||
      grid[y][x] !== color || visited.has(key)
    ) {
      return visited
    }

    visited.add(key)

    findConnectedPuyos(grid, x + 1, y, color, visited)
    findConnectedPuyos(grid, x - 1, y, color, visited)
    findConnectedPuyos(grid, x, y + 1, color, visited)
    findConnectedPuyos(grid, x, y - 1, color, visited)

    return visited
  }

  const applyGravity = (grid: Grid): Grid => {
    const newGrid = [...grid]
    for (let x = 0; x < GRID_COLS; x++) {
      let writeY = GRID_ROWS - 1
      for (let y = GRID_ROWS - 1; y >= 0; y--) {
        if (newGrid[y][x] !== null) {
          newGrid[writeY][x] = newGrid[y][x]
          if (writeY !== y) {
            newGrid[y][x] = null
          }
          writeY--
        }
      }
    }
    return newGrid
  }

  // ホールド機能を実装
  const holdPuyo = () => {
    if (!currentPuyo || !canHold || gameState !== 'active' || isPaused) return

    if (heldPuyo) {
      const temp = currentPuyo
      setCurrentPuyo({ ...heldPuyo, x: 2, y: 0, rotation: 0 })
      setHeldPuyo(temp)
    } else {
      setHeldPuyo(currentPuyo)
      setCurrentPuyo(nextPuyos[0])
      setNextPuyos([...nextPuyos.slice(1), generatePuyoPair()])
    }
    setCanHold(false)
  }

  const toggleOptions = () => {
    setShowOptions(!showOptions)
  }

  const handleControlChange = (action: ControlAction, index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setControls(prev => {
      const newKeys = [...prev[action]]
      newKeys[index] = newValue
      return { ...prev, [action]: newKeys }
    })
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'escape') {
        togglePause()
      }
      if (isPaused) return

      const action = Object.entries(controls).find(([_, keys]) => 
        keys.includes(e.key)
      )?.[0] as ControlAction | undefined

      if (action) {
        switch (action) {
          case 'left':
            movePuyo('left')
            playSound(300, 0.1)
            break
          case 'right':
            movePuyo('right')
            playSound(300, 0.1)
            break
          case 'down':
            movePuyo('down')
            playSound(200, 0.1)
            break
          case 'rotateLeft':
            rotatePuyo('left')
            playSound(400, 0.1)
            break
          case 'rotateRight':
            rotatePuyo('right')
            playSound(400, 0.1)
            break
          case 'hold':
            holdPuyo()
            playSound(500, 0.1)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPuyo, gameState, isPaused, movePuyo, rotatePuyo, togglePause, holdPuyo, controls])

  useEffect(() => {
    if (gameState === 'active' && !isPaused && !isAnimating) {
      const gameLoop = setInterval(() => {
        movePuyo('down')
      }, fallSpeed)

      return () => clearInterval(gameLoop)
    }
  }, [gameState, currentPuyo, isPaused, movePuyo, fallSpeed, isAnimating])

  useEffect(() => {
    if (gameState === 'active' && !isPaused) {
      const speedIncreaseInterval = setInterval(() => {
        setFallSpeed(prevSpeed => {
          const newSpeed = prevSpeed / 1.1
          fallSpeedRef.current = newSpeed // refを更新
          return newSpeed
        })
      }, 10000) // 10秒ごとに速度を増加

      return () => clearInterval(speedIncreaseInterval)
    }
  }, [gameState, isPaused])

  const getPuyoColorClass = (color: PuyoColor): string => {
    switch (color) {
      case 'red': return 'bg-red-500 puyo-red'
      case 'green': return 'bg-green-500 puyo-green'
      case 'blue': return 'bg-blue-500 puyo-blue'
      case 'yellow': return 'bg-yellow-500 puyo-yellow'
      case 'purple': return 'bg-purple-500 puyo-purple'
      default: return 'bg-gray-100'
    }
  }

  const renderGrid = () => {
    return grid.map((row, y) => (
      <div key={y} className="flex">
        {row.map((color, x) => (
          <div
            key={`${x}-${y}`}
            className={`puyo-cell ${getPuyoColorClass(color)} z-10`}
            style={{position: 'relative'}}
          />
        ))}
      </div>
    ))
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <style>{customStyles}</style>
      <h1 className="text-4xl font-bold mb-4">改造ぷよぷよ</h1>
      {gameState === 'title' && (
        <div className="text-center">
          <Button onClick={startGame} className="mb-4">ゲームスタート</Button>
          <Button onClick={toggleOptions} className="mb-4 ml-4">オプション</Button>
          <p className="text-xl">ハイスコア: {highScore}</p>
          {showOptions && (
            <div className="mt-4 p-4 bg-white rounded shadow">
              <h2 className="text-2xl font-bold mb-2">オプション</h2>
              <div className="mb-4">
                <label className="block mb-2">音量: {volume}%</label>
                <Slider
                  value={[volume]}
                  onValueChange={(value) => setVolume(value[0])}
                  max={100}
                  step={1}
                />
              </div>
              <div className="mb-4">
                <h3 className="text-xl font-bold mb-2">操作設定</h3>
                {Object.entries(controls).map(([action, keys]) => (
                  <div key={action} className="mb-2">
                    <label className="block mb-1">{action}:</label>
                    <div className="flex gap-2">
                      {keys.map((key, index) => (
                        <input
                          key={index}
                          type="text"
                          value={key}
                          onChange={(e) => handleControlChange(action as ControlAction, index, e)}
                          className="w-1/3 p-2 border rounded"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {gameState === 'active' && (
        <div className="flex flex-col items-center">
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-semibold">Score: {score}</h2>
            <h3 className="text-xl font-semibold">{chainCounter}連鎖</h3>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-semibold mb-2">Hold</h2>
              {heldPuyo && (
                <div className="flex flex-col">
                  <div className={`puyo-cell ${getPuyoColorClass(heldPuyo.color2)}`} />
                  <div className={`puyo-cell ${getPuyoColorClass(heldPuyo.color1)}`} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center">
              <div className="border-2 border-gray-400 relative">
                {renderGrid()}
                {currentPuyo && !isAnimating && (
                  <>
                    <div
                      className={`puyo-cell ${getPuyoColorClass(currentPuyo.color1)} absolute`}
                      style={{
                        left: `${currentPuyo.x * 2}rem`,
                        top: `${currentPuyo.y * 2}rem`,
                        zIndex: 20,
                      }}
                    />
                    <div
                      className={`puyo-cell ${getPuyoColorClass(currentPuyo.color2)} absolute`}
                      style={{
                        left: `${getSecondPuyoPosition(currentPuyo.x, currentPuyo.y, currentPuyo.rotation)[0] * 2}rem`,
                        top: `${getSecondPuyoPosition(currentPuyo.x, currentPuyo.y, currentPuyo.rotation)[1] * 2}rem`,
                        zIndex: 20,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-semibold mb-2">Next</h2>
              {nextPuyos.map((puyo, index) => (
                <div key={index} className="flex flex-col mb-2">
                  <div className={`puyo-cell ${getPuyoColorClass(puyo.color2)}`} />
                  <div className={`puyo-cell ${getPuyoColorClass(puyo.color1)}`} />
                </div>
              ))}
            </div>
          </div>
          <Button onClick={togglePause} className="mt-4">{isPaused ? 'Resume' : 'Pause'}</Button>
        </div>
      )}
      {gameState === 'over' && (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Game Over</h2>
          <p className="text-xl mb-2">Final Score: {score}</p>
          <p className="text-xl mb-4">High Score: {highScore}</p>
          <Button onClick={startGame}>Play Again</Button>
        </div>
      )}
      {isPaused && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg">
            <h2 className="text-3xl font-bold mb-4">Paused</h2>
            <Button onClick={togglePause}>Resume</Button>
          </div>
        </div>
      )}
    </div>
  )
}
