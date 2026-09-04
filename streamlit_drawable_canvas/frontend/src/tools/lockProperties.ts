// Not part of Fabric's default toObject() output; listed so these round-trip
// through json_data. selectable/evented deliberately excluded.
export const LOCK_PROPERTIES: string[] = [
  "lockMovementX",
  "lockMovementY",
  "lockRotation",
  "lockScalingX",
  "lockScalingY",
  "lockSkewingX",
  "lockSkewingY",
  "lockScalingFlip",
];
