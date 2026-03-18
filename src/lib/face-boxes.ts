export type FaceBox = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function clampFaceBox(box: FaceBox): FaceBox {
  const widthPct = Math.max(7, Math.min(24, box.widthPct));
  const heightPct = Math.max(9, Math.min(28, box.heightPct));

  return {
    leftPct: clampPercentage(Math.min(box.leftPct, 100 - widthPct)),
    topPct: clampPercentage(Math.min(box.topPct, 100 - heightPct)),
    widthPct,
    heightPct,
  };
}

export function tightenDetectedFaceBox(box: FaceBox): FaceBox {
  const widthPct = Math.max(8, Math.min(22, box.widthPct * 0.84));
  const heightPct = Math.max(10, Math.min(26, box.heightPct * 0.86));
  const centerX = box.leftPct + box.widthPct / 2;
  const centerY = box.topPct + box.heightPct / 2;

  return clampFaceBox({
    leftPct: centerX - widthPct / 2,
    topPct: centerY - heightPct / 2,
    widthPct,
    heightPct,
  });
}

export function deriveFallbackFaceBox(xPct: number, yPct: number): FaceBox {
  return clampFaceBox({
    leftPct: xPct - 9,
    topPct: yPct - 11,
    widthPct: 18,
    heightPct: 22,
  });
}

function pointToFaceDistance(xPct: number, yPct: number, face: FaceBox) {
  const dx = Math.max(face.leftPct - xPct, 0, xPct - (face.leftPct + face.widthPct));
  const dy = Math.max(face.topPct - yPct, 0, yPct - (face.topPct + face.heightPct));
  return Math.hypot(dx, dy);
}

function overlapRatio(left: FaceBox, right: FaceBox) {
  const xOverlap = Math.max(
    0,
    Math.min(left.leftPct + left.widthPct, right.leftPct + right.widthPct) -
      Math.max(left.leftPct, right.leftPct)
  );
  const yOverlap = Math.max(
    0,
    Math.min(left.topPct + left.heightPct, right.topPct + right.heightPct) -
      Math.max(left.topPct, right.topPct)
  );
  const overlapArea = xOverlap * yOverlap;
  const leftArea = left.widthPct * left.heightPct;

  return leftArea > 0 ? overlapArea / leftArea : 0;
}

export function selectFaceForPoint(xPct: number, yPct: number, faces: FaceBox[]): FaceBox {
  if (faces.length === 0) {
    return deriveFallbackFaceBox(xPct, yPct);
  }

  const containingFace = faces.find(
    (face) =>
      xPct >= face.leftPct &&
      xPct <= face.leftPct + face.widthPct &&
      yPct >= face.topPct &&
      yPct <= face.topPct + face.heightPct
  );

  if (containingFace) {
    return clampFaceBox(containingFace);
  }

  let nearest = faces[0];
  let nearestDistance = pointToFaceDistance(xPct, yPct, nearest);

  for (const face of faces.slice(1)) {
    const distance = pointToFaceDistance(xPct, yPct, face);
    if (distance < nearestDistance) {
      nearest = face;
      nearestDistance = distance;
    }
  }

  return clampFaceBox(nearest);
}

export function snapFaceBoxToDetectedFace(box: FaceBox, faces: FaceBox[]): FaceBox {
  if (faces.length === 0) {
    return clampFaceBox(box);
  }

  const normalized = clampFaceBox(box);
  let bestFace = faces[0];
  let bestOverlap = overlapRatio(normalized, bestFace);

  for (const face of faces.slice(1)) {
    const overlap = overlapRatio(normalized, face);
    if (overlap > bestOverlap) {
      bestFace = face;
      bestOverlap = overlap;
    }
  }

  if (bestOverlap > 0.12) {
    return clampFaceBox(bestFace);
  }

  const centerX = normalized.leftPct + normalized.widthPct / 2;
  const centerY = normalized.topPct + normalized.heightPct / 2;
  return selectFaceForPoint(centerX, centerY, faces);
}
