export type CardRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type LocalRect = CardRect;

type RoutingBounds = {
  width: number;
  height: number;
};

type PortSide = "left" | "right" | "top" | "bottom";

type Port = {
  side: PortSide;
  anchor: Point;
  gate: Point;
  offset: number;
};

type OccupiedSegment = {
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
};

type HeapEntry = {
  cost: number;
  rank: number;
  state: number;
};

// Keep enough unobstructed line immediately before every target for the fixed-size
// arrow marker. A one-pixel terminal segment lets the marker overlap the final
// bend and makes its head look clipped when cards sit in adjacent columns.
const markerRunway = 16;
const obstaclePadding = 8;
const targetMarkerGap = 4;
const minimumDirectGap = markerRunway * 2;
const bendPenalty = 24;
const trackPitch = 10;
const portCornerMargin = 14;
// Parallel reuse is substantially harder to read than an orthogonal crossing.
// Make even a short shared run more expensive than a few additional bends,
// then scale aggressively with its length so the grid search prefers a nearby
// free track instead of building a visually merged trunk.
const sharedSegmentBasePenalty = 480;
const sharedSegmentLengthPenalty = 16;
const visualTrackOffsets = [
  0,
  -2, 2,
  -4, 4,
  -6, 6,
  -1, 1,
  -3, 3,
  -5, 5,
];

function rounded(value: number) {
  return Math.round(value * 2) / 2;
}

function normalizeRect(rect: CardRect, origin: Pick<CardRect, "top" | "left">): LocalRect {
  const top = rounded(rect.top - origin.top);
  const left = rounded(rect.left - origin.left);
  const width = rounded(rect.width);
  const height = rounded(rect.height);
  return {
    top,
    right: rounded(left + width),
    bottom: rounded(top + height),
    left,
    width,
    height,
  };
}

function inflateRect(rect: LocalRect): LocalRect {
  return {
    top: rounded(rect.top - obstaclePadding),
    right: rounded(rect.right + obstaclePadding),
    bottom: rounded(rect.bottom + obstaclePadding),
    left: rounded(rect.left - obstaclePadding),
    width: rounded(rect.width + obstaclePadding * 2),
    height: rounded(rect.height + obstaclePadding * 2),
  };
}

function rectCenter(rect: LocalRect) {
  return {
    x: rounded(rect.left + rect.width / 2),
    y: rounded(rect.top + rect.height / 2),
  };
}

function portOffsets(length: number) {
  const maximumOffset = Math.min(
    trackPitch,
    Math.max(0, Math.floor((length / 2 - portCornerMargin) / trackPitch) * trackPitch),
  );
  const offsets = [0];
  for (let offset = trackPitch; offset <= maximumOffset; offset += trackPitch) {
    offsets.push(-offset, offset);
  }
  return offsets;
}

function portsFor(rect: LocalRect, target = false): Port[] {
  const center = rectCenter(rect);
  const anchorGap = target ? targetMarkerGap : 0;
  const horizontalOffsets = portOffsets(rect.height);
  const verticalOffsets = portOffsets(rect.width);
  return [
    ...horizontalOffsets.map((offset): Port => ({
      side: "left",
      anchor: { x: rounded(rect.left - anchorGap), y: rounded(center.y + offset) },
      gate: { x: rounded(rect.left - markerRunway), y: rounded(center.y + offset) },
      offset,
    })),
    ...horizontalOffsets.map((offset): Port => ({
      side: "right",
      anchor: { x: rounded(rect.right + anchorGap), y: rounded(center.y + offset) },
      gate: { x: rounded(rect.right + markerRunway), y: rounded(center.y + offset) },
      offset,
    })),
    ...verticalOffsets.map((offset): Port => ({
      side: "top",
      anchor: { x: rounded(center.x + offset), y: rounded(rect.top - anchorGap) },
      gate: { x: rounded(center.x + offset), y: rounded(rect.top - markerRunway) },
      offset,
    })),
    ...verticalOffsets.map((offset): Port => ({
      side: "bottom",
      anchor: { x: rounded(center.x + offset), y: rounded(rect.bottom + anchorGap) },
      gate: { x: rounded(center.x + offset), y: rounded(rect.bottom + markerRunway) },
      offset,
    })),
  ];
}

