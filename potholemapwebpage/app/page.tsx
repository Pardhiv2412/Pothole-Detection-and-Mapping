'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Moon, Sun, Layers, ZoomIn, ZoomOut, Home } from 'lucide-react'
import { Button } from "@/components/ui/button"

// Dynamically import the map component (disable SSR)
const MinimalMap = dynamic(() => import('@/components/ui/minimalmap'), { ssr: false })

export default function MapPage() {
  const [darkMode, setDarkMode] = useState(false)

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark', !darkMode);
    setDarkMode(!darkMode)
  }

  return (
    <div className={`flex flex-col h-screen bg-gray-100 dark:bg-gray-900`}>
      <header className="shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Pothole Map</h1>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </header>
      <main className="flex-grow relative p-4 flex">
        {/* Container for the map */}
        <div className="relative w-[80%] h-full rounded-3xl overflow-hidden border border-gray-300 dark:border-gray-600 shadow-lg">
          {/* Dynamically loaded map */}
          <MinimalMap />
        </div>
        {/* Buttons container */}
        <div className="w-[20%] pl-4 flex flex-col justify-center space-y-2">
          <Button 
            variant="secondary" 
            className="justify-start hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200" 
            aria-label="Toggle layers"
          >
            <Layers className="h-4 w-4 mr-2" />
            <span>Layers</span>
          </Button>
          <Button 
            variant="secondary" 
            className="justify-start hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200" 
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4 mr-2" />
            <span>Zoom In</span>
          </Button>
          <Button 
            variant="secondary" 
            className="justify-start hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200" 
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4 mr-2" />
            <span>Zoom Out</span>
          </Button>
          <Button 
            variant="secondary" 
            className="justify-start hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200" 
            aria-label="Reset view"
          >
            <Home className="h-4 w-4 mr-2" />
            <span>Reset View</span>
          </Button>
        </div>
        {/* Coordinates display */}
        <div className="absolute bottom-8 left-8 bg-white dark:bg-gray-800 bg-opacity-90 p-3 rounded-lg shadow-md z-[1000] text-sm text-gray-800 dark:text-white">
          {/* Add any dynamic display for coordinates if needed */}
        </div>
      </main>
    </div>
  )
}
