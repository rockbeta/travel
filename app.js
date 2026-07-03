const DB_NAME = "atlas-trail-tree-db";
const STORE_NAME = "nodes";
const DB_VERSION = 1;

const sampleNodes = [
  {
    id: 0,
    parentId: null,
    name: "Trip to Maine",
    startDate: "2026-07-03",
    endDate: "2026-07-05",
    startTime: "",
    endTime: "",
    isHotel: false,
    isDining: false,
    location: "Maine",
    description: "Summary of the trip",
    level: 0,
    lat: 45.2538,
    lng: -69.4455
  },
  {
    id: 1,
    parentId: 0,
    name: "Lunch",
    startDate: "2026-07-03",
    endDate: "2026-07-03",
    startTime: "12:30",
    endTime: "13:30",
    isHotel: false,
    isDining: true,
    location: "Eventide Oyster Co, Portland, ME",
    description: "First day lunch",
    level: 1,
    lat: 43.6577,
    lng: -70.2537
  },
  {
    id: 2,
    parentId: 0,
    name: "Point of Interest 1",
    startDate: "2026-07-03",
    endDate: "2026-07-03",
    startTime: "14:30",
    endTime: "16:30",
    isHotel: false,
    isDining: false,
    location: "Portland Head Light, Cape Elizabeth, ME",
    description: "Place to visit 1",
    level: 1,
    lat: 43.6231,
    lng: -70.2079
  },
  {
    id: 3,
    parentId: 0,
    name: "Hotel 1",
    startDate: "2026-07-03",
    endDate: "2026-07-04",
    startTime: "",
    endTime: "",
    isHotel: true,
    isDining: false,
    location: "Portland Harbor Hotel, Portland, ME",
    description: "First night hotel",
    level: 1,
    lat: 43.6562,
    lng: -70.2544
  },
  {
    id: 4,
    parentId: 0,
    name: "Point of Interest 2",
    startDate: "2026-07-04",
    endDate: "2026-07-04",
    startTime: "10:30",
    endTime: "16:30",
    isHotel: false,
    isDining: false,
    location: "Acadia National Park, ME",
    description: "Place to visit 2",
    level: 1,
    lat: 44.3386,
    lng: -68.2733
  },
  {
    id: 5,
    parentId: 4,
    name: "Sub Point Under Point of Interest 2",
    startDate: "2026-07-04",
    endDate: "2026-07-04",
    startTime: "11:30",
    endTime: "14:30",
    isHotel: false,
    isDining: false,
    location: "Jordan Pond, Acadia National Park, ME",
    description: "Some special location inside place to visit 2",
    level: 2,
    lat: 44.3206,
    lng: -68.2507
  }
];

let db;
let nodes = [];
let map;
let markerLayer;
let selectedNodeId = 0;

