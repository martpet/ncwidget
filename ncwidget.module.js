import {
  html,
  render,
  useState,
  createContext,
  useContext,
  useRef,
  useEffect,
  useMemo,
} from "./htm_preact_standalone.module.js";

const MIN_PLOT_LENGTH_PT = 20;
const MAX_ALLOWED_PLOT_POINT = 1000;
const PLOT_BG_COLOR = "#000000";
const MARKER_DIAM_PX = 16;
const MARKER_RADI_PX = MARKER_DIAM_PX / 2;
const MARKER_BRD_PX = 1;
const MARKER_BGCOLOR = "#b0c4de";
const MARKER_TXTCOLOR = "#000000";
const STATION_TXTCOLOR = "#7fffd4";
const STATION_TXTCOLOR_DIM = dim(STATION_TXTCOLOR);
const STATION_BGCOLOR = dim("#008000");
const STATION_RING_COLOR = dim(STATION_TXTCOLOR, 0.3);
const DEVICE_АCTIVE_BG_COLOR = "#f5f5f5";
const DEVICE_BG_COLOR = dim(DEVICE_АCTIVE_BG_COLOR);
const BUTTON_REMOVE_TXTCOLOR = "#ff6347";

const AppContext = createContext();

export default function ({ container, ...props }) {
  render(html`<${Main} ...${props} //>`, container);
}

export function Main(props) {
  return html`
    <${AppProvider} ...${props}>
      <${App} />
    <//>
  `;
}

function AppProvider({ stations: initialStations, devices: initialDevices, children }) {
  const [stations, setStations] = useState(initialStations);
  const [devices, setDevices] = useState(initialDevices);
  const [plotLengthPx, setPlotLengthPx] = useState();

  const maxPoint = useMemo(
    () =>
      Math.max(
        ...stations
          .concat(devices)
          .map(({ x, y }) => [x, y])
          .flat()
          .concat(MIN_PLOT_LENGTH_PT)
      ),
    [stations, devices]
  );

  if (maxPoint > MAX_ALLOWED_PLOT_POINT) {
    throw new RangeError(
      `[NCWidget] Maximum point is "${MAX_ALLOWED_PLOT_POINT}" but you provided "${maxPoint}"`
    );
  }

  const connections = useMemo(() => {
    const data = {
      stations: {},
      devices: {},
    };
    devices.forEach((device, deviceIndex) => {
      const speeds = stations.map((station) =>
        getSpeed(getDistance(device, station), station.reach)
      );
      const isInRange = speeds.some((s) => s !== null);
      if (isInRange) {
        const speed = Math.max(...speeds);
        const stationIndex = speeds.indexOf(speed);
        data.devices[deviceIndex] = { speed, stationIndex };
        data.stations[stationIndex] ??= [];
        data.stations[stationIndex].push(deviceIndex);
      }
    });
    return data;
  }, [stations, devices]);

  const contextValue = {
    stations,
    setStations,
    devices,
    setDevices,
    connections,
    maxPoint,
    plotLengthPx,
    setPlotLengthPx,
  };
  return html`<${AppContext.Provider} value=${contextValue}> ${children} <//> `;
}

function App() {
  const { stations, setStations, devices, setDevices, connections } = useContext(AppContext);
  const stationsState = [stations, setStations];
  const devicesState = [devices, setDevices];

  const handleClickAddStation = () => setStations([...stations, { x: 0, y: 0, reach: 0 }]);
  const handleClickAddDevice = () => setDevices([...devices, { x: 0, y: 0 }]);

  return html`
    <div style="font: 14px sans-serif;">
      <div style="display: flex; flex-wrap: wrap;">
        <${Table}
          title="Stations"
          headers=${["#", "x", "y", "reach", ""]}
          onClickAdd=${handleClickAddStation}
          rows=${stations.map((_, i) => [
            html`<${StationMarker} index=${i} />`,
            html`<${Control} prop="x" state=${stationsState} index=${i} />`,
            html`<${Control} prop="y" state=${stationsState} index=${i} />`,
            html`<${Control} prop="reach" state=${stationsState} index=${i} />`,
            html`<${ButtonRemove} state=${stationsState} index=${i} />`,
          ])}
        />
        <${Table}
          title="Devices"
          headers=${["#", "x", "y", "speed", "station", ""]}
          onClickAdd=${handleClickAddDevice}
          rows=${devices.map(({ speed }, i) => [
            html`<${DeviceMarker} index=${i} />`,
            html`<${Control} prop="x" state=${devicesState} index=${i} />`,
            html`<${Control} prop="y" state=${devicesState} index=${i} />`,
            connections.devices[i]?.speed,
            connections.devices[i] &&
              html`<${StationMarker}
                index=${connections.devices[i].stationIndex}
                style="display: inline-flex"
              />`,
            html`<${ButtonRemove} state=${devicesState} index=${i} />`,
          ])}
        />
      </div>
      <${Graph} style="margin-top: 5px;" />
    </div>
  `;
}

function Control({ state, index, prop }) {
  const [items, setItems] = state;

  const handleChange = ({ target }) => {
    if (!target.reportValidity()) return;
    const newItems = [...items];
    const changedItem = { ...items[index], [prop]: Number(target.value) };
    newItems.splice(index, 1, changedItem);
    setItems(newItems);
  };
  return html`<input
    type="number"
    value=${items[index][prop]}
    min="0"
    max=${MAX_ALLOWED_PLOT_POINT}
    onInput="${handleChange}"
  />`;
}

