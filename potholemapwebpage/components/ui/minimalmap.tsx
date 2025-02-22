'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MinimalMap() {
  const mapRef = useRef<L.Map | null>(null)
  const [position, setPosition] = useState<[number, number]>([9.959792, 76.405983]) // Initial position
  const [zoom, setZoom] = useState(15)
  const [potholes, setPotholes] = useState<{ coordinates: [number, number]; severity: number }[]>([])

  const hotColors = [
    [0, 0, 0],       // Black
    [1, 0, 0],       // Red
    [1, 0.5, 0],     // Orange
    [1, 1, 0],       // Yellow
    [1, 1, 1],       // White
  ]

  const getHotColor = (severity: number): string => {
    const ratio = Math.min(Math.max(severity, 0), 10) / 10
    const scaleIndex = Math.floor(ratio * (hotColors.length - 1))
    const color = hotColors[scaleIndex]
    return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`
  }

  useEffect(() => {
    // Fetch potholes from the backend
    const fetchPotholes = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/potholes') // Replace with your backend's URL
        console.log(response);
        
        if (response.ok) {
          const data = await response.json()
          const formattedData = data.map((pothole: any) => ({
            coordinates: [pothole.latitude, pothole.longitude] as [number, number],
            severity: pothole.severity,
          }))
          setPotholes(formattedData)
        } else {
          console.error('Failed to fetch potholes')
        }
      } catch (error) {
        console.error('Error fetching potholes:', error)
      }
    }

    fetchPotholes()

    if (!mapRef.current) {
      mapRef.current = L.map('map').setView(position, zoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (mapRef.current) {
      potholes.forEach((pothole) => {
        const { coordinates, severity } = pothole
        const color = getHotColor(severity)

        L.circleMarker(coordinates, {
          radius: 8,
          fillColor: color,
          color: 'black',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        })
          .bindPopup(`Pothole Severity: ${severity}`)
          .addTo(mapRef.current)
      })
    }
  }, [potholes])

  return <div id="map" className="absolute inset-0" />
}
