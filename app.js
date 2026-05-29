import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTn_2uQ6QI64Hs4pt80o---Vyja4Ma8cg",
  authDomain: "facturas-15a89.firebaseapp.com",
  projectId: "facturas-15a89",
  storageBucket: "facturas-15a89.firebasestorage.app",
  messagingSenderId: "984723713116",
  appId: "1:984723713116:web:3103de5cdd3b0a9c47ca99",
};

const COLLECTION_NAME = "activities";
const PHOTO_MAX_SIZE = 1000;
const PHOTO_QUALITY = 0.72;

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const activitiesCollection = collection(firestore, COLLECTION_NAME);

const form = document.querySelector("#activityForm");
const recordId = document.querySelector("#recordId");
const nameInput = document.querySelector("#nameInput");
const dateInput = document.querySelector("#dateInput");
const placeInput = document.querySelector("#placeInput");
const descriptionInput = document.querySelector("#descriptionInput");
const photoInput = document.querySelector("#photoInput");
const preview = document.querySelector("#imagePreview");
const previewImage = document.querySelector("#previewImage");
const removePhotoButton = document.querySelector("#removePhotoButton");
const recordsGrid = document.querySelector("#recordsGrid");
const emptyState = document.querySelector("#emptyState");
const recordTemplate = document.querySelector("#recordTemplate");
const recordCount = document.querySelector("#recordCount");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const formTitle = document.querySelector("#formTitle");
const cancelEditButton = document.querySelector("#cancelEditButton");
const resetFormButton = document.querySelector("#resetFormButton");
const newRecordButton = document.querySelector("#newRecordButton");
const printButton = document.querySelector("#printButton");
const exportButton = document.querySelector("#exportButton");
const clearButton = document.querySelector("#clearButton");
const dropZone = document.querySelector("#dropZone");
const statusMessage = document.querySelector("#statusMessage");
const saveButton = document.querySelector("#saveButton");

let records = [];
let selectedPhotoFile = null;
let selectedPhotoUrl = "";

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}

function getErrorMessage(error) {
  const code = error?.code ? ` (${error.code})` : "";
  return `${error?.message || "Error desconocido"}${code}`;
}

function setSaving(isSaving) {
  saveButton.disabled = isSaving;
  saveButton.textContent = isSaving ? "Guardando..." : "Guardar factura";
}

function setToday() {
  dateInput.value = new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function readAllRecords() {
  const snapshot = await getDocs(activitiesCollection);
  return snapshot.docs.map((activityDoc) => ({
    id: activityDoc.id,
    ...activityDoc.data(),
  }));
}

async function saveRecord(record) {
  await setDoc(doc(firestore, COLLECTION_NAME, record.id), record, { merge: true });
}

async function deleteRecord(id) {
  await deleteDoc(doc(firestore, COLLECTION_NAME, id));
}

async function clearRecords() {
  await Promise.all(records.map((record) => deleteRecord(record.id)));
}

function getVisibleRecords() {
  const query = normalize(searchInput.value.trim());
  const sorted = [...records].sort((a, b) => {
    const left = new Date(a.date || 0).getTime();
    const right = new Date(b.date || 0).getTime();
    return sortSelect.value === "oldest" ? left - right : right - left;
  });

  if (!query) return sorted;

  return sorted.filter((record) => {
    const content = normalize(`${record.name} ${record.date} ${record.place} ${record.description}`);
    return content.includes(query);
  });
}

function renderRecords() {
  const visibleRecords = getVisibleRecords();
  recordsGrid.innerHTML = "";
  emptyState.hidden = visibleRecords.length > 0;
  recordCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;

  visibleRecords.forEach((record) => {
    const fragment = recordTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".record-card");
    const image = fragment.querySelector(".record-photo");
    const name = fragment.querySelector(".record-name");
    const time = fragment.querySelector("time");
    const place = fragment.querySelector(".record-place");
    const description = fragment.querySelector(".record-description");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");

    card.dataset.id = record.id;
    image.src = record.photoData || record.photoUrl || "";
    image.alt = `Foto de factura del ${formatDate(record.date)}`;
    name.textContent = record.name || "Factura sin nombre";
    time.textContent = formatDate(record.date);
    time.dateTime = record.date || "";
    place.textContent = record.place || "Sin lugar";
    description.textContent = record.description;

    editButton.addEventListener("click", () => startEdit(record.id));
    deleteButton.addEventListener("click", async () => {
      const confirmed = confirm("Eliminar esta factura?");
      if (!confirmed) return;

      try {
        setStatus("Eliminando actividad...");
        await deleteRecord(record.id);
        await refreshRecords();
        setStatus("Firestore conectado", "ready");
      } catch (error) {
        console.error(error);
        setStatus(`No se pudo eliminar: ${getErrorMessage(error)}`, "error");
      }
    });

    recordsGrid.appendChild(fragment);
  });
}

