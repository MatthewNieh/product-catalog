const state = {
  products: [],
  filteredProducts: [],
  compareIds: [],
  editMode: false
};

const PRODUCT_OVERRIDES_KEY = "nistech-product-catalogue-overrides";

const elements = {
  searchInput: document.getElementById("search-input"),
  kindFilter: document.getElementById("kind-filter"),
  brandFilter: document.getElementById("brand-filter"),
  categoryFilter: document.getElementById("category-filter"),
  seriesFilter: document.getElementById("series-filter"),
  productTypeFilter: document.getElementById("product-type-filter"),
  availabilityFilter: document.getElementById("availability-filter"),
  featureFilter: document.getElementById("feature-filter"),
  resetFilters: document.getElementById("reset-filters"),
  productGrid: document.getElementById("product-grid"),
  emptyState: document.getElementById("empty-state"),
  resultsSummary: document.getElementById("results-summary"),
  compareBar: document.getElementById("compare-bar"),
  compareSummary: document.getElementById("compare-summary"),
  compareItems: document.getElementById("compare-items"),
  openCompare: document.getElementById("open-compare"),
  clearCompare: document.getElementById("clear-compare"),
  modalOverlay: document.getElementById("modal-overlay"),
  modalBody: document.getElementById("modal-body"),
  closeModal: document.getElementById("close-modal"),
  productCount: document.getElementById("product-count"),
  mainCount: document.getElementById("main-count"),
  accessoryCount: document.getElementById("accessory-count"),
  toggleEditMode: document.getElementById("toggle-edit-mode"),
  addProduct: document.getElementById("add-product"),
  discardLocalEdits: document.getElementById("discard-local-edits"),
  editModeNote: document.getElementById("edit-mode-note")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();

  try {
    // Load the real product catalogue once, then drive search, filters and comparison from this data.
    const response = await fetch("products.json");
    const sourceProducts = await response.json();
    state.products = loadLocalEdits(sourceProducts);
    state.filteredProducts = [...state.products];
    elements.discardLocalEdits.classList.toggle("hidden", !localStorage.getItem(PRODUCT_OVERRIDES_KEY));

    populateFilters();
    updateStats();
    applyFilters();
  } catch (error) {
    elements.resultsSummary.textContent = "Failed to load products.json.";
    elements.productGrid.innerHTML = "<p>Run the site from a local HTTP server so the JSON file can be fetched.</p>";
    console.error("Error loading product data:", error);
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", applyFilters);
  elements.kindFilter.addEventListener("change", applyFilters);
  elements.brandFilter.addEventListener("change", applyFilters);
  elements.categoryFilter.addEventListener("change", applyFilters);
  elements.seriesFilter.addEventListener("change", applyFilters);
  elements.productTypeFilter.addEventListener("change", applyFilters);
  elements.availabilityFilter.addEventListener("change", applyFilters);
  elements.featureFilter.addEventListener("change", applyFilters);
  elements.resetFilters.addEventListener("click", resetFilters);
  elements.openCompare.addEventListener("click", openComparisonModal);
  elements.clearCompare.addEventListener("click", clearComparison);
  elements.closeModal.addEventListener("click", closeModal);
  elements.toggleEditMode.addEventListener("click", toggleEditMode);
  elements.addProduct.addEventListener("click", openNewProductEditor);
  elements.discardLocalEdits.addEventListener("click", discardLocalEdits);
  elements.modalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.modalOverlay) {
      closeModal();
    }
  });
}

function loadLocalEdits(sourceProducts) {
  try {
    const overrides = JSON.parse(localStorage.getItem(PRODUCT_OVERRIDES_KEY) || "{}");
    const sourceIds = new Set(sourceProducts.map((product) => product.id));
    const editedProducts = sourceProducts.map((product) => ({ ...product, ...(overrides[product.id] || {}) }));
    const localProducts = Object.values(overrides).filter((product) => !sourceIds.has(product.id));
    return [...editedProducts, ...localProducts];
  } catch (error) {
    console.warn("Saved product edits could not be loaded.", error);
    return sourceProducts;
  }
}