function isStrictlyInside(point: Point, rect: LocalRect) {
  return point.x > rect.left && point.x < rect.right
    && point.y > rect.top && point.y < rect.bottom;
}

function segmentCrossesRect(from: Point, to: Point, rect: LocalRect) {
  if (from.y === to.y) {
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    return from.y > rect.top && from.y < rect.bottom
      && minX < rect.right && maxX > rect.left;
  }
  if (from.x === to.x) {
    const minY = Math.min(from.y, to.y);
    const maxY = Math.max(from.y, to.y);
    return from.x > rect.left && from.x < rect.right
      && minY < rect.bottom && maxY > rect.top;
  }
  return true;
}

function pathIsClear(points: Point[], obstacles: LocalRect[]) {
  return points.slice(1).every((point, index) =>
    obstacles.every((obstacle) =>
      !segmentCrossesRect(points[index], point, obstacle),
    ),
  );
}

function simplifyPoints(points: Point[]) {
  const compact = points.filter((point, index) =>
    index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  );
  if (compact.length < 3) return compact;

  const simplified: Point[] = [compact[0]];
  for (let index = 1; index < compact.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = compact[index];
    const next = compact[index + 1];
    const isHorizontal = previous.y === current.y && current.y === next.y;
    const isVertical = previous.x === current.x && current.x === next.x;
    if (!isHorizontal && !isVertical) simplified.push(current);
  }
  simplified.push(compact[compact.length - 1]);
  return simplified;
}

function occupiedSegment(from: Point, to: Point): OccupiedSegment | null {
  if (from.x === to.x && from.y !== to.y) {
    return {
      orientation: "vertical",
      fixed: from.x,
      start: Math.min(from.y, to.y),
      end: Math.max(from.y, to.y),
    };
  }
  if (from.y === to.y && from.x !== to.x) {
    return {
      orientation: "horizontal",
      fixed: from.y,
      start: Math.min(from.x, to.x),
      end: Math.max(from.x, to.x),
    };
  }
  return null;
}

function collinearOverlapLength(left: OccupiedSegment, right: OccupiedSegment) {
  if (left.orientation !== right.orientation || left.fixed !== right.fixed) return 0;
  return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
}

function formatCoordinate(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pathFromPoints(points: Point[]) {
  const simplified = simplifyPoints(points);
  if (simplified.length < 2) return null;
  let path = `M ${formatCoordinate(simplified[0].x)} ${formatCoordinate(simplified[0].y)}`;
  for (const [index, point] of simplified.slice(1).entries()) {
    const previous = simplified[index];
    if (point.y === previous.y) path += ` H ${formatCoordinate(point.x)}`;
    else if (point.x === previous.x) path += ` V ${formatCoordinate(point.y)}`;
    else return null;
  }
  return path;
}

function preferredSides(source: LocalRect, target: LocalRect): [PortSide, PortSide] {
  const sourceCenter = rectCenter(source);
  const targetCenter = rectCenter(target);
  if (target.left >= source.right) return ["right", "left"];
  if (source.left >= target.right) return ["left", "right"];
  if (targetCenter.y >= sourceCenter.y) return ["bottom", "top"];
  return ["top", "bottom"];
}

function portPenalty(side: PortSide, preferred: PortSide) {
  if (side === preferred) return 0;
  const opposites: Record<PortSide, PortSide> = {
    left: "right",
    right: "left",
    top: "bottom",
    bottom: "top",
  };
  return side === opposites[preferred] ? 150 : 70;
}

function portOffsetPenalty(port: Port) {
  return Math.abs(port.offset) / trackPitch;
}

class MinHeap {
  private entries: HeapEntry[] = [];

  get size() {
    return this.entries.length;
  }

  push(entry: HeapEntry) {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.entries[parent].rank <= entry.rank) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }

  pop() {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first || !last || this.entries.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.entries.length) break;
      const smaller = right < this.entries.length
        && this.entries[right].rank < this.entries[left].rank
        ? right
        : left;
      if (this.entries[smaller].rank >= last.rank) break;
      this.entries[index] = this.entries[smaller];
      index = smaller;
    }
    this.entries[index] = last;
    return first;
  }
}

