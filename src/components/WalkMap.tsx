import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, UserLocation } from "@maplibre/maplibre-react-native";
import type { PathPoint } from "../walk/capture";
import { colors } from "../theme";

/**
 * The walking map — MapLibre (open source) with OpenFreeMap's dark style:
 * free, no API key, no usage caps. OpenFreeMap requires its attribution,
 * which MapLibre shows through the (i) button, so `attribution` stays on.
 *
 * The route glows from brass (start) to flag red (now), the v3 route
 * signature. It breaks at gap points — signal loss or a pause — instead of
 * drawing a straight line across ground the walker may not have covered,
 * exactly as the website's map does.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

function toSegments(points: PathPoint[]) {
  const segs: number[][][] = [];
  let cur: number[][] = [];
  for (const p of points) {
    if (p.gap && cur.length) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push([p.lng, p.lat]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

export function WalkMap({
  points,
  following = true,
  bottomInset = 0,
  fitRoute = false,
}: {
  points: PathPoint[];
  following?: boolean;
  /** Height covered by a bottom sheet, so the walker's dot stays in view above it. */
  bottomInset?: number;
  /** Frame the whole route instead of following the walker (replay). */
  fitRoute?: boolean;
}) {
  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    const segs = toSegments(points);
    return {
      type: "FeatureCollection",
      features: segs.map((coords, i) => ({
        type: "Feature",
        id: i,
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      })),
    };
  }, [points]);

  const last = points[points.length - 1];
  const bounds = useMemo(() => {
    if (!fitRoute || points.length < 2) return null;
    let w = Infinity, so = Infinity, e = -Infinity, n = -Infinity;
    for (const p of points) {
      w = Math.min(w, p.lng); e = Math.max(e, p.lng);
      so = Math.min(so, p.lat); n = Math.max(n, p.lat);
    }
    return [w, so, e, n] as [number, number, number, number];
  }, [fitRoute, points]);
  const padding = { top: 90, left: 40, right: 40, bottom: bottomInset + 30 };

  return (
    <View style={styles.wrap}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE_URL}
        logo={false}
        compass={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        {bounds ? (
          <Camera bounds={bounds} padding={padding} pitch={40} duration={0} />
        ) : (
          <Camera
            trackUserLocation={following ? "course" : undefined}
            initialViewState={last ? { center: [last.lng, last.lat], zoom: 16 } : { zoom: 3, center: [-82.46, 27.95] }}
            zoom={16}
            pitch={following ? 45 : 0}
            padding={{ bottom: bottomInset }}
          />
        )}
        <GeoJSONSource id="route" data={data} lineMetrics>
          <Layer
            id="route-glow"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": colors.redBright, "line-width": 16, "line-opacity": 0.18, "line-blur": 4 }}
          />
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-width": 5,
              "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, colors.brass, 1, colors.redBright],
            }}
          />
        </GeoJSONSource>
        {!fitRoute && <UserLocation accuracy heading />}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.ink },
});
