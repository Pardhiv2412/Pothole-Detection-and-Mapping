"use client"

import { useState, useEffect, useRef } from "react"
import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { Camera, CameraView } from "expo-camera"
import * as Location from "expo-location"
import axios from "axios"
import { Ionicons } from "@expo/vector-icons"

export default function HomeScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const cameraRef = useRef<any | null>(null)
  const isRecordingRef = useRef(false)
  const locationSubscription = useRef<Location.LocationSubscription | null>(null)
  const locationLog = useRef<{ timestamp: number; coords: Location.LocationObjectCoords }[]>([])

  useEffect(() => {
    ; (async () => {
      // Request permissions
      const cameraStatus = await Camera.requestCameraPermissionsAsync()
      setHasCameraPermission(cameraStatus.status === "granted")

      const locationStatus = await Location.requestForegroundPermissionsAsync()
      setHasLocationPermission(locationStatus.status === "granted")
    })()
  }, [])

  const startLocationTracking = async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 3
      },
      (location) => {
        locationLog.current.push({
          timestamp: Date.now(),
          coords: location.coords,
        })
      },
    )
  }

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove()
      locationSubscription.current = null
    }
    locationLog.current = []
  }

  const uploadVideoWithLocation = async (videoUri: string, startTime: number) => {
    try {
      const formData = new FormData()
      formData.append("file", {
        uri: videoUri,
        name: `${startTime}_recordedVideo.mp4`,
        type: "video/mp4",
      } as any)
      formData.append("locations", JSON.stringify(locationLog.current.filter(entry => entry.timestamp >= startTime)));
      formData.append("startTime", startTime.toString());
      console.log(formData)

      const response = await axios.post("https://jeganz-pothole-api.hf.space/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setMessage("Upload successful!")
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`)
    }
    if (!isRecordingRef.current) {
      setMessage("Recording and Uploading stopped");
    }
  }

  const recordAndUploadContinuously = async () => {
    if (!cameraRef.current) {
      setMessage("Camera not ready")
      return
    }

    isRecordingRef.current = true
    await startLocationTracking() // Start location tracking

    while (isRecordingRef.current) {
      setMessage("Recording")
      const startTime = Date.now()
      try {
        const video = await cameraRef.current.recordAsync({ maxDuration: 5, mute: true, fps: 30 })
        uploadVideoWithLocation(video.uri, startTime)
      } catch (error) {
        setMessage(`Error during recording: ${error.message}`)
        isRecordingRef.current = false
      }
    }

    setMessage("Stopped Recording. Uploading in progress")
    stopLocationTracking() // Stop location tracking
  }

  const stopContinuousRecording = () => {
    isRecordingRef.current = false // Stop the loop
    if (cameraRef.current) {
      cameraRef.current.stopRecording() // Stop the current recording
    }
    setMessage("Recording stopped by user")
  }

  const toggleRecording = () => {
    if (isRecordingRef.current) {
      stopContinuousRecording()
    } else {
      recordAndUploadContinuously()
    }
  }

  if (hasCameraPermission === null || hasLocationPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting permissions...</Text>
      </View>
    )
  }

  if (!hasCameraPermission || !hasLocationPermission) {
    return (
      <View style={styles.container}>
        <Text>No access to camera or location. Please enable permissions in your settings.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <CameraView mode="video" style={styles.camera} ref={cameraRef} />
      </View>

      {message && (
        <View style={styles.messageWrapper}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      <View style={styles.buttonWrapper}>
        <TouchableOpacity style={styles.iconButton} onPress={toggleRecording}>
          <Ionicons name={isRecordingRef.current ? "stop-circle" : "radio-button-on"} size={40} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraWrapper: {
    flex: 1,
    width: "90%",
    height: "50%",
    margin: 20,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  messageWrapper: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#000",
    borderRadius: 5,
  },
  messageText: {
    color: "#fff",
  },
  buttonWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  iconButton: {
    backgroundColor: "#c22b2b",
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    margin: 10,
  },
})

