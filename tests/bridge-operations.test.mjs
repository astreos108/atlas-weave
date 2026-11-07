import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOperations,
  safeVaultPath,
  newBoardSource,
  expandedSource,
} from "../src/bridge-operations.js";
import { parse, serialize, INITIAL } from "../src/model.js";
import { createMap } from "../src/map-patterns.js";
import {
  dragSegment,
  dragBend,
  manualRoute,
} from "../src/connector-routing.js";
test("bridge paths cannot escape the vault or read hidden configuration", () => {
  for (const path of [
    "/tmp/a.board",
    "../a.board",
    "a/../b.board",
    ".obsidian/test.board",
    "a\\b.board",
    "a.md",
  ])
    assert.throws(() => safeVaultPath(path, "board"));
  assert.equal(safeVaultPath("Maps/Ideas.board", "board"), "Maps/Ideas.board");
});
test("semantic moves preserve manual routes and unrelated branches", () => {
  const m = parse(INITIAL);
  for (let i = 0; i < m.nodes.length; i++)
    m.nodes[i].position = { x: i * 300, y: 0 };
  m.edges[0].waypoints = [
    { x: 100, y: 50 },
    { x: 200, y: 50 },
  ];
  const next = parse(
    applyOperations(serialize(m), [
      { type: "move_nodes", ids: ["idea", "explore"], dx: 20, dy: 40 },
    ]),
  );
  assert.deepEqual(next.edges[0].waypoints, [
    { x: 120, y: 90 },
    { x: 220, y: 90 },
  ]);
  assert.deepEqual(next.nodes[2], m.nodes[2]);
  assert.throws(() =>
    applyOperations(INITIAL, [
      { type: "update_edge", index: 99, changes: { label: "bad" } },
    ]),
  );
});
test("branch expansion appends while retaining existing nodes, source links and edits", () => {
  const source = createMap({
    kind: "radial",
    root: "Immune response",
    branches: [{ label: "Innate", link: "Immunity#Innate" }],
  });
  const before = parse(source),
    after = parse(
      expandedSource(source, {
        parentId: "n1",
        branches: [{ label: "Barriers" }, { label: "Inflammation" }],
      }),
    );
  assert.equal(after.nodes.length, 4);
  assert.deepEqual(after.nodes.slice(0, 2), before.nodes);
  assert.equal(after.nodes[1].link, "Immunity#Innate");
  assert.throws(() =>
    newBoardSource({ source: INITIAL, map: { kind: "tree", root: "X" } }),
  );
});
test("manual segment and bend drags retain endpoints and orthogonality after stitching", () => {
  const a = { x: 0, y: 0, width: 100, height: 80 },
    b = { x: 400, y: 200, width: 100, height: 80 },
    original = [
      { x: 50, y: 0 },
      { x: 180, y: 0 },
      { x: 180, y: 200 },
      { x: 350, y: 200 },
    ];
  for (const points of [
    dragSegment(original, 1, { x: 240, y: 80 }),
    dragBend(original, 1, { x: 200, y: -100 }),
  ]) {
    const route = manualRoute(a, b, {
      fromSide: "right",
      toSide: "left",
      waypoints: points.slice(1, -1),
    });
    assert.deepEqual(route[0], original[0]);
    assert.deepEqual(route.at(-1), original.at(-1));
    for (let i = 1; i < route.length; i++)
      assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y);
  }
});
