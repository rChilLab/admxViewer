const searchInput = document.getElementById("search");
const categoryTree = document.getElementById("categoryTree");
const resultsSection = document.getElementById("results");
const expandAllBtn = document.getElementById("expandAll");
const collapseAllBtn = document.getElementById("collapseAll");

let policies = [];
let fuse = null;

fetch("policies.json")
  .then(res => res.json())
  .then(data => {
    policies = data;
    fuse = new Fuse(policies, {
      keys: ["name", "key", "valueName", "explainText", "admxFile", "path"],
      includeScore: true,
      threshold: 0.35,
      minMatchCharLength: 2,
      ignoreLocation: true
    });
    const tree = buildPathTree(policies);
    renderTree(tree, categoryTree);
  });

function buildPathTree(policies) {
  const root = {};
  policies.forEach(p => {
    let node = root;
    p.path.forEach(segment => {
      if (!node[segment]) node[segment] = {};
      node = node[segment];
    });
    if (!node.__policies) node.__policies = [];
    node.__policies.push(p);
  });
  return root;
}

function renderTree(node, container) {
  for (const key in node) {
    if (key === "__policies") continue;
    const li = document.createElement("li");
    li.textContent = key;
    const subUl = document.createElement("ul");
    li.appendChild(subUl);
    renderTree(node[key], subUl);
    if (node[key].__policies) {
      li.addEventListener("click", e => {
        e.stopPropagation();
        const term = searchInput.value.trim();
        let filtered = node[key].__policies;
        if (term && fuse) {
          const results = fuse.search(term);
          filtered = results.map(r => r.item).filter(p => node[key].__policies.includes(p));
        }
        renderPolicies(filtered);
        setActive(li);
      });
    }
    container.appendChild(li);
  }
}

function renderPolicies(policies) {
  resultsSection.innerHTML = "";
  policies.forEach(p => {
    const div = document.createElement("details");
    div.className = "policy";
    div.innerHTML = `
      <summary>${p.name}</summary>
      <table class="policy-table">
        <tbody>
          ${tableRow("Registry Path", p.key)}
          ${tableRow("Value Name", p.valueName)}
          ${p.enabled ? tableRow("Enabled Value", `${p.enabled.value} (${p.enabled.type})`) : ""}
          ${p.disabled ? tableRow("Disabled Value", `${p.disabled.value} (${p.disabled.type})`) : ""}
          ${tableRow("Source", friendlyName(p.admxFile))}
        </tbody>
      </table>
      ${p.explainText ? `<p>${p.explainText}</p>` : ""}
      <button class="json-toggle">Show JSON</button>
      <pre class="json-block" style="display:none;">${JSON.stringify(p, null, 2)}</pre>
    `;
    resultsSection.appendChild(div);
  });

  attachClipboardHandlers();
  attachJsonToggles();
}

function tableRow(label, value) {
  if (!value) value = "–";
  return `
    <tr>
      <td><strong>${label}</strong></td>
      <td>
        <span class="copyable" data-copy="${value}">${value}</span>
        <button class="copy-btn" title="Copy to clipboard">📋</button>
      </td>
    </tr>
  `;
}

function attachClipboardHandlers() {
  document.querySelectorAll(".copy-btn").forEach(button => {
    button.addEventListener("click", e => {
      const span = e.target.previousElementSibling;
      const text = span.dataset.copy;
      navigator.clipboard.writeText(text).then(() => {
        button.textContent = "✅";
        setTimeout(() => (button.textContent = "📋"), 1000);
      });
    });
  });
}

function attachJsonToggles() {
  document.querySelectorAll(".json-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const pre = btn.nextElementSibling;
      if (pre.style.display === "none") {
        pre.style.display = "block";
        btn.textContent = "Hide JSON";
      } else {
        pre.style.display = "none";
        btn.textContent = "Show JSON";
      }
    });
  });
}

expandAllBtn.addEventListener("click", () => {
  document.querySelectorAll("details").forEach(d => (d.open = true));
});

collapseAllBtn.addEventListener("click", () => {
  document.querySelectorAll("details").forEach(d => (d.open = false));
});

function setActive(li) {
  document.querySelectorAll(".sidebar li").forEach(el => el.classList.remove("active"));
  li.classList.add("active");
}

function friendlyName(filename) {
  const map = {
    "msedge.admx": "Microsoft Edge",
    "word16.admx": "Microsoft Word 2016",
    "windows.admx": "Microsoft Windows",
    "office16.admx": "Microsoft Office 2016"
  };
  return map[filename] || filename;
}