function toggleEditMode() {
  state.editMode = !state.editMode;
  elements.toggleEditMode.textContent = state.editMode ? "Finish Editing" : "Edit Catalogue";
  elements.toggleEditMode.setAttribute("aria-pressed", String(state.editMode));
  elements.addProduct.classList.toggle("hidden", !state.editMode);
  elements.editModeNote.classList.toggle("hidden", !state.editMode);
  elements.editModeNote.textContent = state.editMode
    ? "Editing mode is on. Use Edit Product on any card. Changes are saved in this browser only."
    : "";
  renderProducts();
}

function discardLocalEdits() {
  if (!confirm("Discard all saved catalogue edits in this browser?")) {
    return;
  }

  localStorage.removeItem(PRODUCT_OVERRIDES_KEY);
  window.location.reload();
}

function populateFilters() {
  populateSelect(elements.brandFilter, uniqueValues(state.products, "brand"));
  populateSelect(elements.categoryFilter, uniqueValues(state.products, "category"));
  populateSelect(elements.seriesFilter, uniqueValues(state.products, "product_series"));
  populateSelect(elements.productTypeFilter, uniqueValues(state.products, "product_type"));
  populateSelect(elements.availabilityFilter, uniqueValues(state.products, "availability"));

  const featureTags = [...new Set(state.products.flatMap((product) => product.feature_tags))]
    .filter(Boolean)
    .sort();
  populateSelect(elements.featureFilter, featureTags);
}

function populateSelect(selectElement, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function uniqueValues(products, key) {
  return [...new Set(products.map((product) => product[key]).filter(Boolean))].sort();
}

function updateStats() {
  const mainProducts = state.products.filter((product) => product.type === "main");
  const accessories = state.products.filter((product) => product.type === "accessory");

  elements.productCount.textContent = state.products.length;
  elements.mainCount.textContent = mainProducts.length;
  elements.accessoryCount.textContent = accessories.length;
}

function applyFilters() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const kind = elements.kindFilter.value;
  const brand = elements.brandFilter.value;
  const category = elements.categoryFilter.value;
  const series = elements.seriesFilter.value;
  const productType = elements.productTypeFilter.value;
  const availability = elements.availabilityFilter.value;
  const feature = elements.featureFilter.value;

  state.filteredProducts = state.products.filter((product) => {
    const matchesSearch = buildSearchText(product).includes(query);
    const matchesKind = !kind || product.type === kind;
    const matchesBrand = !brand || product.brand === brand;
    const matchesCategory = !category || product.category === category;
    const matchesSeries = !series || product.product_series === series;
    const matchesProductType = !productType || product.product_type === productType;
    const matchesAvailability = !availability || product.availability === availability;
    const matchesFeature = !feature || product.feature_tags.includes(feature);

    return [
      matchesSearch,
      matchesKind,
      matchesBrand,
      matchesCategory,
      matchesSeries,
      matchesProductType,
      matchesAvailability,
      matchesFeature
    ].every(Boolean);
  });

  if (query) {
    state.filteredProducts.sort((left, right) => scoreProductMatch(right, query) - scoreProductMatch(left, query));
  }

  renderProducts();
  updateResultsSummary();
}

function buildSearchText(product) {
  const relatedNames = product.related_products
    .map((id) => getProductById(id)?.name)
    .filter(Boolean)
    .join(" ");

  const compatibleDeviceNames = product.compatible_devices
    .map((id) => getProductById(id)?.name)
    .filter(Boolean)
    .join(" ");

  const compatibleAccessoryNames = product.compatible_accessories
    .map((id) => getProductById(id)?.name)
    .filter(Boolean)
    .join(" ");

  const featureEntries = Object.entries(product.features)
    .filter(([, value]) => value === true || (typeof value === "string" && value !== "No"))
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" ");

  return [
    product.name,
    product.brand,
    product.type,
    product.category,
    product.product_type,
    product.product_series,
    product.availability,
    product.positioning,
    product.public_description,
    product.internal_notes,
    product.feature_tags.join(" "),
    product.best_for.join(" "),
    relatedNames,
    compatibleDeviceNames,
    compatibleAccessoryNames,
    featureEntries
  ]
    .join(" ")
    .toLowerCase();
}

