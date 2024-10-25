'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"

// Types
type PuyoColor = 'red' | 'green' | 'blue' | 'yellow' | null
type GameState = 'title' | 'active' | 'over' | 'pause'
type Grid = PuyoColor[][]

// Constants
const GRID_ROWS = 12
const GRID_COLS = 6
const COLORS: PuyoColor[] = ['red', 'green', 'blue', 'yellow']

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
  const [nextPuyo, setNextPuyo] = useState<PuyoPair | null>(null)
  const [chainCounter, setChainCounter] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const audioContext = useRef<AudioContext | null>(null)
  const [fallSpeed, setFallSpeed] = useState(1000) // 初期落下速度（ミリ秒）
  const fallSpeedRef = useRef(1000) // useEffectで使用するためのref

  const generatePuyoPair = useCallback((): PuyoPair => ({
    color1: randomPuyoColor(),
    color2: randomPuyoColor(),
    x: 2,
    y: 0,
    rotation: 0
  }), [])

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
    setCurrentPuyo(generatePuyoPair())
    setNextPuyo(generatePuyoPair())
    setGameState('active')
    setIsPaused(false)
    setFallSpeed(1000) // 落下速度をリセット
    fallSpeedRef.current = 1000 // refもリセット
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
    setCurrentPuyo(null)
    checkForMatches(newGrid)
  }

  const checkForMatches = (grid: Grid) => {
    let newGrid = [...grid]
    let chainCount = 0
    let hasMatches

    const checkAndUpdateChain = () => {
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

        // スコア計算
        const puyosCleared = matchedPuyos.size
        const chainMultiplier = Math.pow(2, chainCount - 1)
        const groupSizeBonus = Math.max(0, puyosCleared - 4) * 5
        const points = puyosCleared * 10 * chainMultiplier + groupSizeBonus

        setScore(prevScore => prevScore + points)
        setChainCounter(chainCount)

        // 重力を適用
        newGrid = applyGravity(newGrid)

        playSound(500, 0.2) // チェーンリアクションの音を再生
      }
    }

    do {
      checkAndUpdateChain()
    } while (hasMatches)

    setGrid(newGrid)
    setCurrentPuyo(nextPuyo)
    setNextPuyo(generatePuyoPair())
    
    // チェーンカウンターをリセットするタイミングを遅らせる
    setTimeout(() => {
      setChainCounter(0)
    }, 1000) // 1秒後にリセット

    // ゲームオーバーのチェック
    if (newGrid[1].some(cell => cell !== null)) {
      setGameState('over')
    }
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

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'escape') {
        togglePause()
      }
      if (isPaused) return

      switch (e.key.toLowerCase()) {
        case 'a': movePuyo('left'); playSound(300, 0.1); break
        case 'd': movePuyo('right'); playSound(300, 0.1); break
        case 's': movePuyo('down'); playSound(200, 0.1); break
        case 'o': rotatePuyo('left'); playSound(400, 0.1); break
        case 'p': rotatePuyo('right'); playSound(400, 0.1); break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPuyo, gameState, isPaused, movePuyo, rotatePuyo, togglePause])

  useEffect(() => {
    if (gameState === 'active' && !isPaused) {
      const gameLoop = setInterval(() => {
        movePuyo('down')
      }, fallSpeed) // fallSpeedを使用

      return () => clearInterval(gameLoop)
    }
  }, [gameState, currentPuyo, isPaused, movePuyo, fallSpeed])

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
      <h1 className="text-4xl font-bold mb-4">Puyo Puyo</h1>
      {gameState === 'title' && (
        <div className="text-center">
          <Button onClick={startGame} className="mb-4">Start Game</Button>
          <p className="text-xl">High Score: {highScore}</p>
        </div>
      )}
      {gameState === 'active' && (
        <div className="flex flex-col items-center">
          <div className="flex gap-8 mb-4">
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-semibold mb-2">Next Puyo</h2>
              {nextPuyo && (
                <div className="flex flex-col">
                  <div className={`puyo-cell ${getPuyoColorClass(nextPuyo.color2)}`} />
                  <div className={`puyo-cell ${getPuyoColorClass(nextPuyo.color1)}`} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-semibold mb-2">Score: {score}</h2>
              <h3 className="text-xl font-semibold mb-2">Chain: {chainCounter}</h3>
              <div className="border-2 border-gray-400 relative">
                {renderGrid()}
                {currentPuyo && (
                  <>
                    <div
                      className={`puyo-cell ${getPuyoColorClass(currentPuyo.color1)} absolute`}
                      style={{
                        left: `${currentPuyo.x  * 2}rem`,
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
          </div>
          <Button onClick={togglePause}>{isPaused ? 'Resume' : 'Pause'}</Button>
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