function Table({ title, headers, rows, onClickAdd }) {
  return html`<fieldset style="flex: 1 0; margin: 0;">
    <legend>${title}</legend>
    <table>
      <thead>
        <tr>
          ${!!rows.length && headers.map((header) => html`<th>${header}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (cells) =>
            html`<tr>
              ${cells.map(
                (cell) => html`<td style="padding: 0 4px; text-align: center;">${cell}</td>`
              )}
            </tr>`
        )}
      </tbody>
    </table>
    <${UnstyledButton}
      onClick=${onClickAdd}
      style="font-weight: bold; margin-top: 4px; font-size: 11px;"
    >
      + Add
    <//>
  </fieldset>`;
}

function ButtonRemove({ state, index }) {
  const [items, setItems] = state;
  const handleClick = () => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };
  return html`<${UnstyledButton}
    onClick=${handleClick}
    title="Remove"
    style=${`
      color: ${BUTTON_REMOVE_TXTCOLOR};
      font-size: 10px
    `}
  >
    ✕
  <//>`;
}

function UnstyledButton({ style, children, ...props }) {
  return html`<button
    ...${props}
    style=${`
      border: 0;
      padding: 0;
      background: none;
      cursor: pointer;
      ${style}
    `}
  >
    ${children}
  </button>`;
}

function Marker({ label, style }) {
  return html`<span
    style=${`
      width: ${MARKER_DIAM_PX}px;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: ${MARKER_BGCOLOR};
      color: ${MARKER_TXTCOLOR};
      font-size: 11px;
      ${style}
    `}
  >
    ${label}
  </span>`;
}

function StationMarker({ index, style }) {
  const { stations, connections } = useContext(AppContext);
  const hasConnections = Boolean(connections.stations[index]?.length);
  const { reach } = stations[index];
  return html`<${Marker}
    label=${index + 1}
    style=${`
      background: ${STATION_BGCOLOR};
      color: ${reach ? STATION_TXTCOLOR : STATION_TXTCOLOR_DIM};
      ${hasConnections && `box-shadow: 0 0 0 ${MARKER_BRD_PX}px`};
      ${style}
    `}
  />`;
}

function DeviceMarker({ index }) {
  const { connections } = useContext(AppContext);
  const isConnected = connections.devices[index];
  const hasSpeed = Boolean(connections.devices[index]?.speed);
  return html`<${Marker}
    label=${index + 1}
    style=${`
      background: ${DEVICE_BG_COLOR};
      ${isConnected && `box-shadow: 0 0 0 2px ${DEVICE_АCTIVE_BG_COLOR}`};
      ${hasSpeed && `background: ${DEVICE_АCTIVE_BG_COLOR};`};
    `}
  />`;
}

function ReachMarker({ reach, style, children }) {
  const { maxPoint, plotLengthPx } = useContext(AppContext);
  if (!plotLengthPx) return null;
  return html`<div
    style=${`
      box-shadow: 0 0 0 ${(reach / maxPoint) * plotLengthPx}px;
      border-radius: 50%;
      ${style}
    `}
  >
    ${children}
  </div>`;
}

function StationReachMarker({ reach, children }) {
  return html`<${ReachMarker} reach=${reach} style=${`color: ${STATION_RING_COLOR}`}>
    ${children}
  <//>`;
}

function Plotter({ x, y, style, children }) {
  const { maxPoint } = useContext(AppContext);
  const leftPerc = (x / maxPoint) * 100;
  const topPerc = (y / maxPoint) * 100;
  return html`<div
    style=${`
      position: absolute;
      left: calc(${leftPerc}% - ${MARKER_RADI_PX}px);
      top: calc(${topPerc}% - ${MARKER_RADI_PX}px);
      ${style}
    `}
  >
    ${children}
  </div>`;
}

function Graph({ style }) {
  const { stations, devices, setPlotLengthPx } = useContext(AppContext);
  const plotRef = useRef();

  useEffect(() => {
    const storeLength = () => setPlotLengthPx(plotRef.current.clientWidth);
    storeLength();
    window.addEventListener("resize", storeLength);
    return () => {
      removeEventListener("resize", storeLength);
    };
  }, []);

  return html`<div
    style=${`
      overflow: hidden;
      padding: ${MARKER_RADI_PX + MARKER_BRD_PX}px;
      background: ${PLOT_BG_COLOR};
      ${style}
    `}
  >
    <div
      ref=${plotRef}
      style=${`
        position: relative;
        aspect-ratio: 1;
      `}
    >
      ${stations.map(
        ({ x, y, reach }, i) =>
          html`<${Plotter} x=${x} y=${y} style="z-index: 2;">
            <${StationReachMarker} reach=${reach}>
              <${StationMarker} index=${i} />
            <//>
          <//>`
      )}
      ${devices.map(
        ({ x, y }, i) =>
          html`<${Plotter} x=${x} y=${y} style="z-index: 1;">
            <${DeviceMarker} index=${i} />
          <//>`
      )}
    </div>
  </div>`;
}

function hexToAlpha(hex, alpha) {
  return `${hex}${Math.floor(alpha * 255)
    .toString(16)
    .padStart(2, 0)}`;
}

function dim(hex, opacity = 0.5) {
  return hexToAlpha(hex, opacity);
}

function getDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function getSpeed(distance, reach) {
  if (distance > reach) return null;
  return Math.round(Math.pow(reach - distance, 2));
}