function renderProducts() {
  elements.productGrid.innerHTML = "";
  elements.emptyState.classList.toggle("hidden", state.filteredProducts.length > 0);

  state.filteredProducts.forEach((product) => {
    const isSelected = state.compareIds.includes(product.id);
    const compatibleCount = product.type === "main" ? product.compatible_accessories.length : product.compatible_devices.length;
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-card__image">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-card__body">
        <div class="product-card__meta">
          <span class="pill pill--${product.type}">${capitalize(product.type)}</span>
          <span class="pill">${product.brand}</span>
          <span class="pill">${product.product_series}</span>
        </div>
        <div>
          <h2>${product.name}</h2>
          <p>${product.positioning}</p>
        </div>
        <div class="product-card__meta">
          <span class="pill">${product.category}</span>
          <span class="pill">${product.product_type}</span>
          <span class="pill ${availabilityClassName(product.availability)}">${product.availability}</span>
        </div>
        <div class="product-card__meta">
          ${product.feature_tags.slice(0, 5).map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <div class="support-note">
          ${product.type === "main"
            ? `${compatibleCount} compatible accessory${compatibleCount === 1 ? "" : "ies"}`
            : `${compatibleCount} compatible device${compatibleCount === 1 ? "" : "s"}`}
        </div>
        <div class="price-row">
          <span class="${product.price_nzd_ex_gst > 0 ? "price" : "price price--muted"}">
            ${formatPrice(product.price_nzd_ex_gst)}
          </span>
        </div>
        <div class="button-row">
          <button class="primary-button" data-action="details" data-product-id="${product.id}" type="button">View Details</button>
          ${state.editMode
            ? `<button class="edit-button" data-action="edit" data-product-id="${product.id}" type="button">Edit Product</button>`
            : ""}
          ${product.type === "main"
            ? `<button class="secondary-button" data-action="compare" data-product-id="${product.id}" type="button">${isSelected ? "Remove from Compare" : "Add to Compare"}</button>`
            : `<button class="secondary-button" data-action="fitment" data-product-id="${product.id}" type="button">View Fitment</button>`}
        </div>
      </div>
    `;

    card.querySelector('[data-action="details"]').addEventListener("click", () => openProductModal(product.id));

    if (state.editMode) {
      card.querySelector('[data-action="edit"]').addEventListener("click", () => openProductEditor(product.id));
    }

    if (product.type === "main") {
      card.querySelector('[data-action="compare"]').addEventListener("click", () => toggleCompare(product.id));
    } else {
      card.querySelector('[data-action="fitment"]').addEventListener("click", () => openProductModal(product.id));
    }

    elements.productGrid.appendChild(card);
  });
}

function updateResultsSummary() {
  const count = state.filteredProducts.length;
  const total = state.products.length;
  const mainCount = state.filteredProducts.filter((product) => product.type === "main").length;
  const accessoryCount = count - mainCount;
  elements.resultsSummary.textContent = `${count} of ${total} products shown • ${mainCount} main • ${accessoryCount} accessory`;
}

function resetFilters() {
  elements.searchInput.value = "";
  elements.kindFilter.value = "";
  elements.brandFilter.value = "";
  elements.categoryFilter.value = "";
  elements.seriesFilter.value = "";
  elements.productTypeFilter.value = "";
  elements.availabilityFilter.value = "";
  elements.featureFilter.value = "";
  applyFilters();
}

function toggleCompare(productId) {
  const product = getProductById(productId);
  if (!product || product.type !== "main") {
    return;
  }

  const existingIndex = state.compareIds.indexOf(productId);

  if (existingIndex >= 0) {
    state.compareIds.splice(existingIndex, 1);
  } else if (state.compareIds.length < 4) {
    state.compareIds.push(productId);
  } else {
    alert("You can compare up to 4 main products at a time.");
  }

  renderProducts();
  renderCompareBar();
}

function renderCompareBar() {
  const selectedProducts = getComparedProducts();
  const isVisible = selectedProducts.length > 0;

  elements.compareBar.classList.toggle("hidden", !isVisible);
  elements.compareSummary.textContent = `${selectedProducts.length} main product${selectedProducts.length === 1 ? "" : "s"} selected`;
  elements.compareItems.innerHTML = selectedProducts
    .map((product) => `<span class="compare-chip">${product.name}</span>`)
    .join("");
  elements.openCompare.disabled = selectedProducts.length < 2;
}

function clearComparison() {
  state.compareIds = [];
  renderProducts();
  renderCompareBar();
}

function getComparedProducts() {
  return state.products.filter((product) => state.compareIds.includes(product.id) && product.type === "main");
}

function openProductModal(productId) {
  const product = getProductById(productId);
  if (!product) {
    return;
  }

  const relatedProducts = product.related_products
    .map((id) => getProductById(id))
    .filter(Boolean);

  const compatibleDevices = product.compatible_devices
    .map((id) => getProductById(id))
    .filter(Boolean);

  const compatibleAccessories = product.compatible_accessories
    .map((id) => getProductById(id))
    .filter(Boolean);

  elements.modalBody.innerHTML = `
    <section class="modal__hero">
      <div class="modal__image">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div>
        <div class="modal__meta">
          <span class="pill pill--${product.type}">${capitalize(product.type)}</span>
          <span class="pill">${product.brand}</span>
          <span class="pill">${product.product_series}</span>
          <span class="pill ${availabilityClassName(product.availability)}">${product.availability}</span>
        </div>
        <h2 id="modal-title">${product.name}</h2>
        <p>${product.public_description}</p>

        <div class="modal__section detail-grid">
          <div class="detail-box">
            <strong>Category</strong>
            <p>${product.category}</p>
          </div>
          <div class="detail-box">
            <strong>Product Type</strong>
            <p>${product.product_type}</p>
          </div>
          <div class="detail-box">
            <strong>Positioning</strong>
            <p>${product.positioning}</p>
          </div>
          <div class="detail-box">
            <strong>Best For</strong>
            <p>${product.best_for.join(", ") || "Not specified"}</p>
          </div>
          <div class="detail-box">
            <strong>Price</strong>
            <p>${formatPrice(product.price_nzd_ex_gst)}</p>
          </div>
          <div class="detail-box">
            <strong>Subscription</strong>
            <p>${formatPrice(product.subscription_nzd_ex_gst)}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="modal__section">
      <h3>Key Features</h3>
      <div class="related-list">
        ${product.feature_tags.length
          ? product.feature_tags.map((tag) => `<span class="tag">${tag}</span>`).join("")
          : "<p>No feature tags listed.</p>"}
      </div>
    </section>

    <section class="modal__section detail-grid">
      <div class="detail-box">
        <strong>${product.type === "main" ? "Compatible Accessories" : "Compatible Devices"}</strong>
        <div class="support-list">
          ${(product.type === "main" ? compatibleAccessories : compatibleDevices).length
            ? (product.type === "main" ? compatibleAccessories : compatibleDevices)
                .map((item) => linkedProductPill(item))
                .join("")
            : "<p>No compatibility links listed in the source file.</p>"}
        </div>
      </div>
      <div class="detail-box">
        <strong>Related Products</strong>
        <div class="support-list">
          ${relatedProducts.length
            ? relatedProducts.map((relatedProduct) => linkedProductPill(relatedProduct)).join("")
            : "<p>No related products listed.</p>"}
        </div>
      </div>
    </section>

    <section class="modal__section">
      <div class="detail-box">
        <strong>Internal Notes</strong>
        <p>${product.internal_notes}</p>
      </div>
    </section>
  `;

  elements.modalBody.querySelectorAll("[data-linked-product-id]").forEach((button) => {
    button.addEventListener("click", () => {
      openProductModal(button.dataset.linkedProductId);
    });
  });

  elements.modalOverlay.classList.remove("hidden");
}

function openProductEditor(productId) {
  const product = getProductById(productId);
  if (!product) {
    return;
  }

  renderProductEditor(product, false);
}

function openNewProductEditor() {
  renderProductEditor(createEmptyProduct(), true);
}

function renderProductEditor(product, isNew) {
  const formTitle = isNew ? "Add product" : "Editing product";

  elements.modalBody.innerHTML = `
    <section class="editor-panel">
      <div class="editor-panel__heading">
        <div>
          <p class="eyebrow eyebrow--dark">${formTitle}</p>
          <h2 id="modal-title">${isNew ? "New catalogue product" : escapeHtml(product.name)}</h2>
          <p>Changes are stored locally in this browser. They do not update the shared JSON file.</p>
        </div>
      </div>
      <form id="product-edit-form" class="product-edit-form">
        ${isNew ? editorField("Product ID", "id", product.id, "text", "full", "Use lowercase letters, numbers and hyphens only.") : ""}
        ${isNew ? editorField("Type", "type", product.type, "product-type-select") : ""}
        ${editorField("Product name", "name", product.name)}
        ${editorField("Brand", "brand", product.brand)}
        ${editorField("Category", "category", product.category)}
        ${editorField("Product type", "product_type", product.product_type)}
        ${editorField("Product series", "product_series", product.product_series)}
        ${editorField("Availability", "availability", product.availability, "select")}
        ${editorField("Price NZD ex GST", "price_nzd_ex_gst", product.price_nzd_ex_gst, "number")}
        ${editorField("Subscription NZD ex GST", "subscription_nzd_ex_gst", product.subscription_nzd_ex_gst, "number")}
        ${editorField("Positioning", "positioning", product.positioning, "textarea", "full")}
        ${editorField("Public description", "public_description", product.public_description, "textarea", "full")}
        ${editorField("Best for", "best_for", product.best_for.join(", "), "textarea", "full", "Comma-separated")}
        ${featureTagPicker(product.feature_tags)}
        ${editorField("Image path or URL", "image", product.image, "text", "full", "Use images/filename.png for a repository image, or paste a public image URL.")}
        <label class="editor-field editor-field--full">
          <span>Upload image to this browser</span>
          <input id="edit-image-upload" name="image_upload" type="file" accept="image/*">
          <small>Local-only: upload is stored in this browser and will not be added to the Git repository.</small>
        </label>
        ${editorField("Internal notes", "internal_notes", product.internal_notes, "textarea", "full")}
        <div class="editor-actions">
          <button class="primary-button" type="submit">Save Local Changes</button>
          <button class="secondary-button" id="cancel-product-edit" type="button">Cancel</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById("cancel-product-edit").addEventListener("click", () => {
    if (isNew) {
      closeModal();
      return;
    }
    openProductModal(product.id);
  });
  document.getElementById("product-edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProductEdits(product, new FormData(event.currentTarget), isNew);
  });
  elements.modalOverlay.classList.remove("hidden");
}

function editorField(label, name, value, type = "text", modifier = "", hint = "") {
  const fieldId = `edit-${name}`;
  const safeValue = escapeHtml(value ?? "");
  let control = `<input id="${fieldId}" name="${name}" type="${type}" value="${safeValue}">`;

  if (type === "textarea") {
    control = `<textarea id="${fieldId}" name="${name}" rows="4">${safeValue}</textarea>`;
  }

  if (type === "select") {
    control = `<select id="${fieldId}" name="${name}">
      ${["Available", "Unavailable"].map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
    </select>`;
  }

  if (type === "product-type-select") {
    control = `<select id="${fieldId}" name="${name}">
      <option value="main" ${value === "main" ? "selected" : ""}>Main</option>
      <option value="accessory" ${value === "accessory" ? "selected" : ""}>Accessory</option>
    </select>`;
  }

  return `<label class="editor-field ${modifier ? `editor-field--${modifier}` : ""}">
    <span>${label}</span>
    ${control}
    ${hint ? `<small>${hint}</small>` : ""}
  </label>`;
}

function featureTagPicker(selectedTags) {
  const tags = [...new Set(state.products.flatMap((product) => product.feature_tags))].filter(Boolean).sort();
  return `<fieldset class="editor-field editor-field--full feature-picker">
    <legend>Key feature tags</legend>
    <div class="feature-picker__options">
      ${tags.map((tag) => `<label><input type="checkbox" name="feature_tag" value="${escapeHtml(tag)}" ${selectedTags.includes(tag) ? "checked" : ""}><span>${escapeHtml(tag)}</span></label>`).join("")}
    </div>
    <label class="feature-picker__custom"><span>Add custom tags</span><input name="custom_feature_tags" type="text" placeholder="Comma-separated tags"></label>
  </fieldset>`;
}

async function saveProductEdits(product, formData, isNew) {
  const requestedId = (formData.get("id") || product.id).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const productId = isNew ? requestedId : product.id;
  if (!productId) {
    alert("A product ID is required.");
    return;
  }

  if (isNew && getProductById(productId)) {
    alert("That product ID already exists. Choose a different ID.");
    return;
  }

  const uploadedImage = await readImageFile(formData.get("image_upload"));
  const editedProduct = {
    ...product,
    id: productId,
    type: isNew ? formData.get("type") : product.type,
    name: formData.get("name").trim(),
    brand: formData.get("brand").trim(),
    category: formData.get("category").trim(),
    product_type: formData.get("product_type").trim(),
    product_series: formData.get("product_series").trim(),
    availability: formData.get("availability"),
    price_nzd_ex_gst: Number(formData.get("price_nzd_ex_gst")) || 0,
    subscription_nzd_ex_gst: Number(formData.get("subscription_nzd_ex_gst")) || 0,
    positioning: formData.get("positioning").trim(),
    public_description: formData.get("public_description").trim(),
    best_for: splitList(formData.get("best_for")),
    feature_tags: selectedFeatureTags(formData),
    image: uploadedImage || formData.get("image").trim() || "images/placeholder.jpg",
    internal_notes: formData.get("internal_notes").trim()
  };

  const nextProducts = isNew
    ? [...state.products, editedProduct]
    : state.products.map((item) => item.id === productId ? editedProduct : item);
  if (!saveLocalEdits(nextProducts)) {
    return;
  }

  state.products = nextProducts;
  populateFiltersFromCurrentState();
  updateStats();
  applyFilters();
  openProductModal(productId);
}

function selectedFeatureTags(formData) {
  return [...new Set([...formData.getAll("feature_tag"), ...splitList(formData.get("custom_feature_tags"))])];
}

function readImageFile(file) {
  if (!file || !file.size) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Image file could not be read.")));
    reader.readAsDataURL(file);
  });
}

