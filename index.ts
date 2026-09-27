// The background location task must be registered at module load, before the
// router mounts, so the OS can wake the app into it with no UI running.
import "./src/walk/locationTask";
import "expo-router/entry";