const elements = {
  dbStatus: document.querySelector("#db-status"),
  treeList: document.querySelector("#tree-list"),
  nodeCount: document.querySelector("#node-count"),
  hotelCount: document.querySelector("#hotel-count"),
  diningCount: document.querySelector("#dining-count"),
  tripTitle: document.querySelector("#trip-title"),
  tripMeta: document.querySelector("#trip-meta"),
  dialog: document.querySelector("#node-dialog"),
  form: document.querySelector("#node-form"),
  dialogMode: document.querySelector("#dialog-mode"),
  dialogTitle: document.querySelector("#dialog-title"),
  deleteButton: document.querySelector("#delete-node"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelEdit: document.querySelector("#cancel-edit"),
  seedData: document.querySelector("#seed-data"),
  newRootChild: document.querySelector("#new-root-child"),
  fallbackMap: document.querySelector("#fallback-map")
};

const fields = {
  id: document.querySelector("#node-id"),
  parentId: document.querySelector("#parent-id"),
  displayId: document.querySelector("#display-id"),
  level: document.querySelector("#level"),
  name: document.querySelector("#name"),
  startDate: document.querySelector("#start-date"),
  endDate: document.querySelector("#end-date"),
  startTime: document.querySelector("#start-time"),
  endTime: document.querySelector("#end-time"),
  isHotel: document.querySelector("#is-hotel"),
  isDining: document.querySelector("#is-dining"),
  location: document.querySelector("#location"),
  description: document.querySelector("#description")
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStore(mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = callback(store);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

function getAllNodes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveNode(node) {
  await runStore("readwrite", (store) => store.put(node));
  await refreshFromDatabase("Saved locally");
}

async function deleteNodes(ids) {
  await runStore("readwrite", (store) => ids.forEach((id) => store.delete(id)));
  selectedNodeId = 0;
  await refreshFromDatabase("Deleted locally");
}

async function seedSampleData() {
  await runStore("readwrite", (store) => {
    store.clear();
    sampleNodes.forEach((node) => store.put({ ...node }));
  });
  selectedNodeId = 0;
  await refreshFromDatabase("Sample restored");
}

function formatDate(value) {
  if (!value) {
    return "nil";
  }
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateRange(node) {
  const start = formatDate(node.startDate);
  const end = formatDate(node.endDate);
  return start === end ? start : `${start} - ${end}`;
}

function formatTime(value) {
  if (!value) {
    return "nil";
  }
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatTimeRange(node) {
  return `${formatTime(node.startTime)} - ${formatTime(node.endTime)}`;
}

function parseCoordinates(location) {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  return { lat, lng };
}

function normalizeNode(formData) {
  const id = Number(formData.get("id"));
  const location = formData.get("location").trim();
  const coordinates = parseCoordinates(location);
  const existing = nodes.find((node) => node.id === id);

  return {
    id,
    parentId: formData.get("parentId") === "" ? null : Number(formData.get("parentId")),
    name: formData.get("name").trim(),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    isHotel: formData.get("isHotel") === "on",
    isDining: formData.get("isDining") === "on",
    location,
    description: formData.get("description").trim(),
    level: Number(formData.get("level")),
    lat: coordinates?.lat ?? existing?.lat ?? fallbackCoordinate(id).lat,
    lng: coordinates?.lng ?? existing?.lng ?? fallbackCoordinate(id).lng
  };
}

function fallbackCoordinate(id) {
  const index = Math.max(0, nodes.findIndex((node) => node.id === id));
  return {
    lat: 43.66 + index * 0.17,
    lng: -70.25 + index * 0.28
  };
}

function nextNodeId() {
  return nodes.reduce((max, node) => Math.max(max, node.id), -1) + 1;
}

function getChildren(parentId) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => {
      const dateSort = a.startDate.localeCompare(b.startDate);
      return dateSort || a.id - b.id;
    });
}

function collectDescendantIds(nodeId) {
  const ids = [nodeId];
  getChildren(nodeId).forEach((child) => {
    ids.push(...collectDescendantIds(child.id));
  });
  return ids;
}

function markerClass(node) {
  if (node.level === 0) {
    return "trip";
  }
  if (node.isHotel) {
    return "hotel";
  }
  if (node.isDining) {
    return "dining";
  }
  return "poi";
}

function markerIcon(node) {
  if (node.level === 0) {
    return "★";
  }
  if (node.isHotel) {
    return "▣";
  }
  if (node.isDining) {
    return "●";
  }
  return "◆";
}

function createTreeItem(node) {
  const item = document.createElement("article");
  item.className = `tree-item level-${Math.min(node.level, 4)}${selectedNodeId === node.id ? " is-selected" : ""}`;

  const main = document.createElement("button");
  main.className = "tree-main";
  main.type = "button";
  main.addEventListener("click", () => {
    selectedNodeId = node.id;
    render();
    focusMapNode(node);
  });

  const meta = document.createElement("div");
  meta.className = "node-meta";
  meta.innerHTML = `
    <span>#${node.id}</span>
    <span>Level ${node.level}</span>
    <span>${node.isHotel ? "Hotel" : "No hotel"}</span>
    <span>${node.isDining ? "Dining" : "No dining"}</span>
  `;

  const title = document.createElement("h3");
  title.textContent = node.name;

  const detail = document.createElement("p");
  detail.textContent = `${formatDateRange(node)} • ${formatTimeRange(node)} • ${node.location}`;

  main.append(meta, title, detail);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const addChild = document.createElement("button");
  addChild.className = "icon-button";
  addChild.type = "button";
  addChild.textContent = "+";
  addChild.title = "Add child node";
  addChild.setAttribute("aria-label", `Add child under ${node.name}`);
  addChild.addEventListener("click", () => openEditor(createBlankNode(node)));

  const edit = document.createElement("button");
  edit.className = "icon-button";
  edit.type = "button";
  edit.textContent = "✎";
  edit.title = "Edit node";
  edit.setAttribute("aria-label", `Edit ${node.name}`);
  edit.addEventListener("click", () => openEditor(node));

  const remove = document.createElement("button");
  remove.className = "icon-button";
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "Delete node";
  remove.setAttribute("aria-label", `Delete ${node.name}`);
  remove.addEventListener("click", () => confirmDelete(node));

  actions.append(addChild, edit, remove);
  item.append(main, actions);

  const children = getChildren(node.id);
  if (children.length) {
    const childWrap = document.createElement("div");
    childWrap.className = "children";
    children.forEach((child) => childWrap.append(createTreeItem(child)));
    item.append(childWrap);
  }

  return item;
}

function renderTree() {
  elements.treeList.innerHTML = "";
  const roots = getChildren(null);
  roots.forEach((node) => elements.treeList.append(createTreeItem(node)));
}

function renderSummary() {
  const root = nodes.find((node) => node.level === 0) ?? nodes[0];
  elements.tripTitle.textContent = root?.name ?? "Untitled Trip";
  elements.tripMeta.textContent = root ? formatDateRange(root) : "No date range";
  elements.nodeCount.textContent = nodes.length;
  elements.hotelCount.textContent = nodes.filter((node) => node.isHotel).length;
  elements.diningCount.textContent = nodes.filter((node) => node.isDining).length;
}

function initMap() {
  document.querySelector("#map").hidden = true;
  elements.fallbackMap.hidden = false;
}

function renderMap() {
  if (!map || !markerLayer) {
    renderFallbackMap();
    return;
  }

  markerLayer.clearLayers();
  const bounds = [];

  nodes.forEach((node) => {
    const marker = L.marker([node.lat, node.lng], {
      title: node.name,
      icon: L.divIcon({
        className: `map-marker marker-${markerClass(node)}${selectedNodeId === node.id ? " is-selected" : ""}`,
        html: `<span>${markerIcon(node)}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      })
    });

    marker.bindPopup(`<strong>${node.name}</strong><br>${node.location}<br>${formatDateRange(node)}`);
    marker.on("click", () => {
      selectedNodeId = node.id;
      render();
    });
    marker.addTo(markerLayer);
    bounds.push([node.lat, node.lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 10 });
  }
}

function renderFallbackMap() {
  elements.fallbackMap.innerHTML = "";
  const lats = nodes.map((node) => node.lat);
  const lngs = nodes.map((node) => node.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.1, maxLat - minLat);
  const lngRange = Math.max(0.1, maxLng - minLng);

  nodes.forEach((node, index) => {
    const pin = document.createElement("button");
    pin.className = `fallback-pin marker-${markerClass(node)}${selectedNodeId === node.id ? " is-selected" : ""}`;
    pin.type = "button";
    pin.textContent = markerIcon(node);
    const x = ((node.lng - minLng) / lngRange) * 70 + 15;
    const y = (1 - (node.lat - minLat) / latRange) * 66 + 17;
    pin.style.left = `${Number.isFinite(x) ? x : 18 + (index * 19) % 64}%`;
    pin.style.top = `${Number.isFinite(y) ? y : 22 + (index * 17) % 58}%`;
    pin.setAttribute("aria-label", node.name);
    pin.addEventListener("click", () => {
      selectedNodeId = node.id;
      render();
    });
    elements.fallbackMap.append(pin);
  });
}

function focusMapNode(node) {
  if (map) {
    map.setView([node.lat, node.lng], Math.max(map.getZoom(), 11), { animate: true });
  }
}

function createBlankNode(parent) {
  return {
    id: nextNodeId(),
    parentId: parent?.id ?? 0,
    name: "New travel point",
    startDate: parent?.startDate ?? "2026-07-03",
    endDate: parent?.endDate ?? "2026-07-03",
    startTime: "",
    endTime: "",
    isHotel: false,
    isDining: false,
    location: parent?.location ?? "Maine",
    description: "",
    level: parent ? parent.level + 1 : 1,
    lat: parent ? parent.lat + 0.04 : 44.1,
    lng: parent ? parent.lng + 0.04 : -69.5
  };
}

function openEditor(node) {
  const isNew = !nodes.some((savedNode) => savedNode.id === node.id);
  elements.dialogMode.textContent = isNew ? "Add Node" : "Edit Node";
  elements.dialogTitle.textContent = node.name || "Travel Point";
  fields.id.value = node.id;
  fields.parentId.value = node.parentId ?? "";
  fields.displayId.value = node.id;
  fields.level.value = node.level;
  fields.name.value = node.name;
  fields.startDate.value = node.startDate;
  fields.endDate.value = node.endDate;
  fields.startTime.value = node.startTime;
  fields.endTime.value = node.endTime;
  fields.isHotel.checked = node.isHotel;
  fields.isDining.checked = node.isDining;
  fields.location.value = node.location;
  fields.description.value = node.description;
  elements.deleteButton.hidden = isNew;
  elements.dialog.showModal();
}

function closeEditor() {
  elements.dialog.close();
}

async function confirmDelete(node) {
  if (node.level === 0 && nodes.length > 1) {
    alert("Delete child nodes before deleting the root trip.");
    return;
  }
  const ids = collectDescendantIds(node.id);
  const suffix = ids.length > 1 ? ` and ${ids.length - 1} child node(s)` : "";
  if (confirm(`Delete ${node.name}${suffix}?`)) {
    await deleteNodes(ids);
  }
}

function render() {
  renderSummary();
  renderTree();
  renderMap();
}

async function refreshFromDatabase(message) {
  nodes = await getAllNodes();
  nodes.sort((a, b) => a.id - b.id);
  if (!nodes.length) {
    await seedSampleData();
    return;
  }
  elements.dbStatus.textContent = message ?? "Saved in IndexedDB";
  render();
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const node = normalizeNode(formData);
  selectedNodeId = node.id;
  await saveNode(node);
  closeEditor();
});

elements.deleteButton.addEventListener("click", async () => {
  const node = nodes.find((savedNode) => savedNode.id === Number(fields.id.value));
  if (node) {
    closeEditor();
    await confirmDelete(node);
  }
});

elements.closeDialog.addEventListener("click", closeEditor);
elements.cancelEdit.addEventListener("click", closeEditor);
elements.seedData.addEventListener("click", seedSampleData);
elements.newRootChild.addEventListener("click", () => {
  const root = nodes.find((node) => node.level === 0) ?? nodes[0];
  openEditor(createBlankNode(root));
});

document.addEventListener("DOMContentLoaded", async () => {
  db = await openDatabase();
  initMap();
  await refreshFromDatabase("Loaded from IndexedDB");
});