function createEmptyProduct() {
  return {
    id: "new-product",
    type: "accessory",
    brand: "",
    name: "",
    category: "",
    product_type: "",
    product_series: "",
    availability: "Available",
    price_nzd_ex_gst: 0,
    subscription_nzd_ex_gst: 0,
    positioning: "",
    public_description: "",
    best_for: [],
    features: defaultFeatures(),
    feature_tags: [],
    related_products: [],
    compatible_devices: [],
    compatible_accessories: [],
    image: "images/placeholder.jpg",
    internal_notes: ""
  };
}

function defaultFeatures() {
  return {
    "J2534": false,
    "Online Programming": false,
    "Topology": false,
    "ADAS": false,
    "TPMS": false,
    "Key Programming": "No",
    "Heavy Duty": false,
    "Remote Diagnosis": false,
    "Battery Testing": false,
    "Motorcycle": false,
    "Commercial Vehicle": false,
    "EV Diagnostics": false,
    "Oscilloscope": false,
    "VCI Included": false,
    "Wireless Bluetooth": false,
    "CAN FD": false,
    "DoIP": false
  };
}

function splitList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function saveLocalEdits(products = state.products) {
  try {
    const overrides = Object.fromEntries(products.map((product) => [product.id, product]));
    localStorage.setItem(PRODUCT_OVERRIDES_KEY, JSON.stringify(overrides));
    elements.discardLocalEdits.classList.remove("hidden");
    return true;
  } catch (error) {
    alert("Your edit could not be saved in this browser. Use a smaller image, or save the image in the images folder and enter its path instead.");
    console.error("Local catalogue save failed:", error);
    return false;
  }
}

