let policies = [];
let fullCategoryTree = {};

document.addEventListener("DOMContentLoaded", () => {
  // 1. Sidebar-Resizer
  const sidebar = document.getElementById("sidebar");
  const resizer = document.getElementById("resizer");
  let isResizing = false;
  resizer.addEventListener("mousedown", () => {
    isResizing = true;
    document.body.style.cursor = "col-resize";
  });
  document.addEventListener("mousemove", e => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    const min = parseInt(getComputedStyle(sidebar).minWidth);
    const max = parseInt(getComputedStyle(sidebar).maxWidth);
    if (newWidth > min && newWidth < max) {
      sidebar.style.width = newWidth + "px";
    }
  });
  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
    }
  });

  // 2. Control-Buttons & Inputs
  document.getElementById("expandAll").addEventListener("click", () =>
    document.querySelectorAll("#categoryTree ul").forEach(u => u.style.display = "block")
  );
  document.getElementById("collapseAll").addEventListener("click", () =>
    document.querySelectorAll("#categoryTree ul").forEach(u => u.style.display = "none")
  );
  document.getElementById("clearSearch").addEventListener("click", () => {
    document.getElementById("search").value = "";
    applyFilters();
  });
  document.getElementById("search").addEventListener("input", applyFilters);
  document.querySelectorAll('.class-filter input').forEach(cb =>
    cb.addEventListener("change", applyFilters)
  );
  document.getElementById("toggleJson").addEventListener("click", () =>
    document.getElementById("jsonView").classList.toggle("hidden")
  );

  // 3. Reset all filters on project-title click
  const projTitle = document.querySelector(".project-title");
  projTitle.addEventListener("click", () => {
    // clear search
    document.getElementById("search").value = "";
    // re-check both class filters
    document.querySelectorAll('.class-filter input').forEach(cb => cb.checked = true);
    // re-render
    applyFilters();
  });

  // 4. Load policies.json
  fetch("policies.json")
    .then(res => res.json())
    .then(data => {
      policies = data;
      fullCategoryTree = buildCategoryTree(policies);
      applyFilters();  // initial render
    })
    .catch(err => console.error("Fehler beim Laden der policies.json:", err));
});

// Pascal/CamelCase → "Title Case"
function formatPolicyName(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, s => s.toUpperCase());
}

// Build category tree
function buildCategoryTree(list) {
  const tree = {};
  list.forEach(p => {
    if (!Array.isArray(p.categoryPath)) return;
    let node = tree;
    p.categoryPath.forEach(cat => {
      node[cat] = node[cat] || {};
      node = node[cat];
    });
    node.__policies = (node.__policies || []).concat(p);
  });
  return tree;
}

// Render sidebar recursively
function renderSidebar(tree, container = document.getElementById("categoryTree"), depth = 0) {
  container.innerHTML = "";
  for (const key in tree) {
    if (key === "__policies") continue;
    const li = document.createElement("li");
    li.className = "collapsible";
    li.style.paddingLeft = `${depth * 16}px`;
    const label = key.replace(/\$\((?:string\.)?(.+)\)/, (_, m) => m.replace(/_/g, " "));
    li.textContent = `📂 ${label}`;
    const sub = document.createElement("ul");
    sub.style.display = "none";
    li.appendChild(sub);
    li.addEventListener("click", e => {
      e.stopPropagation();
      sub.style.display = sub.style.display === "block" ? "none" : "block";
    });
    renderSidebar(tree[key], sub, depth + 1);
    (tree[key].__policies || []).forEach(p => {
      const leaf = document.createElement("li");
      leaf.className = "policy-leaf";
      leaf.style.paddingLeft = `${(depth + 1) * 16}px`;
      leaf.textContent = `📄 ${formatPolicyName(p.name)}`;
      leaf.addEventListener("click", ev => {
        ev.stopPropagation();
        showPolicy(p);
      });
      sub.appendChild(leaf);
    });
    container.appendChild(li);
  }
}

// Get selected classes from checkboxes
function getSelectedClasses() {
  return Array.from(document.querySelectorAll('.class-filter input:checked'))
    .map(cb => cb.value);
}

// Apply search + class filters
function applyFilters() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const classes = getSelectedClasses();
  let filtered = policies.filter(p => classes.includes(p.policyClass));
  if (q) {
    filtered = filtered.filter(p => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.key && p.key.toLowerCase().includes(q)) return true;
      if (p.valueName && p.valueName.toLowerCase().includes(q)) return true;
      if (p.admxFile && p.admxFile.toLowerCase().includes(q)) return true;
      return Array.isArray(p.categoryPath) && p.categoryPath.some(c => c.toLowerCase().includes(q));
    });
  }
  renderSidebar(buildCategoryTree(filtered));
  clearResults();
}

// Show policy details
function showPolicy(p) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  const container = document.createElement("div");
  container.className = "policy";

  const title = document.createElement("h3");
  title.textContent = formatPolicyName(p.name);
  container.appendChild(title);

  const table = document.createElement("table");

  function addCopyRow(label, value) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = label;
    const tdValue = document.createElement("td");
    tdValue.className = "copy-cell";
    tdValue.appendChild(document.createTextNode(value || "-"));
    tdValue.append(" ");
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.title = "Copy to clipboard";
    btn.addEventListener("click", () => navigator.clipboard.writeText(value || ""));
    const img = document.createElement("img");
    img.src = "copy-icon.png";
    img.alt = "Copy";
    btn.appendChild(img);
    tdValue.appendChild(btn);
    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  }

  function addRow(label, value) {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = label;
    const td2 = document.createElement("td");
    td2.textContent = value || "-";
    tr.appendChild(td1);
    tr.appendChild(td2);
    table.appendChild(tr);
  }

  addCopyRow("Registry Path", p.key);
  addCopyRow("Registry Name", p.valueName);
  addRow("Value Type", p.valueType);
  addRow("Supported On", p.supportedOn);
  addRow("Deprecated", p.deprecated ? "Yes" : "No");
  addRow("ADMX File", p.admxFile);

  container.appendChild(table);

  if (p.options && p.options.length) {
    const optTable = document.createElement("table");
    optTable.className = "options-table";

    const headerRow = document.createElement("tr");
    const thOpt = document.createElement("th");
    thOpt.textContent = "Option";
    const thVal = document.createElement("th");
    thVal.textContent = "Value";
    headerRow.appendChild(thOpt);
    headerRow.appendChild(thVal);
    optTable.appendChild(headerRow);

    p.options.forEach(o => {
      const tr = document.createElement("tr");
      if (o.default) tr.className = "default-row";

      const tdOpt = document.createElement("td");
      tdOpt.appendChild(document.createTextNode(o.name));
      if (o.default) {
        tdOpt.append(" ");
        const badge = document.createElement("span");
        badge.className = "default-badge";
        badge.title = "Default";
        badge.textContent = "★";
        tdOpt.appendChild(badge);
      }

      const tdVal = document.createElement("td");
      tdVal.className = "value-cell";
      tdVal.textContent = o.value;

      tr.appendChild(tdOpt);
      tr.appendChild(tdVal);
      optTable.appendChild(tr);
    });

    container.appendChild(optTable);
  }

  const explain = document.createElement("div");
  explain.className = "explain";
  explain.textContent = p.explainText || "";
  container.appendChild(explain);

  results.appendChild(container);

  document.getElementById("jsonView").textContent = JSON.stringify(p, null, 2);
}

function clearResults() {
  document.getElementById("results").innerHTML = "";
  document.getElementById("jsonView").textContent = "";
}