function legacyPath(source: LocalRect, target: LocalRect) {
  const sourceY = source.top + source.height / 2;
  const targetY = target.top + target.height / 2;
  if (target.left > source.right + minimumDirectGap) {
    const bendX = source.right + (target.left - source.right) / 2;
    return {
      path: `M ${formatCoordinate(source.right)} ${formatCoordinate(sourceY)} H ${formatCoordinate(bendX)} V ${formatCoordinate(targetY)} H ${formatCoordinate(target.left - targetMarkerGap)}`,
      points: [
        { x: source.right, y: sourceY },
        { x: bendX, y: sourceY },
        { x: bendX, y: targetY },
        { x: target.left - targetMarkerGap, y: targetY },
      ],
    };
  }
  const sideX = Math.max(source.right, target.right) + 10;
  return {
    path: `M ${formatCoordinate(source.right)} ${formatCoordinate(sourceY)} H ${formatCoordinate(sideX)} V ${formatCoordinate(targetY)} H ${formatCoordinate(target.right + targetMarkerGap)}`,
    points: [
      { x: source.right, y: sourceY },
      { x: sideX, y: sourceY },
      { x: sideX, y: targetY },
      { x: target.right + targetMarkerGap, y: targetY },
    ],
  };
}

/**
 * Creates a reusable orthogonal router for the current card layout. Card
 * surfaces are inflated beyond the connector halo, then a coordinate-compressed
 * Manhattan graph finds the shortest visible channel between endpoint ports.
 */
