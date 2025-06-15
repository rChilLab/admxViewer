
let allPolicies = [];
let fuse;

fetch("policies.json")
  .then((res) => res.json())
  .then((data) => {
    allPolicies = data;
    initFuse();
    renderTree();
  });

function initFuse() {
  fuse = new Fuse(allPolicies, {
    keys: ["name", "key", "valueName", "parentCategory", "admxFile"],
    threshold: 0.3,
  });
}

function renderTree() {
  const tree = {};
  allPolicies.forEach((p) => {
    const parts = (p.gpPath || p.parentCategory || "Uncategorized").split(" → ");
    let current = tree;
    for (let part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    current.__policies = current.__policies || [];
    current.__policies.push(p);
  });

  const ul = document.getElementById("categoryTree");
  ul.innerHTML = "";
  function buildList(obj, parentUl) {
    for (let key in obj) {
      if (key === "__policies") continue;
      const li = document.createElement("li");
      li.textContent = key;
      li.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".sidebar li").forEach((li) => li.classList.remove("active"));
        li.classList.add("active");
        renderPolicies(obj[key].__policies || []);
      };
      parentUl.appendChild(li);
      const nestedUl = document.createElement("ul");
      li.appendChild(nestedUl);
      buildList(obj[key], nestedUl);
    }
  }
  buildList(tree, ul);
}

function renderPolicies(policies) {
  const container = document.getElementById("results");
  container.innerHTML = "";
  policies.forEach((p) => {
    const details = document.createElement("details");
    details.className = "policy";
    const summary = document.createElement("summary");
    summary.textContent = p.name;
    details.appendChild(summary);

    const table = document.createElement("table");
    table.className = "policy-table";
    const entries = [
      ["Registry Path", p.key],
      ["Value Name", p.valueName],
      ["Value Type", p.valueType || "—"],
      ["Category", p.parentCategory || "—"],
      ["ADMX File", p.admxFile],
    ];
    entries.forEach(([label, val]) => {
      const row = document.createElement("tr");
      const cell1 = document.createElement("td");
      const cell2 = document.createElement("td");
      const copyBtn = document.createElement("span");
      copyBtn.textContent = "📋";
      copyBtn.className = "copy-btn";
      copyBtn.onclick = () => navigator.clipboard.writeText(val || "");
      cell1.textContent = label;
      cell2.textContent = val || "—";
      cell2.appendChild(copyBtn);
      row.appendChild(cell1);
      row.appendChild(cell2);
      table.appendChild(row);
    });
    details.appendChild(table);

    const expl = document.createElement("p");
    expl.textContent = p.explainText || "";
    details.appendChild(expl);

    const jsonToggle = document.createElement("div");
    jsonToggle.className = "json-toggle";
    jsonToggle.textContent = "Show JSON";
    const jsonBlock = document.createElement("pre");
    jsonBlock.className = "json-block";
    jsonBlock.style.display = "none";
    jsonBlock.textContent = JSON.stringify(p, null, 2);
    jsonToggle.onclick = () => {
      jsonBlock.style.display = jsonBlock.style.display === "none" ? "block" : "none";
    };

    details.appendChild(jsonToggle);
    details.appendChild(jsonBlock);

    container.appendChild(details);
  });
}

document.getElementById("search").addEventListener("input", (e) => {
  const query = e.target.value.trim();
  if (!query) {
    renderPolicies([]);
    return;
  }
  const results = fuse.search(query).map((r) => r.item);
  renderPolicies(results);
});

document.getElementById("expandAll").onclick = () =>
  document.querySelectorAll(".policy").forEach((el) => el.setAttribute("open", true));
document.getElementById("collapseAll").onclick = () =>
  document.querySelectorAll(".policy").forEach((el) => el.removeAttribute("open"));
