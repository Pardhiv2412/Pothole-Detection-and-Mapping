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

  useEffect(() => {
    ;(async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync()
      setHasCameraPermission(cameraStatus.status === "granted")

      const locationStatus = await Location.requestForegroundPermissionsAsync()
      setHasLocationPermission(locationStatus.status === "granted")
    })()
  }, [])

  const recordAndUpload = async () => {
    if (!cameraRef.current) {
      setMessage("Camera not ready")
      return
    }

    isRecordingRef.current = true
    setMessage("Capturing start location...")

    try {
      // Capture start location
      const startLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })
      const startTime = Date.now()

      setMessage("Recording video...")
      const video = await cameraRef.current.recordAsync({ maxDuration: 1, fps: 30 , mute: true})
      
      setMessage("Capturing end location...")
      // Capture end location
      const endLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })

      setMessage("Uploading...")
      await uploadVideoWithLocation(video.uri, startTime, startLocation, endLocation)
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    } finally {
      isRecordingRef.current = false
    }
  }

  const uploadVideoWithLocation = async (
    videoUri: string,
    startTime: number,
    startLocation: Location.LocationObjectCoords,
    endLocation: Location.LocationObjectCoords
  ) => {
    try {
      const formData = new FormData()
      formData.append("file", {
        uri: videoUri,
        name: `${startTime}_recordedVideo.mp4`,
        type: "video/mp4",
      } as any)
      formData.append("startLocation", JSON.stringify(startLocation))
      formData.append("endLocation", JSON.stringify(endLocation))
      formData.append("startTime", startTime.toString())

      const response = await axios.post("https://jeganz-yolo-flask-api.hf.space/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      console.log(response.data);
      
      setMessage("Upload successful!")
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`)
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
        <Text>No access to camera or location. Please enable permissions in settings.</Text>
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
        <TouchableOpacity style={styles.iconButton} onPress={recordAndUpload}>
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