function populateFiltersFromCurrentState() {
  [elements.brandFilter, elements.categoryFilter, elements.seriesFilter, elements.productTypeFilter, elements.availabilityFilter, elements.featureFilter]
    .forEach((select) => { select.length = 1; });
  populateFilters();
}

function openComparisonModal() {
  const comparedProducts = getComparedProducts();
  if (comparedProducts.length < 2) {
    return;
  }

  const rows = [
    { label: "Brand", getValue: (product) => product.brand },
    { label: "Name", getValue: (product) => product.name },
    { label: "Series", getValue: (product) => product.product_series },
    { label: "Category", getValue: (product) => product.category },
    { label: "Product type", getValue: (product) => product.product_type },
    { label: "Availability", getValue: (product) => product.availability },
    { label: "Price", getValue: (product) => formatPrice(product.price_nzd_ex_gst) },
    { label: "J2534", getValue: (product) => yesNoOrText(product.features["J2534"]) },
    { label: "Online Programming", getValue: (product) => yesNoOrText(product.features["Online Programming"]) },
    { label: "Topology", getValue: (product) => yesNoOrText(product.features["Topology"]) },
    { label: "ADAS", getValue: (product) => yesNoOrText(product.features["ADAS"]) },
    { label: "TPMS", getValue: (product) => yesNoOrText(product.features["TPMS"]) },
    { label: "Key Programming", getValue: (product) => yesNoOrText(product.features["Key Programming"]) },
    { label: "Heavy Duty", getValue: (product) => yesNoOrText(product.features["Heavy Duty"]) },
    { label: "Battery Testing", getValue: (product) => yesNoOrText(product.features["Battery Testing"]) },
    { label: "Commercial Vehicle", getValue: (product) => yesNoOrText(product.features["Commercial Vehicle"]) },
    { label: "EV Diagnostics", getValue: (product) => yesNoOrText(product.features["EV Diagnostics"]) },
    { label: "Oscilloscope", getValue: (product) => yesNoOrText(product.features["Oscilloscope"]) },
    { label: "Best For", getValue: (product) => product.best_for.join(", ") },
    { label: "Compatible Accessories", getValue: (product) => mapIdsToNames(product.compatible_accessories) || "None listed" },
    { label: "Internal Notes", getValue: (product) => product.internal_notes }
  ];

  elements.modalBody.innerHTML = `
    <section class="comparison-panel">
      <div class="results-bar">
        <div>
          <h2 id="modal-title">Main Product Comparison</h2>
          <p>Only products with type <strong>main</strong> can be compared.</p>
        </div>
        <button class="secondary-button" id="clear-compare-modal" type="button">Clear Comparison</button>
      </div>
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Criteria</th>
              ${comparedProducts.map((product) => `<th>${product.name}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <th scope="row">${row.label}</th>
                ${comparedProducts.map((product) => `<td>${row.getValue(product)}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.getElementById("clear-compare-modal").addEventListener("click", () => {
    clearComparison();
    closeModal();
  });

  elements.modalOverlay.classList.remove("hidden");
}

function closeModal() {
  elements.modalOverlay.classList.add("hidden");
  elements.modalBody.innerHTML = "";
}

function getProductById(productId) {
  return state.products.find((item) => item.id === productId);
}

function mapIdsToNames(ids) {
  return ids
    .map((id) => getProductById(id)?.name)
    .filter(Boolean)
    .join(", ");
}

function formatPrice(value) {
  if (!value || value <= 0) {
    return "Price on request";
  }

  return `${new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0
  }).format(value)} ex GST`;
}

function scoreProductMatch(product, query) {
  const exactName = product.name.toLowerCase() === query ? 100 : 0;
  const startsWithName = product.name.toLowerCase().startsWith(query) ? 50 : 0;
  const includesName = product.name.toLowerCase().includes(query) ? 25 : 0;
  const includesSeries = product.product_series.toLowerCase().includes(query) ? 10 : 0;
  const mainPenalty = product.type === "main" ? 0 : 3;

  return exactName + startsWithName + includesName + includesSeries + mainPenalty;
}

function yesNoOrText(value) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return value || "N/A";
}

function availabilityClassName(availability) {
  if (availability === "Available") {
    return "pill--available";
  }

  if (availability === "Unavailable") {
    return "pill--unavailable";
  }

  return "pill--neutral";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function linkedProductPill(product) {
  return `
    <button
      class="pill pill--linked"
      data-linked-product-id="${product.id}"
      type="button"
    >
      ${product.name}
    </button>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
