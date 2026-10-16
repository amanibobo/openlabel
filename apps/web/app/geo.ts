import { geoContains, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countiesTopo from "us-atlas/counties-10m.json";
import type { UnseenQuery } from "./content";

export type StateMap = {
  width: number;
  height: number;
  counties: { id: string; d: string; hit: boolean }[];
  points: { x: number; y: number; place: string }[];
};

const topo = countiesTopo as unknown as Topology<{ counties: GeometryCollection }>;
const allCounties = feature(topo, topo.objects.counties) as FeatureCollection<Geometry>;

export function stateMap(q: UnseenQuery, width = 520, height = 520): StateMap {
  const features = allCounties.features.filter((f) => String(f.id).startsWith(q.stateFips));
  const collection: FeatureCollection<Geometry> = { type: "FeatureCollection", features };
  const projection = geoMercator().fitExtent(
    [
      [12, 12],
      [width - 12, height - 12],
    ],
    collection,
  );
  const path = geoPath(projection);
  const lonLats = q.rows.map((r) => [r.lon, r.lat] as [number, number]);

  const counties = features.map((f: Feature<Geometry>) => ({
    id: String(f.id),
    d: path(f) ?? "",
    hit: lonLats.some((p) => geoContains(f, p)),
  }));

  const bounds = path.bounds(collection);
  const points = q.rows.map((r) => {
    const [x, y] = projection([r.lon, r.lat]) ?? [0, 0];
    return { x, y, place: r.place };
  });

  return {
    width,
    height: Math.ceil(bounds[1][1] + 12),
    counties,
    points,
  };
}
