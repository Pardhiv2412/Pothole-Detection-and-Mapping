"use client"

import { useEffect, useRef, useState } from "react"
import { StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from "react-native"
import { WebView } from "react-native-webview"
import * as Location from "expo-location"
import { Ionicons } from "@expo/vector-icons"

import { ThemedText } from "@/components/ThemedText"
import { ThemedView } from "@/components/ThemedView"

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <style>
        body { padding: 0; margin: 0; }
        #map { height: 100vh; width: 100vw; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map').setView([9.959792, 76.405983], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://github.com/Pardhiv2412/Pothole-Detection-and-Mapping">UKP Mex</a> 2025'
        }).addTo(map);

        var userMarker;
        var potholeLayer = L.layerGroup().addTo(map);

        function updateLocation(lat, lng) {
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            userMarker = L.marker([lat, lng], { color: "blue" }).addTo(map);
            map.setView([lat, lng], 15);
        }

        function getColor(severity) {
    switch (severity) {
        case 1: return "#FFFF00"; // Yellow
        case 2: return "#FFD700"; // Light Orange
        case 3: return "#FFA500"; // Orange
        case 4: return "#FF4500"; // Dark Orange
        case 5: return "#FF0000"; // Red
        default: return "#808080"; // Gray for invalid values
    }
}

function plotPotholes(potholes) {
    potholeLayer.clearLayers();
    potholes.forEach(({ coordinates, severity }) => {
        const color = getColor(Math.round(severity)); // Ensure severity is an integer from 1 to 5
        L.circleMarker(coordinates, {
            radius: 8,
            fillColor: color,
            color: "black",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7,
        })
        .bindPopup('Pothole Severity: ' + severity)
        .addTo(potholeLayer);
    });
}

        window.updateLocation = updateLocation;
        window.plotPotholes = plotPotholes;
    </script>
</body>
</html>
`

export default function TabTwoScreen() {
  const webViewRef = useRef(null)
  const [location, setLocation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") {
      console.log("Permission to access location was denied")
      return
    }

    const location = await Location.getCurrentPositionAsync({})
    setLocation(location)

    webViewRef.current?.injectJavaScript(`
      updateLocation(${location.coords.latitude}, ${location.coords.longitude});
      true;
    `)
  }

  const fetchPotholes = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("https://jeganz-pothole-api.hf.space/potholes")
      if (response.ok) {
        const data = await response.json()
        const formattedData = data.map((pothole) => ({
          coordinates: [pothole.latitude, pothole.longitude],
          severity: pothole.severity,
        }))

        webViewRef.current?.injectJavaScript(`
          plotPotholes(${JSON.stringify(formattedData)});
          true;
        `)
      } else {
        console.error("Failed to fetch potholes")
      }
    } catch (error) {
      console.error("Error fetching potholes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPotholes()
  }, [])

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>UKP Meps</ThemedText>
      <ThemedView style={styles.mapContainer}>
        <WebView ref={webViewRef} source={{ html: LEAFLET_HTML }} style={styles.map} />
      </ThemedView>
      <TouchableOpacity
        style={[styles.floatingButton, styles.refreshButton]}
        onPress={fetchPotholes}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons name="refresh" size={24} color="white" />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.floatingButton} onPress={getCurrentLocation}>
        <Ionicons name="location" size={24} color="white" />
      </TouchableOpacity>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  map: {
    flex: 1,
  },
  floatingButton: {
    position: "absolute",
    bottom: 32,
    right: 32,
    backgroundColor: "#007AFF",
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
      },
    }),
  },
  refreshButton: {
    left: 32,
    right: undefined,
  },
})

