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
  const videoQueue = []
  const isUploading = useRef(false)
  const uploadCount = useRef(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null)
  const locationLog = useRef<{ timestamp: number; coords: Location.LocationObjectCoords }[]>([])

  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === "granted");

      const audioStatus = await Camera.requestMicrophonePermissionsAsync();

      const locationStatus = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(locationStatus.status === "granted");
    })();
  }, []);

  const startLocationTracking = async (durationMs: number) => {
    locationLog.current = []
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 500, // Track every 500ms
        distanceInterval: 1, // Ensure updates even when stationary
      },
      (location) => {
        locationLog.current.push({
          timestamp: Date.now(),
          coords: location.coords,
        })
      }
    )

    setTimeout(() => {
      if (locationSubscription.current) {
        locationSubscription.current.remove()
        locationSubscription.current = null
      }
      locationLog.current.length = 0
    }, durationMs)
  }

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove()
      locationSubscription.current = null
    }
    locationLog.current.length = 0
  }

  const startAndStopRecording = () => {
    if (isRecordingRef.current) {

      isRecordingRef.current = false;
      stopLocationTracking();
      setMessage("Recording stopped.");
    } else {

      isRecordingRef.current = true;
      setMessage("Recording started...");
      recordAndUpload();
    }
  };

  const recordAndUpload = async () => {
    if (!isRecordingRef.current || !cameraRef.current) {
      return
    }

    while (isRecordingRef.current) {

      try {

        const startTime = Date.now()
        setMessage("Recording video...")
        await startLocationTracking(5000);
        const video = await cameraRef.current.recordAsync({ maxDuration: 5, fps: 30, mute: true })

        if (!isRecordingRef.current) {
          return;
        }

        videoQueue.push({ videoUri: video.uri, startTime, locations: [...locationLog.current] })
        // Start upload process if not already running
        if (!isUploading.current) {
          uploadFromQueue()
        }
      } catch (error) {
        setMessage(`Error: ${error.message}`)
        isRecordingRef.current = false
      }
    }
  }

  const uploadFromQueue = async () => {
    isUploading.current = true

    while (videoQueue.length > 0) {
      const { videoUri, startTime, locations } = videoQueue.shift() // Remove from queue

      uploadCount.current += 1; // Increment count
      try {
        await uploadVideoWithLocation(videoUri, startTime, locations)
        setMessage(`Uploaded video #${uploadCount.current} from queue`)
      } catch (error) {
        setMessage(`Upload failed: ${error.message}`)
      }
    }
    isUploading.current = false
  }
  const uploadVideoWithLocation = async (
    videoUri: string,
    startTime: number,
    Locations: { timestamp: number; coords: Location.LocationObjectCoords }[]

  ) => {
    try {
      const formData = new FormData()
      formData.append("file", {
        uri: videoUri,
        name: `${startTime}_recordedVideo.mp4`,
        type: "video/mp4",
      } as any)
      formData.append("locations", JSON.stringify(Locations))
      formData.append("startTime", startTime.toString())

      const response = await axios.post("https://jeganz-pothole-api.hf.space/upload", formData, {
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
        <TouchableOpacity style={styles.iconButton} onPress={startAndStopRecording}>
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