function resetForm() {
  form.reset();
  recordId.value = "";
  selectedPhotoFile = null;
  selectedPhotoUrl = "";
  preview.hidden = true;
  previewImage.removeAttribute("src");
  photoInput.value = "";
  formTitle.textContent = "Nueva factura";
  cancelEditButton.hidden = true;
  setToday();
}

function showPreview(source) {
  selectedPhotoUrl = source;
  previewImage.src = source;
  preview.hidden = false;
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function refreshRecords() {
  records = await readAllRecords();
  renderRecords();
}

function startEdit(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  recordId.value = record.id;
  nameInput.value = record.name || "";
  dateInput.value = record.date;
  placeInput.value = record.place || "";
  descriptionInput.value = record.description || "";
  selectedPhotoFile = null;
  showPreview(record.photoData || record.photoUrl);
  formTitle.textContent = "Editar factura";
  cancelEditButton.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadExport() {
  const payload = JSON.stringify(records, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `facturas-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function compressPhoto(file) {
  const source = await readPhoto(file);
  const image = await loadImage(source);
  const scale = Math.min(1, PHOTO_MAX_SIZE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedPhotoFile && !selectedPhotoUrl) {
    alert("Sube una foto para guardar la factura.");
    return;
  }

  const existingId = recordId.value;
  const existingRecord = records.find((item) => item.id === existingId);
  const activityId = existingId || doc(activitiesCollection).id;

  try {
    setSaving(true);
    setStatus("Guardando en Firestore...");

    let photoFields = {
      photoData: existingRecord?.photoData || selectedPhotoUrl,
      photoName: existingRecord?.photoName || "",
    };

    if (selectedPhotoFile) {
      photoFields = {
        photoData: await compressPhoto(selectedPhotoFile),
        photoName: selectedPhotoFile.name,
      };
    }

    const record = {
      id: activityId,
      name: nameInput.value.trim(),
      date: dateInput.value,
      place: placeInput.value.trim(),
      description: descriptionInput.value.trim(),
      ...photoFields,
      updatedAt: serverTimestamp(),
      createdAt: existingRecord?.createdAt || serverTimestamp(),
    };

    await saveRecord(record);
    await refreshRecords();
    resetForm();
    setStatus("Firestore conectado", "ready");
  } catch (error) {
    console.error(error);
    setStatus(`No se pudo guardar: ${getErrorMessage(error)}`, "error");
  } finally {
    setSaving(false);
  }
});

photoInput.addEventListener("change", async () => {
  const [file] = photoInput.files;
  if (!file) return;
  selectedPhotoFile = file;
  showPreview(await readPhoto(file));
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  if (!file || !file.type.startsWith("image/")) return;
  photoInput.files = event.dataTransfer.files;
  selectedPhotoFile = file;
  showPreview(await readPhoto(file));
});

removePhotoButton.addEventListener("click", () => {
  selectedPhotoFile = null;
  selectedPhotoUrl = "";
  photoInput.value = "";
  preview.hidden = true;
  previewImage.removeAttribute("src");
});

resetFormButton.addEventListener("click", () => {
  window.setTimeout(resetForm, 0);
});

cancelEditButton.addEventListener("click", resetForm);
newRecordButton.addEventListener("click", () => {
  resetForm();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

searchInput.addEventListener("input", renderRecords);
sortSelect.addEventListener("change", renderRecords);
printButton.addEventListener("click", () => window.print());
exportButton.addEventListener("click", downloadExport);

clearButton.addEventListener("click", async () => {
  if (!records.length) return;
  const confirmed = confirm("Eliminar todos los registros guardados en Firestore?");
  if (!confirmed) return;

  try {
    setStatus("Limpiando Firestore...");
    await clearRecords();
    await refreshRecords();
    resetForm();
    setStatus("Firestore conectado", "ready");
  } catch (error) {
    console.error(error);
    setStatus(`No se pudo limpiar: ${getErrorMessage(error)}`, "error");
  }
});

async function init() {
  setToday();
  await refreshRecords();
  setStatus("Firestore conectado", "ready");
}

init().catch((error) => {
  console.error(error);
  setStatus(`No se pudo conectar con Firestore: ${getErrorMessage(error)}`, "error");
});
