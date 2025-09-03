document.addEventListener("DOMContentLoaded", () => {
  // --- Global State ---
  let policies = [];
  let policyMap = new Map();
  let fullCategoryTree = {};
  let debounceTimer;
  let activeElement = null;

  // --- DOM Elements ---
  const sidebar = document.getElementById("sidebar");
  const resizer = document.getElementById("resizer");
  const mainContent = document.getElementById("mainContent");
  const categoryTreeContainer = document.getElementById("categoryTree");
  const policyTemplate = document.getElementById("policy-template");

  // Toolbar elements
  const searchInput = document.getElementById("search");
  const clearSearchBtn = document.getElementById("clearSearch");
  const expandAllBtn = document.getElementById("expandAll");
  const collapseAllBtn = document.getElementById("collapseAll");
  const toggleJsonBtn = document.getElementById("toggleJson");
  const classFilterCheckboxes = document.querySelectorAll('.class-filter input[type="checkbox"]');
  
  let resultsContainer, jsonView;

  // --- Initialization ---
  const init = async () => {
    showLoadingState(true);
    setupEventListeners();
    setupResizer();

    try {
      const sanitizedData = await loadAndSanitizePolicies();
      policies = sanitizedData;
      policies.forEach((p, index) => {
        const id = `${p.key || 'nokey'}-${p.valueName || 'novalue'}-${index}`;
        p.uniqueId = id;
        policyMap.set(id, p);
      });

      fullCategoryTree = buildCategoryTree(policies);

      // Calculate the ideal width *before* rendering the tree
      await calculateAndSetSidebarWidth(fullCategoryTree);

      renderCategoryTree(fullCategoryTree, categoryTreeContainer, true);
      applyFilters();
      
    } catch (error) {
      console.error("Initialization failed:", error);
      showErrorState(error.message);
    } finally {
      showLoadingState(false);
    }
  };

  // --- Data Loading & Sanitization ---
  const loadAndSanitizePolicies = async () => {
    const response = await fetch("policies.json");
    if (!response.ok) throw new Error(`Could not load policies.json: ${response.statusText}`);
    const rawText = await response.text();
    // This regex is a bit more robust for cleaning trailing commas
    const sanitizedText = rawText.replace(/,(?=\s*[}\]])/g, '');
    try {
      return JSON.parse(sanitizedText);
    } catch (e) {
      throw new Error("JSON parsing failed. Please check 'policies.json' for errors.");
    }
  };

  // --- UI Rendering ---
  const renderCategoryTree = (node, container, isRoot = false) => {
    const ul = document.createElement("ul");
    if (isRoot) ul.classList.add("root");

    Object.keys(node).filter(key => key !== "__policies").sort().forEach(key => {
      const li = document.createElement("li");
      li.classList.add("category-node");
      
      const span = document.createElement("span");
      span.classList.add("category-name");
      span.textContent = key;
      li.appendChild(span);

      renderCategoryTree(node[key], li);
      ul.appendChild(li);
    });

    if (node.__policies) {
      node.__policies.forEach(policy => {
        const li = document.createElement("li");
        li.classList.add("policy-leaf");
        li.textContent = policy.name || "Untitled Policy";
        li.dataset.policyId = policy.uniqueId;
        ul.appendChild(li);
      });
    }

    container.appendChild(ul);
  };
  
  const renderPolicies = (policiesToRender) => {
    resultsContainer.innerHTML = '';
    jsonView.classList.add("hidden");
    resultsContainer.classList.remove("hidden");

    if (policiesToRender.length === 0) {
      showEmptyState();
      return;
    }

    const fragment = document.createDocumentFragment();
    policiesToRender.forEach(policy => {
      const clone = policyTemplate.content.cloneNode(true);
      clone.querySelector(".policy-name").textContent = policy.name || "Untitled Policy";
      clone.querySelector(".policy-explain").textContent = policy.explainText || "No description available.";
      clone.querySelector(".policy-class").textContent = policy.policyClass;
      clone.querySelector(".policy-class").classList.add(policy.policyClass);
      clone.querySelector(".policy-path").textContent = (policy.categoryPath || []).join(' / ');
      clone.querySelector(".policy-key").textContent = policy.key || "N/A";
      clone.querySelector(".policy-value-name").textContent = policy.valueName || "N/A";
      clone.querySelector(".policy-admx-file").textContent = policy.admxFile || "N/A";
      fragment.appendChild(clone);
    });

    resultsContainer.appendChild(fragment);
  };
  
  // --- UI State Handlers ---
  const showLoadingState = (isLoading) => {
    if (isLoading) {
      mainContent.innerHTML = '<div class="center-message"><div class="loader"></div><p>Loading policies...</p></div>';
    } else {
      mainContent.innerHTML = '<section id="results"></section><pre id="jsonView" class="hidden"></pre>';
      resultsContainer = document.getElementById('results');
      jsonView = document.getElementById('jsonView');
    }
  };
  
  const showEmptyState = () => {
    resultsContainer.innerHTML = '<div class="center-message"><p>No policies found.</p><small>Try clearing the search or selecting a policy from the tree.</small></div>';
  };
  
  const showErrorState = (message) => {
    mainContent.innerHTML = `<div class="center-message"><p style="color: red;"><strong>Error:</strong> ${message}</p></div>`;
  };

  const setActiveSidebarItem = (element) => {
    if (activeElement) activeElement.classList.remove("active");
    if (element) element.classList.add("active");
    activeElement = element;
  };

  // --- Sidebar Sizing (Robust Canvas Method) ---
  const calculateAndSetSidebarWidth = async (tree) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    const bodyStyle = getComputedStyle(document.body);
    const font = `${bodyStyle.fontWeight} ${bodyStyle.fontSize} ${bodyStyle.fontFamily}`;
    context.font = font;

    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const indentSizePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--indent-size')) * rootFontSize;
    
    const PADDING_BUFFER = 50; 
    let maxRequiredWidth = 0;

    const findMaxWidth = (node, depth) => {
      Object.keys(node).filter(key => key !== "__policies").forEach(key => {
        const textMetrics = context.measureText(key);
        const currentWidth = (depth * indentSizePx) + textMetrics.width;
        if (currentWidth > maxRequiredWidth) {
          maxRequiredWidth = currentWidth;
        }
        findMaxWidth(node[key], depth + 1);
      });

      if (node.__policies) {
        node.__policies.forEach(policy => {
          const textMetrics = context.measureText(policy.name || "Untitled Policy");
          const currentWidth = (depth * indentSizePx) + textMetrics.width;
          if (currentWidth > maxRequiredWidth) {
            maxRequiredWidth = currentWidth;
          }
        });
      }
    };

    findMaxWidth(tree, 0);

    // =======================================================================
    // == MODIFIED LINE: Multiply by 1.5 to make it 50% wider for spacing. ==
    // =======================================================================
    const finalWidth = (maxRequiredWidth * 1.5) + PADDING_BUFFER;

    const sidebarStyle = getComputedStyle(sidebar);
    const min = parseFloat(sidebarStyle.minWidth);
    const max = parseFloat(sidebarStyle.maxWidth);

    sidebar.style.width = `${Math.ceil(Math.max(min, Math.min(finalWidth, max)))}px`;
  };
  
  // --- Filtering & Searching ---
  const applyFilters = () => {
    setActiveSidebarItem(null);

    const searchTerm = searchInput.value.toLowerCase();
    const allowedClasses = Array.from(classFilterCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

    const filteredPolicies = policies.filter(p => {
      const nameMatch = p.name && p.name.toLowerCase().includes(searchTerm);
      const explainMatch = p.explainText && p.explainText.toLowerCase().includes(searchTerm);
      const classMatch = p.policyClass && allowedClasses.includes(p.policyClass);
      return (nameMatch || explainMatch) && classMatch;
    });

    renderPolicies(filteredPolicies);
    highlightTree(searchTerm);
  };

  const highlightTree = (term) => {
    const allItems = categoryTreeContainer.querySelectorAll('.category-name, .policy-leaf');
    allItems.forEach(item => {
      const itemText = item.textContent || "";
      const isMatch = term && itemText.toLowerCase().includes(term);
      item.classList.toggle('highlight', isMatch);
      if (isMatch) {
        let parent = item.closest('.category-node');
        while (parent) {
          parent.classList.add('expanded');
          parent = parent.parentElement.closest('.category-node');
        }
      }
    });
  };

  // --- Event Listeners ---
  const setupEventListeners = () => {
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 300);
    });

    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = '';
      applyFilters();
    });

    classFilterCheckboxes.forEach(cb => cb.addEventListener("change", applyFilters));

    expandAllBtn.addEventListener("click", () => categoryTreeContainer.querySelectorAll('.category-node').forEach(n => n.classList.add('expanded')));
    collapseAllBtn.addEventListener("click", () => categoryTreeContainer.querySelectorAll('.category-node').forEach(n => n.classList.remove('expanded')));

    categoryTreeContainer.addEventListener('click', (e) => {
      const target = e.target;
      if (target.matches('.category-name')) {
        target.parentElement.classList.toggle('expanded');
      } else if (target.matches('.policy-leaf')) {
        const policyId = target.dataset.policyId;
        const policy = policyMap.get(policyId);
        if (policy) {
          searchInput.value = '';
          highlightTree('');
          renderPolicies([policy]);
          setActiveSidebarItem(target);
        }
      }
    });
    
    toggleJsonBtn.addEventListener("click", () => {
      resultsContainer.classList.toggle('hidden');
      jsonView.classList.toggle('hidden');
      if (!jsonView.classList.contains('hidden')) {
          const searchTerm = searchInput.value.toLowerCase();
          const allowedClasses = Array.from(classFilterCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
          const currentPolicies = policies.filter(p => {
              const nameMatch = p.name && p.name.toLowerCase().includes(searchTerm);
              const explainMatch = p.explainText && p.explainText.toLowerCase().includes(searchTerm);
              const classMatch = allowedClasses.includes(p.policyClass);
              return (nameMatch || explainMatch) && classMatch;
          });
          jsonView.textContent = JSON.stringify(currentPolicies, null, 2);
      }
    });

    mainContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-cell')) {
            navigator.clipboard.writeText(e.target.textContent).then(() => {
                e.target.classList.add('copied');
                setTimeout(() => e.target.classList.remove('copied'), 1500);
            });
        }
    });
  };

  // --- Helper Functions ---
  const buildCategoryTree = (list) => {
    const tree = {};
    if (!Array.isArray(list)) return tree;
    list.forEach(p => {
      if (!p || !Array.isArray(p.categoryPath)) return;
      let node = tree;
      p.categoryPath.forEach(cat => {
        node[cat] = node[cat] || {};
        node = node[cat];
      });
      node.__policies = (node.__policies || []).concat(p);
    });
    return tree;
  };
  
  const setupResizer = () => {
    let isResizing = false;
    resizer.addEventListener("mousedown", (e) => {
      isResizing = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
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
        document.body.style.userSelect = "";
      }
    });
  };

  // --- Start the App ---
  init();
});
