"use client"

import { useEffect, useRef, useState } from "react"
import {
  StyleSheet,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  View,
  FlatList,
  Text,
  Keyboard,
} from "react-native"
import { WebView } from "react-native-webview"
import * as Location from "expo-location"
import { Ionicons } from "@expo/vector-icons"
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
        body {
            padding: 0;
            margin: 0;
        }

        #map {
            height: 100vh;
            width: 100vw;
        }
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

            function getMarkerSize(zoom) {
                return Math.max(3, zoom*0.5); 
            }

            potholes.forEach(({ coordinates, severity }) => {
                const color = getColor(Math.ceil(severity));

                const circleMarker = L.circleMarker(coordinates, {
                    radius: getMarkerSize(map.getZoom()), // Adjust size based on zoom level
                    fillColor: color,
                    color: "black",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.7,
                }).bindPopup('Pothole Severity: ' + severity);

                circleMarker.addTo(potholeLayer);
            });

            map.on("zoomend", () => {
                potholeLayer.eachLayer((layer) => {
                    if (layer instanceof L.CircleMarker) {
                        layer.setRadius(getMarkerSize(map.getZoom())); // Update marker size on zoom
                    }
                });
            });
        }

        function navigateToLocation(lat, lng, name) {
            map.setView([lat, lng], 15);
            L.popup()
                .setLatLng([lat, lng])
                .setContent(name)
                .openOn(map);
        }

        window.updateLocation = updateLocation;
        window.plotPotholes = plotPotholes;
        window.navigateToLocation = navigateToLocation;
    </script>
</body>

</html>
`

interface Pothole {
  coordinates: [number, number]
  severity: string
}

interface LocationSuggestion {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export default function TabTwoScreen() {
  const webViewRef = useRef(null)
  const [location, setLocation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)

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
      console.error("Error fetching potholes: ", error)
    } finally {
      setIsLoading(false)
    }
  }

  const searchLocations = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
  
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'User-Agent': 'Pothole-Detection-App/1.0 (your.email@example.com)', // Replace with your app name and contact
          },
        }
      );
      console.log("Search response:", response);
      if (response.ok) {
        const data = await response.json();
        console.log("Search results:", data);
        setSuggestions(data);
      } else {
        console.error("Failed to fetch suggestions:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (location: LocationSuggestion) => {
    webViewRef.current?.injectJavaScript(`
      navigateToLocation(${location.lat}, ${location.lon}, "${location.display_name.replace(/"/g, '\\"')}");
      true;
    `)
    setSearchQuery("")
    setSuggestions([])
    Keyboard.dismiss()
  }

  useEffect(() => {
    fetchPotholes()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      searchLocations(searchQuery)
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("")
                setSuggestions([])
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSelectLocation(item)}>
                  <Ionicons name="location-outline" size={16} color="#666" style={styles.suggestionIcon} />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {isSearching && (
          <View style={styles.searchingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.searchingText}>Searching...</Text>
          </View>
        )}
      </View>

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
    marginBottom: 10,
  },
  searchContainer: {
    marginBottom: 10,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  suggestionsContainer: {
    backgroundColor: "white",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
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
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
  },
  searchingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    backgroundColor: "white",
    borderRadius: 8,
    marginTop: 4,
  },
  searchingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
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

