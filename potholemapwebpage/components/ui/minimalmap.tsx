"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { RefreshCw, Crosshair } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MinimalMap() {
  const mapRef = useRef<L.Map | null>(null)
  const [position, setPosition] = useState<[number, number]>([9.959792, 76.405983]) // Initial position
  const [zoom, setZoom] = useState(15)
  const [potholes, setPotholes] = useState<{ coordinates: [number, number]; severity: number }[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const severityLegend = [
    { severity: 1, color: "#FFFF00", label: "Very Low" },
    { severity: 2, color: "#FFD700", label: "Low" },
    { severity: 3, color: "#FFA500", label: "Medium" },
    { severity: 4, color: "#FF4500", label: "High" },
    { severity: 5, color: "#FF0000", label: "Very High" },
  ]

  function getColor(severity: number) {
    switch (severity) {
      case 1:
        return "#FFFF00" // Yellow
      case 2:
        return "#FFD700" // Light Orange
      case 3:
        return "#FFA500" // Orange
      case 4:
        return "#FF4500" // Dark Orange
      case 5:
        return "#FF0000" // Red
      default:
        return "#808080" // Gray for invalid values
    }
  }

  const fetchPotholes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("https://jeganz-yolo-flask-api.hf.space/potholes")
      console.log(response)

      if (response.ok) {
        const data = await response.json()
        const formattedData = data.map((pothole: any) => ({
          coordinates: [pothole.latitude, pothole.longitude] as [number, number],
          severity: pothole.severity,
        }))
        setPotholes(formattedData)
      } else {
        console.error("Failed to fetch potholes")
      }
    } catch (error) {
      console.error("Error fetching potholes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current?.setView([latitude, longitude], zoom);
        },
        (error) => {
          if (error.code === 1) {
            alert("Location access denied. Please allow location in browser settings and reload.");
            navigator.permissions.query({ name: "geolocation" }).then((permissionStatus) => {
              if (permissionStatus.state === "denied") {
                console.warn("User has blocked location access.");
              } else {
                console.log("User granted location access.");
              }
            });
          } else {
            console.error("Error getting location:", error.message);
          }
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };
  

  useEffect(() => {
    fetchPotholes()

    if (!mapRef.current) {
      mapRef.current = L.map("map").setView(position, zoom)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current)
    }
  }, [position, zoom]) // Added dependencies

  useEffect(() => {
    if (mapRef.current) {
      // Clear existing markers
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.remove()
        }
      })

      // Add new markers
      potholes.forEach((pothole) => {
        const { coordinates, severity } = pothole
        const integerSeverity = Math.floor(severity)
        const color = getColor(integerSeverity)
        L.circleMarker(coordinates, {
          radius: 8,
          fillColor: color,
          color: "black",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        })
          .bindPopup(`Pothole Severity: ${severity}`)
          .addTo(mapRef.current)
      })
    }
  }, [potholes])
  
  return (
    <div className="relative h-screen w-full">
      <div id="map" className="absolute inset-0" />

      {/* Floating Action Buttons */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-4 z-[1000]">
        <Button
          variant="secondary"
          size="icon"
          className="w-12 h-12 rounded-full bg-white shadow-lg hover:bg-gray-100 transition-all duration-200"
          onClick={getCurrentLocation}
        >
          <Crosshair className="h-6 w-6 text-gray-700" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className={`w-12 h-12 rounded-full bg-white shadow-lg hover:bg-gray-100 transition-all duration-200 
            ${isLoading ? "animate-spin" : ""}`}
          onClick={fetchPotholes}
          disabled={isLoading}
        >
          <RefreshCw className="h-6 w-6 text-gray-700" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute top-8 right-8 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <h3 className="text-sm font-semibold mb-2">Severity Legend</h3>
        <div className="space-y-2">
          {severityLegend.map(({ severity, color, label }) => (
            <div key={severity} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-black" style={{ backgroundColor: color }} />
              <span className="text-sm">
                {label} ({severity})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

