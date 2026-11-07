/** All levels share world origin and use fixed multiples of the 20-unit snap grid. */
export function gridLayers(zoom, pan) {
  return [20, 100, 500].map((world, i) => {
    const size = world * zoom;
    const previous = i ? (world / 5) * zoom : 0;
    const visible = size >= 8 && (!i || previous < 16);
    return {
      size,
      x: pan.x - size / 2,
      y: pan.y - size / 2,
      visible,
      radius: i ? 0.85 : 0.6,
    };
  });
}
