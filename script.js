let policies = [];

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
  const div = document.createElement("div");
  div.className = "policy";

  const header = `<h3>${formatPolicyName(p.name)}</h3>`;

  // Registry info table with hover-copy
  let tbl = `
    <table>
      <tr>
        <td>Registry Path</td>
        <td class="copy-cell">${p.key || "-"}
          <button class="copy-btn" title="Copy to clipboard"
                  onclick="navigator.clipboard.writeText('${p.key || ""}')">
            <img src="copy-icon.png" alt="Copy"/>
          </button>
        </td>
      </tr>
      <tr>
        <td>Registry Name</td>
        <td class="copy-cell">${p.valueName || "-"}
          <button class="copy-btn" title="Copy to clipboard"
                  onclick="navigator.clipboard.writeText('${p.valueName || ""}')">
            <img src="copy-icon.png" alt="Copy"/>
          </button>
        </td>
      </tr>
      <tr><td>Value Type</td><td>${p.valueType || "-"}</td></tr>
      <tr><td>Supported On</td><td>${p.supportedOn || "-"}</td></tr>
      <tr><td>Deprecated</td><td>${p.deprecated ? "Yes" : "No"}</td></tr>
      <tr><td>ADMX File</td><td>${p.admxFile || "-"}</td></tr>
    </table>
  `;

  // Options table
  if (p.options && p.options.length) {
    tbl += `
      <table class="options-table">
        <tr><th>Option</th><th>Value</th></tr>
        ${p.options.map(o => `
          <tr class="${o.default ? "default-row" : ""}">
            <td>
              ${o.name}
              ${o.default ? `<span class="default-badge" title="Default">&#9733;</span>` : ""}
            </td>
            <td class="value-cell">${o.value}</td>
          </tr>
        `).join("")}
      </table>
    `;
  }

  const explainDiv = `<div class="explain">${p.explainText || ""}</div>`;
  div.innerHTML = header + tbl + explainDiv;
  results.appendChild(div);

  // JSON view
  document.getElementById("jsonView").textContent = JSON.stringify(p, null, 2);
}

function clearResults() {
  document.getElementById("results").innerHTML = "";
  document.getElementById("jsonView").textContent = "";
}