export function createObstacleAvoidingConnectorRouter(
  cards: Map<string, CardRect>,
  origin: Pick<CardRect, "top" | "left"> = { top: 0, left: 0 },
  bounds?: RoutingBounds,
) {
  const localCards = new Map(
    [...cards.entries()]
      .filter(([, rect]) => rect.width > 0 && rect.height > 0)
      .map(([id, rect]) => [id, normalizeRect(rect, origin)]),
  );
  if (localCards.size === 0) return () => null;
  const inflatedCards = new Map(
    [...localCards.entries()].map(([id, rect]) => [id, inflateRect(rect)]),
  );
  const inflated = [...inflatedCards.values()];
  const allPorts = [...localCards.values()].flatMap((rect) => portsFor(rect));
  const horizontalExtents = [
    ...inflated.flatMap((rect) => [rect.left, rect.right]),
    ...allPorts.flatMap((port) => [port.anchor.x, port.gate.x]),
  ];
  const verticalExtents = [
    ...inflated.flatMap((rect) => [rect.top, rect.bottom]),
    ...allPorts.flatMap((port) => [port.anchor.y, port.gate.y]),
  ];
  const width = rounded(bounds?.width ?? Math.max(0, ...horizontalExtents));
  const height = rounded(bounds?.height ?? Math.max(0, ...verticalExtents));
  const routingLeft = rounded(Math.max(0, Math.min(...horizontalExtents)));
  const routingRight = rounded(Math.min(width, Math.max(...horizontalExtents)));
  const routingTop = rounded(Math.max(0, Math.min(...verticalExtents)));
  const routingBottom = rounded(Math.min(height, Math.max(...verticalExtents)));

  const xCoordinates = [...new Set([
    routingLeft,
    routingRight,
    ...inflated.flatMap((rect) => [rect.left, rect.right, rectCenter(rect).x]),
    ...allPorts.map((port) => port.gate.x),
  ].filter((value) => value >= routingLeft && value <= routingRight))].sort((left, right) => left - right);
  const yCoordinates = [...new Set([
    routingTop,
    routingBottom,
    ...inflated.flatMap((rect) => [rect.top, rect.bottom, rectCenter(rect).y]),
    ...allPorts.map((port) => port.gate.y),
  ].filter((value) => value >= routingTop && value <= routingBottom))].sort((left, right) => left - right);
  const xIndex = new Map(xCoordinates.map((value, index) => [value, index]));
  const yIndex = new Map(yCoordinates.map((value, index) => [value, index]));
  const columnCount = xCoordinates.length;
  const nodeCount = columnCount * yCoordinates.length;
  const blocked = new Uint8Array(nodeCount);
  const occupiedSegmentsByTrack = new Map<string, OccupiedSegment[]>();
  const visualSegmentsByTrack = new Map<string, OccupiedSegment[]>();

  for (let y = 0; y < yCoordinates.length; y += 1) {
    for (let x = 0; x < xCoordinates.length; x += 1) {
      const point = { x: xCoordinates[x], y: yCoordinates[y] };
      if (inflated.some((rect) => isStrictlyInside(point, rect))) {
        blocked[y * columnCount + x] = 1;
      }
    }
  }

  function nodeFor(point: Point) {
    const x = xIndex.get(rounded(point.x));
    const y = yIndex.get(rounded(point.y));
    return x === undefined || y === undefined ? null : y * columnCount + x;
  }

  function pointFor(node: number): Point {
    return {
      x: xCoordinates[node % columnCount],
      y: yCoordinates[Math.floor(node / columnCount)],
    };
  }

  function segmentIsClear(from: Point, to: Point) {
    return inflated.every((rect) => !segmentCrossesRect(from, to, rect));
  }

  const neighborNodes = new Int32Array(nodeCount * 4);
  neighborNodes.fill(-1);
  const neighborDistances = new Float64Array(nodeCount * 4);
  const neighborDirections = new Uint8Array(nodeCount * 4);
  function connectNeighbors(node: number, neighbor: number, slot: number, reverseSlot: number) {
    if (blocked[node] || blocked[neighbor]) return;
    const point = pointFor(node);
    const nextPoint = pointFor(neighbor);
    if (!segmentIsClear(point, nextPoint)) return;
    const distance = Math.abs(point.x - nextPoint.x) + Math.abs(point.y - nextPoint.y);
    const direction = point.y === nextPoint.y ? 1 : 2;
    neighborNodes[node * 4 + slot] = neighbor;
    neighborNodes[neighbor * 4 + reverseSlot] = node;
    neighborDistances[node * 4 + slot] = distance;
    neighborDistances[neighbor * 4 + reverseSlot] = distance;
    neighborDirections[node * 4 + slot] = direction;
    neighborDirections[neighbor * 4 + reverseSlot] = direction;
  }
  for (let y = 0; y < yCoordinates.length; y += 1) {
    for (let x = 0; x < xCoordinates.length; x += 1) {
      const node = y * columnCount + x;
      if (x + 1 < columnCount) connectNeighbors(node, node + 1, 1, 0);
      if (y + 1 < yCoordinates.length) connectNeighbors(node, node + columnCount, 3, 2);
    }
  }
  const horizontalBlockPrefix = new Uint32Array(
    yCoordinates.length * (columnCount + 1),
  );
  for (let y = 0; y < yCoordinates.length; y += 1) {
    const rowOffset = y * (columnCount + 1);
    for (let x = 0; x < columnCount; x += 1) {
      const node = y * columnCount + x;
      const blockedEdge = x + 1 < columnCount
        && neighborNodes[node * 4 + 1] !== node + 1;
      horizontalBlockPrefix[rowOffset + x + 1] =
        horizontalBlockPrefix[rowOffset + x] + Number(blockedEdge);
    }
  }
  const verticalBlockPrefix = new Uint32Array(
    columnCount * (yCoordinates.length + 1),
  );
  for (let x = 0; x < columnCount; x += 1) {
    const columnOffset = x * (yCoordinates.length + 1);
    for (let y = 0; y < yCoordinates.length; y += 1) {
      const node = y * columnCount + x;
      const blockedEdge = y + 1 < yCoordinates.length
        && neighborNodes[node * 4 + 3] !== node + columnCount;
      verticalBlockPrefix[columnOffset + y + 1] =
        verticalBlockPrefix[columnOffset + y] + Number(blockedEdge);
    }
  }

  function gridSegmentIsClear(from: Point, to: Point) {
    if (from.x === to.x && from.y === to.y) return true;
    const fromX = xIndex.get(rounded(from.x));
    const toX = xIndex.get(rounded(to.x));
    const fromY = yIndex.get(rounded(from.y));
    const toY = yIndex.get(rounded(to.y));
    if (
      fromX === undefined || toX === undefined
      || fromY === undefined || toY === undefined
    ) return false;
    if (fromY === toY) {
      const start = Math.min(fromX, toX);
      const end = Math.max(fromX, toX);
      const offset = fromY * (columnCount + 1);
      return horizontalBlockPrefix[offset + end]
        - horizontalBlockPrefix[offset + start] === 0;
    }
    if (fromX === toX) {
      const start = Math.min(fromY, toY);
      const end = Math.max(fromY, toY);
      const offset = fromX * (yCoordinates.length + 1);
      return verticalBlockPrefix[offset + end]
        - verticalBlockPrefix[offset + start] === 0;
    }
    return false;
  }

  function gridPathIsClear(points: Point[]) {
    return points.slice(1).every((point, index) =>
      gridSegmentIsClear(points[index], point),
    );
  }

  function occupiedTrackKey(segment: OccupiedSegment) {
    return `${segment.orientation}:${formatCoordinate(segment.fixed)}`;
  }

  function overlapPenalty(from: Point, to: Point) {
    const candidate = occupiedSegment(from, to);
    if (!candidate) return 0;
    let penalty = 0;
    for (const occupied of occupiedSegmentsByTrack.get(occupiedTrackKey(candidate)) ?? []) {
      const overlap = collinearOverlapLength(candidate, occupied);
      if (overlap <= 0) continue;
      penalty += sharedSegmentBasePenalty + overlap * sharedSegmentLengthPenalty;
    }
    return penalty;
  }

  function routeOverlapPenalty(points: Point[]) {
    return points.slice(1).reduce(
      (total, point, index) => total + overlapPenalty(points[index], point),
      0,
    );
  }

  function registerRoute(points: Point[]) {
    const simplified = simplifyPoints(points);
    simplified.slice(1).forEach((point, index) => {
      const segment = occupiedSegment(simplified[index], point);
      if (!segment) return;
      const key = occupiedTrackKey(segment);
      const track = occupiedSegmentsByTrack.get(key) ?? [];
      track.push(segment);
      occupiedSegmentsByTrack.set(key, track);
    });
  }

  function segmentWithFixed(
    segment: OccupiedSegment,
    fixed: number,
  ): OccupiedSegment {
    return { ...segment, fixed: rounded(fixed) };
  }

  function visualSegmentIsAvailable(segment: OccupiedSegment) {
    return (visualSegmentsByTrack.get(occupiedTrackKey(segment)) ?? [])
      .every((occupied) => collinearOverlapLength(segment, occupied) === 0);
  }

  function registerVisualSegments(segments: OccupiedSegment[]) {
    for (const segment of segments) {
      const key = occupiedTrackKey(segment);
      const track = visualSegmentsByTrack.get(key) ?? [];
      track.push(segment);
      visualSegmentsByTrack.set(key, track);
    }
  }

  function visuallySeparateRoute(points: Point[], obstacles: LocalRect[]) {
    const compact = points.filter((point, index) =>
      index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
    );
    // Simplify the route core, but deliberately retain both endpoint gates.
    // Without those gates a long approach that happens to be collinear with
    // the marker runway is collapsed into one "terminal" segment and cannot
    // be assigned its own visual lane.
    const core = compact.length > 2
      ? simplifyPoints(compact.slice(1, -1))
      : [];
    const routePoints = compact.length > 1
      ? [compact[0], ...core, compact[compact.length - 1]]
      : compact;
    const originalSegments = routePoints.slice(1).flatMap((point, index) => {
      const segment = occupiedSegment(routePoints[index], point);
      return segment ? [segment] : [];
    });
    if (originalSegments.length < 2) {
      registerVisualSegments(originalSegments);
      return routePoints;
    }

    const adjustedSegments = originalSegments.map((segment, index) => {
      // Keep endpoint tracks fixed so markers still meet the card-side anchor.
      // Interior tracks may use a narrow lane inside the router's 8px safety
      // corridor. This turns unavoidable shared trunks into adjacent lines.
      if (index === 0 || index === originalSegments.length - 1) return segment;
      for (const offset of visualTrackOffsets) {
        const candidate = segmentWithFixed(segment, segment.fixed + offset);
        if (
          candidate.fixed < 0
          || (candidate.orientation === "vertical" && candidate.fixed > width)
          || (candidate.orientation === "horizontal" && candidate.fixed > height)
          || !visualSegmentIsAvailable(candidate)
        ) continue;
        return candidate;
      }
      return segment;
    });
    const adjustedPoints: Point[] = [routePoints[0]];
    for (let index = 1; index < routePoints.length - 1; index += 1) {
      const previous = adjustedSegments[index - 1];
      const next = adjustedSegments[index];
      if (previous.orientation !== next.orientation) {
        adjustedPoints.push(previous.orientation === "horizontal"
          ? { x: next.fixed, y: previous.fixed }
          : { x: previous.fixed, y: next.fixed });
      } else if (previous.orientation === "horizontal") {
        adjustedPoints.push({ x: routePoints[index].x, y: previous.fixed });
        adjustedPoints.push({ x: routePoints[index].x, y: next.fixed });
      } else {
        adjustedPoints.push({ x: previous.fixed, y: routePoints[index].y });
        adjustedPoints.push({ x: next.fixed, y: routePoints[index].y });
      }
    }
    adjustedPoints.push(routePoints[routePoints.length - 1]);

    const withinBounds = adjustedPoints.every((point) =>
      point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height,
    );
    const accepted = withinBounds && pathIsClear(adjustedPoints, obstacles)
      ? adjustedPoints
      : routePoints;
    const acceptedSegments = accepted.slice(1).flatMap((point, index) => {
      const segment = occupiedSegment(accepted[index], point);
      return segment ? [segment] : [];
    });
    registerVisualSegments(acceptedSegments);
    return accepted;
  }

  function nearbyTracks(coordinates: number[], middle: number) {
    const nearest = [...coordinates]
      .sort((left, right) => Math.abs(left - middle) - Math.abs(right - middle))
      .slice(0, 8);
    return [...new Set([
      coordinates[0],
      coordinates[coordinates.length - 1],
      ...nearest,
    ])];
  }

  function geometricRouteCost(points: Point[]) {
    const simplified = simplifyPoints(points);
    const length = simplified.slice(1).reduce(
      (total, point, index) => total
        + Math.abs(point.x - simplified[index].x)
        + Math.abs(point.y - simplified[index].y),
      0,
    );
    return length
      + Math.max(0, simplified.length - 2) * bendPenalty
      + routeOverlapPenalty(simplified);
  }

  return (sourceId: string, targetId: string) => {
    const source = localCards.get(sourceId);
    const target = localCards.get(targetId);
    if (!source || !target) return null;

    const otherObstacles = [...inflatedCards.entries()]
      .filter(([id]) => id !== sourceId && id !== targetId)
      .map(([, rect]) => rect);
    const otherCardSurfaces = [...localCards.entries()]
      .filter(([id]) => id !== sourceId && id !== targetId)
      .map(([, rect]) => rect);
    const finalizeRoute = (points: Point[]) => {
      registerRoute(points);
      return pathFromPoints(visuallySeparateRoute(points, otherCardSurfaces));
    };
    const direct = legacyPath(source, target);
    if (
      target.left > source.right + minimumDirectGap
      && pathIsClear(direct.points, otherObstacles)
      && routeOverlapPenalty(direct.points) === 0
    ) {
      return finalizeRoute(direct.points) ?? direct.path;
    }

    const sourcePorts = portsFor(source);
    const targetPorts = portsFor(target, true);
    const [preferredSource, preferredTarget] = preferredSides(source, target);
    const preferredSourcePorts = sourcePorts.filter((port) => port.side === preferredSource);
    const preferredTargetPorts = targetPorts.filter((port) => port.side === preferredTarget);
    const middleX = rounded((rectCenter(source).x + rectCenter(target).x) / 2);
    const middleY = rounded((rectCenter(source).y + rectCenter(target).y) / 2);
    const xTracks = nearbyTracks(xCoordinates, middleX);
    const yTracks = nearbyTracks(yCoordinates, middleY);
    const bestSimple: {
      value: { cost: number; points: Point[] } | null;
    } = { value: null };

    function considerSimpleRoute(sourcePort: Port, targetPort: Port, points: Point[]) {
      const core = simplifyPoints(points.slice(1, -1));
      if (core.length < 2 || !gridPathIsClear(core)) return;
      const cost = portOffsetPenalty(sourcePort)
        + portOffsetPenalty(targetPort)
        + geometricRouteCost(points);
      if (!bestSimple.value || cost < bestSimple.value.cost) {
        bestSimple.value = { cost, points };
      }
    }

    for (const sourcePort of preferredSourcePorts) {
      for (const targetPort of preferredTargetPorts) {
        for (const trackX of xTracks) {
          considerSimpleRoute(sourcePort, targetPort, [
            sourcePort.anchor,
            sourcePort.gate,
            { x: trackX, y: sourcePort.gate.y },
            { x: trackX, y: targetPort.gate.y },
            targetPort.gate,
            targetPort.anchor,
          ]);
        }
        for (const trackY of yTracks) {
          considerSimpleRoute(sourcePort, targetPort, [
            sourcePort.anchor,
            sourcePort.gate,
            { x: sourcePort.gate.x, y: trackY },
            { x: targetPort.gate.x, y: trackY },
            targetPort.gate,
            targetPort.anchor,
          ]);
        }
      }
    }
    // A compact dogleg is ideal while its track is free. Once another route
    // already occupies any positive length of that dogleg, continue into the
    // full port/grid search instead of accepting a visually indistinguishable
    // shared trunk merely because it was the shortest simple candidate.
    if (
      bestSimple.value
      && routeOverlapPenalty(bestSimple.value.points) === 0
    ) {
      const path = pathFromPoints(bestSimple.value.points);
      if (path) {
        return finalizeRoute(bestSimple.value.points) ?? path;
      }
    }

    const stateCount = nodeCount * 3;
    const distances = new Float64Array(stateCount);
    distances.fill(Number.POSITIVE_INFINITY);
    const parents = new Int32Array(stateCount);
    parents.fill(-2);
    const sourcePortByState = new Int16Array(stateCount);
    sourcePortByState.fill(-1);
    const heap = new MinHeap();
    const targetNodes = targetPorts.map((port) => nodeFor(port.gate));
    const targetHeuristic = (point: Point) => Math.min(
      ...targetPorts.map((port) =>
        Math.abs(point.x - port.gate.x) + Math.abs(point.y - port.gate.y),
      ),
    );

    sourcePorts.forEach((port, portIndex) => {
      const node = nodeFor(port.gate);
      if (node === null || blocked[node]) return;
      const state = node * 3;
      const cost = portPenalty(port.side, preferredSource)
        + portOffsetPenalty(port)
        + Math.abs(port.anchor.x - port.gate.x)
        + Math.abs(port.anchor.y - port.gate.y)
        + overlapPenalty(port.anchor, port.gate);
      if (cost >= distances[state]) return;
      distances[state] = cost;
      parents[state] = -1;
      sourcePortByState[state] = portIndex;
      heap.push({ cost, rank: cost + targetHeuristic(port.gate), state });
    });

    let bestCost = Number.POSITIVE_INFINITY;
    let bestState = -1;
    let bestTargetPort = -1;

    while (heap.size) {
      const entry = heap.pop();
      if (!entry || entry.cost !== distances[entry.state]) continue;
      if (entry.rank >= bestCost) break;
      const node = Math.floor(entry.state / 3);
      const direction = entry.state % 3;
      const point = pointFor(node);

      targetNodes.forEach((targetNode, portIndex) => {
        if (targetNode !== node) return;
        const port = targetPorts[portIndex];
        const total = entry.cost
          + portPenalty(port.side, preferredTarget)
          + portOffsetPenalty(port)
          + Math.abs(port.anchor.x - port.gate.x)
          + Math.abs(port.anchor.y - port.gate.y)
          + overlapPenalty(port.gate, port.anchor);
        if (total < bestCost) {
          bestCost = total;
          bestState = entry.state;
          bestTargetPort = portIndex;
        }
      });

      for (let slot = 0; slot < 4; slot += 1) {
        const neighborIndex = node * 4 + slot;
        const neighbor = neighborNodes[neighborIndex];
        if (neighbor < 0) continue;
        const nextPoint = pointFor(neighbor);
        const nextDirection = neighborDirections[neighborIndex];
        const distance = neighborDistances[neighborIndex];
        const nextCost = entry.cost + distance
          + (direction !== 0 && direction !== nextDirection ? bendPenalty : 0)
          + overlapPenalty(point, nextPoint);
        const nextState = neighbor * 3 + nextDirection;
        if (nextCost >= distances[nextState]) continue;
        distances[nextState] = nextCost;
        parents[nextState] = entry.state;
        sourcePortByState[nextState] = sourcePortByState[entry.state];
        heap.push({
          cost: nextCost,
          rank: nextCost + targetHeuristic(nextPoint),
          state: nextState,
        });
      }
    }

    if (bestState < 0 || bestTargetPort < 0) {
      if (bestSimple.value) {
        const simplePath = pathFromPoints(bestSimple.value.points);
        if (simplePath) {
          return finalizeRoute(bestSimple.value.points) ?? simplePath;
        }
      }
      if (!pathIsClear(direct.points, otherObstacles)) return null;
      return finalizeRoute(direct.points) ?? direct.path;
    }
    const route: Point[] = [];
    let state = bestState;
    while (state >= 0) {
      route.push(pointFor(Math.floor(state / 3)));
      state = parents[state];
    }
    route.reverse();
    const sourcePort = sourcePorts[sourcePortByState[bestState]];
    const targetPort = targetPorts[bestTargetPort];
    if (!sourcePort || !targetPort) return null;
    const points = [
      sourcePort.anchor,
      sourcePort.gate,
      ...route,
      targetPort.gate,
      targetPort.anchor,
    ];
    const path = pathFromPoints(points);
    if (!path) return null;
    return finalizeRoute(points) ?? path;
  };
}

export function orthogonalConnectorPath(
  source: CardRect,
  target: CardRect,
  origin: Pick<CardRect, "top" | "left"> = { top: 0, left: 0 },
  obstacles: CardRect[] = [],
  bounds?: RoutingBounds,
) {
  if (!source.width || !source.height || !target.width || !target.height) return null;
  const cards = new Map<string, CardRect>([
    ["source", source],
    ["target", target],
    ...obstacles
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect, index) => [`obstacle-${index}`, rect] as const),
  ]);
  return createObstacleAvoidingConnectorRouter(cards, origin, bounds)("source", "target");
}
