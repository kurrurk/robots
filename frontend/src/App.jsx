import React, { useEffect, useRef, useState } from "react";
import AuthForm from "./AuthForm";
import AddRobotModal from "./AddRobotModal";
import DeleteRobotModal from "./DeleteRobotModal";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";

import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { toLonLat } from "ol/proj";

export default function App() {
  const mapRef = useRef();
  const mapObj = useRef(null);
  const vectorSource = useRef(new VectorSource());

  const [token, setToken] = useState(null);
  const [robots, setRobots] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  /* ===== LOAD ROBOTS ===== */
  async function loadRobots(t) {
    const res = await fetch("http://localhost:3000/robots", {
      headers: { Authorization: `Bearer ${t}` },
    });

    const data = await res.json();
    setRobots(data);

    // добавить на карту
    data.forEach(addOrUpdateRobot);
  }

  /* ===== ADD / UPDATE MARKER ===== */
  function addOrUpdateRobot(robot) {
    let feature = vectorSource.current.getFeatureById(robot.id);

    const coords = fromLonLat([robot.lon, robot.lat]);

    const iconUrl =
      robot.status === "moving"
        ? "https://cdn-icons-png.flaticon.com/512/4712/4712027.png"
        : "https://cdn-icons-png.flaticon.com/512/149/149060.png";

    if (!feature) {
      feature = new Feature({
        geometry: new Point(coords),
      });

      feature.setId(robot.id);

      feature.setStyle(
        new Style({
          image: new Icon({
            src: iconUrl,
            scale: 0.04,
            anchor: [0.5, 1],
          }),
          text: new Text({
            text: robot.name || `Robot ${robot.id}`,
            font: "14px Arial",
            offsetY: -30,
            fill: new Fill({ color: "#000" }),
            stroke: new Stroke({
              color: "#fff",
              width: 3,
            }),
          }),
        }),
      );

      vectorSource.current.addFeature(feature);
    } else {
      feature.getGeometry().setCoordinates(coords);

      feature.setStyle(
        new Style({
          image: new Icon({
            src: iconUrl,
            scale: 0.04,
            anchor: [0.5, 1],
          }),
          text: new Text({
            text: robot.name || `Robot ${robot.id}`,
            font: "14px Arial",
            offsetY: -30,
            fill: new Fill({ color: "#000" }),
            stroke: new Stroke({
              color: "#fff",
              width: 3,
            }),
          }),
        }),
      );
    }
  }

  /* ===== INIT MAP ===== */
  useEffect(() => {
    if (!token) return;
    if (!mapRef.current) return;
    if (mapObj.current) return;

    const vectorLayer = new VectorLayer({
      source: vectorSource.current,
    });

    mapObj.current = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([10, 50]),
        zoom: 6,
      }),
    });

    // фикс рендера
    setTimeout(() => {
      mapObj.current.updateSize();
    }, 100);
  }, [mapRef.current]);

  /* ===== AFTER LOGIN ===== */
  useEffect(() => {
    if (!token) return;

    loadRobots(token);

    const ws = new WebSocket("ws://localhost:3001");

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      setRobots((prev) =>
        prev.map((r) => (r.id === update.id ? { ...r, ...update } : r)),
      );

      addOrUpdateRobot(update);
    };
  }, [token]);

  /* ===== LOOUT ===== */
  function logout() {
    setToken(null);
    localStorage.removeItem("token");

    if (mapObj.current) {
      mapObj.current.setTarget(null);
      mapObj.current = null;
    }

    vectorSource.current.clear();
  }

  /* ===== UI ===== */
  if (!token) {
    return <AuthForm onLogin={setToken} />;
  }

  return (
    <div className="flex h-screen">
      <div ref={mapRef} className="w-2/3 h-full" />

      <div className="w-1/3 bg-base-200 p-4 overflow-auto">
        <h2 className="text-xl font-bold mb-4">Robots</h2>

        {robots.map((r) => (
          <div key={r.id} className="card bg-base-100 p-3 mb-2 shadow">
            <div className="font-semibold">{r.name}</div>
            <div className="text-sm">
              {r.lat.toFixed(4)}, {r.lon.toFixed(4)}
            </div>
            <div
              className={`badge mt-2 ${r.status === "moving" ? "badge-success" : "badge-ghost"}`}
            >
              {r.status}
            </div>
          </div>
        ))}
        <div className="fixed bottom-4 right-4 flex flex-col gap-2">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            Add Robot
          </button>

          <button className="btn btn-error" onClick={() => setShowDelete(true)}>
            Delete Robot
          </button>

          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
      <AddRobotModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        token={token}
        onCreated={(robot) => {
          setRobots((prev) => [...prev, robot]);
          addOrUpdateRobot(robot);
        }}
      />

      <DeleteRobotModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        robots={robots}
        token={token}
        onDeleted={(id) => {
          setRobots((prev) => prev.filter((r) => r.id != id));
          const feature = vectorSource.current.getFeatureById(Number(id));

          if (feature) {
            vectorSource.current.removeFeature(feature);
          }
        }}
      />
    </div>
  );
}
