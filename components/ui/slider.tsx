import React from 'react'

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  max: number
  step: number
}

export const Slider: React.FC<SliderProps> = ({ value, onValueChange, max, step }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([Number(event.target.value)])
  }

  return (
    <input
      type="range"
      min="0"
      max={max}
      step={step}
      value={value[0]}
      onChange={handleChange}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    />
  )
}