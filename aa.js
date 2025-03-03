function plotPotholes(potholes) {
    potholeLayer.clearLayers();

    function getMarkerSize(zoom) {
        return Math.max(3, zoom); // Ensures a minimum size of 3
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
