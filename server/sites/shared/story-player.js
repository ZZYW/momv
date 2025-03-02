document.addEventListener("alpine:init", () => {
  Alpine.data("storyPlayer", () => ({
    // ===== CONFIGURATION =====
    config: {
      serverUrl: "http://localhost:3001",
      playerId:
        "player_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2, 9),
      storyPath: "input/story.json",
      debug: false,
      // Determine which station this is - used for localStorage namespacing
      stationId: window.location.pathname.includes("station2") ? "station2" : "station1"
    },

    // ===== STATE =====
    state: {
      projectBlocks: [],
      passages: [],
      currentPassageIndex: 0,
      isLoading: false,
      error: null,
      pendingOptionSelections: 0,
    },

    // ===== INITIALIZATION =====
    init() {
      this.loadStory();
    },

    // ===== LOGGING =====
    log(...args) {
      if (this.config.debug) {
        console.log(...args);
      }
    },

    // ===== STORY LOADING & PARSING =====
    loadStory() {
      this.state.isLoading = true;
      fetch(`${this.config.storyPath}?nocache=${new Date().getTime()}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load story (${response.status})`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.blocks && Array.isArray(data.blocks)) {
            this.state.projectBlocks = data.blocks;
            this.groupBlocksIntoPassages();
            this.renderPassage(0);

            // Activate first passage
            const firstPassage = document.getElementById("passage-0");
            if (firstPassage) {
              firstPassage.classList.add("active");
              this.loadDynamicContentForPassage(firstPassage).then(() => {
                this.setupContinueButton(firstPassage);
              });
            }
          } else {
            throw new Error(
              "Invalid story data: missing or invalid blocks array"
            );
          }
        })
        .catch((error) => {
          this.log("Error loading story:", error);
          this.state.error = error.message;
          document.getElementById(
            "passage-container"
          ).innerHTML = `<div class='error'>Error loading story: ${error.message}</div>`;
        })
        .finally(() => {
          this.state.isLoading = false;
        });
    },

    groupBlocksIntoPassages() {
      let current = [];
      this.state.passages = [];

      this.state.projectBlocks.forEach((block) => {
        if (block.type === "scene-header" && current.length > 0) {
          this.state.passages.push(current);
          current = [];
        }
        current.push(block);
      });

      if (current.length > 0) {
        this.state.passages.push(current);
      }

      this.log(
        `Grouped ${this.state.projectBlocks.length} blocks into ${this.state.passages.length} passages`
      );
    },

    // ===== RENDERING =====
    renderPassage(passageIndex) {
      if (passageIndex >= this.state.passages.length) return;

      const container = document.getElementById("passage-container");
      const blocks = this.state.passages[passageIndex];
      const passageEl = document.createElement("div");

      passageEl.className = "passage";
      passageEl.id = `passage-${passageIndex}`;

      // Create elements for each block
      blocks.forEach((block) => {
        const blockEl = document.createElement("div");
        blockEl.className = `block-${block.type}`;
        blockEl.style.marginBottom = "20px";

        // Render block based on its type
        blockEl.innerHTML = this.renderBlockContent(block);
        passageEl.appendChild(blockEl);

        // Add event listeners for interactive blocks
        if (block.type === "static") {
          setTimeout(
            () => this.attachStaticOptionHandlers(blockEl, block.id),
            0
          );
        }
      });

      // Add navigation elements
      this.addNavigationToPassage(passageEl, passageIndex);
      container.appendChild(passageEl);
    },

    renderBlockContent(block) {
      // Block renderers by type
      const renderers = {
        plain: (b) => `<div class="plain">${b.text || ""}</div>`,

        static: (b) => {
          if (!Array.isArray(b.options))
            return '<div class="error">No options provided</div>';

          // Create options with dividers
          let optionsHTML = "";
          b.options.forEach((opt, i) => {
            if (i > 0) {
              // Add a divider before all options except the first one
              optionsHTML += `<div class="option-divider">/</div>`;
            }
            optionsHTML += `<div class="static-option" data-idx="${i}">${opt}</div>`;
          });

          return `<div class="static-option-container">${optionsHTML}</div>`;
        },

        "dynamic-option": (b) => `
          <div class="dynamic-container">
            <div class="loading-indicator">Loading dynamic options... <span class="loading"></span></div>
            <div class="dynamic-options-container" data-uuid="${b.id}"></div>
          </div>`,

        "dynamic-text": (b) => `
          <div class="dynamic-container">
            <div class="loading-indicator">Generating text... <span class="loading"></span></div>
            <div class="dynamic-text-container" data-uuid="${b.id}"></div>
          </div>`,

        "dynamic-word": (b) => `
          <div class="dynamic-container">
            <div class="loading-indicator">Generating word... <span class="loading"></span></div>
            <div class="dynamic-word-container" data-uuid="${b.id}"></div>
          </div>`,

        "scene-header": (b) => `<div class="scene-header">${b.titleName || "Scene"}</div>`,
      };

      // Use the appropriate renderer or return an error message
      const renderer = renderers[block.type];
      return renderer
        ? renderer(block)
        : `<div class="error">Unknown block type: ${block.type}</div>`;
    },

    attachStaticOptionHandlers(blockEl, blockId) {
      const options = blockEl.querySelectorAll(".static-option");
      options.forEach((opt) => {
        opt.addEventListener("click", () => {
          this.selectOption(opt, blockId, "static");
        });
      });
    },

    addNavigationToPassage(passageEl, passageIndex) {
      if (passageIndex < this.state.passages.length - 1) {
        const navContainer = document.createElement("div");
        navContainer.className = "navigation-container";

        const continueLink = document.createElement("a");
        continueLink.href = "#";
        continueLink.className = "next-link";
        continueLink.innerText = "继续";
        continueLink.style.display = "none"; // Initially hidden

        continueLink.addEventListener("click", (e) => {
          e.preventDefault();
          this.goToNextPassage(passageIndex);
        });

        navContainer.appendChild(continueLink);
        passageEl.appendChild(navContainer);
      } else {
        const endMessage = document.createElement("div");
        endMessage.className = "end-message";
        endMessage.innerText = "The End";
        passageEl.appendChild(endMessage);
      }
    },

    // ===== DYNAMIC CONTENT =====
    loadDynamicContentForPassage(passageElement) {
      const dynamicContainers = passageElement.querySelectorAll(
        ".dynamic-options-container, .dynamic-text-container, .dynamic-word-container"
      );

      const promises = Array.from(dynamicContainers).map((container) => {
        let blockType = this.getDynamicContainerType(container);
        return this.fetchDynamicBlock(
          container.dataset.uuid,
          blockType,
          container
        );
      });

      return Promise.all(promises);
    },

    getDynamicContainerType(container) {
      if (container.classList.contains("dynamic-options-container"))
        return "dynamic-option";
      if (container.classList.contains("dynamic-text-container"))
        return "dynamic-text";
      if (container.classList.contains("dynamic-word-container"))
        return "dynamic-word";
      return "";
    },

    fetchDynamicBlock(blockID, blockType, container) {
      const blockData = this.state.projectBlocks.find(
        (b) => b.id === blockID
      );

      if (!blockData) {
        container.innerText = "No block data found";
        return Promise.resolve();
      }

      const loadingIndicator = container
        .closest(".dynamic-container")
        .querySelector(".loading-indicator");

      const payload = {
        message: blockData.prompt || "",
        playerID: this.config.playerId,
        blockId: blockID,
        blockUUID: blockID, // keeping for backward compatibility
        instruction: blockData.prompt || "",
        contextRefs: (blockData.context || []).filter((ctx) => ctx.value),
        blockType,
        optionCount: blockData.optionCount,
        sentenceCount: blockData.sentenceCount,
        lexiconCategory: blockData.lexiconCategory,
        storyId: "1", // Currently hard-coded for story.json
      };

      return fetch(`${this.config.serverUrl}/generate-dynamic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(`Server error: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          // Hide loading indicator
          if (loadingIndicator) loadingIndicator.style.display = "none";
          this.renderDynamicContent(container, data, blockType, blockID);

          // After rendering dynamic content, check if we should update continue button
          this.checkPassageChoicesStatus();
        })
        .catch((err) => {
          console.error("Error in fetchDynamicBlock:", err);
          container.innerText = `Error loading dynamic content: ${err.message}`;
          if (loadingIndicator) loadingIndicator.style.display = "none";
        });
    },

    renderDynamicContent(container, data, blockType, blockID) {
      const renderers = {
        "dynamic-option": (container, data, blockID) => {
          const options = Array.isArray(data) ? data : ["?", "?", "?"];
          container.innerHTML = "";

          options.forEach((opt, i) => {
            // Add divider before all options except the first one
            if (i > 0) {
              const dividerEl = document.createElement("div");
              dividerEl.className = "option-divider";
              dividerEl.textContent = "/";
              container.appendChild(dividerEl);
            }

            const optEl = document.createElement("div");
            optEl.className = "static-option";
            optEl.dataset.index = i;
            optEl.textContent = opt;

            optEl.addEventListener("click", () => {
              this.selectOption(optEl, blockID, "dynamic-option");
            });

            container.appendChild(optEl);
          });
        },

        "dynamic-text": (container, data) => {
          container.innerHTML = `<div class="dynamic-text-result">${
            data || ""
          }</div>`;
        },

        "dynamic-word": (container, data) => {
          container.innerHTML = `<span class="dynamic-word">${
            data || ""
          }</span>`;
        },
      };

      const renderer = renderers[blockType];
      if (renderer) {
        renderer(container, data, blockID);
      } else {
        container.innerHTML = `<div class="error">Unknown dynamic block type: ${blockType}</div>`;
      }
    },

    // ===== INTERACTION HANDLING =====
    selectOption(elem, blockID, type) {
      const container = elem.parentElement;
      const allOpts = container.querySelectorAll(".static-option");

      // Mark this selection as already processed
      if (elem.classList.contains("selected")) {
        return; // Already processed this selection
      }
      // Immediately disable ALL options (including the selected one)
      allOpts.forEach((opt) => {
        opt.style.pointerEvents = "none"; // This prevents clicking
        opt.style.cursor = "default"; // Visual indicator that it's not clickable
        opt.onclick = null; // Remove click handlers
      });
      // Update UI - first mark the selected element
      elem.classList.add("selected");

      // Then fade the other options and dividers
      allOpts.forEach((o) => {
        if (o !== elem) {
          o.classList.add("faded");
          o.onclick = null; // Disable further clicks

          // Listen for the end of the fade animation and remove the element
          o.addEventListener(
            "transitionend",
            function () {
              if (o.parentElement) {
                // Check if still in DOM
              }
            },
            { once: true }
          );
        }
      });

      // Find and fade all dividers
      const dividers = container.querySelectorAll(".option-divider");
      dividers.forEach((divider) => {
        divider.classList.add("faded");
      });

      // Extract data
      const chosenText = elem.textContent;
      const chosenIndex =
        type === "static"
          ? parseInt(elem.dataset.idx)
          : parseInt(elem.dataset.index);

      // Record choice on server
      this.recordChoice(
        blockID,
        type,
        chosenIndex,
        chosenText,
        Array.from(allOpts).map((x) => x.textContent)
      );

      // Immediately check if we should show the continue button
      // Mark the selection as completed right away in the DOM
      container.dataset.selectionComplete = "true";

      // Force an immediate check for Continue button visibility
      setTimeout(() => this.checkPassageChoicesStatus(), 0);
    },

    recordChoice(
      blockID,
      blockType,
      chosenIndex,
      chosenText,
      availableOptions
    ) {
      // Find the block data to get instruction and context blocks
      const blockData = this.state.projectBlocks.find(
        (b) => b.id === blockID
      );
      const instruction = blockData?.prompt || "";
      const contextBlocks = (blockData?.context || []).filter(
        (ctx) => ctx.value
      );

      fetch(`${this.config.serverUrl}/record-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerID: this.config.playerId,
          blockUUID: blockID,
          blockType,
          chosenIndex,
          chosenText,
          availableOptions,
          instruction,
          contextBlocks,
        }),
      }).catch((err) => {
        this.log("Error recording choice:", err);
      });
    },

    // ===== CONTINUE BUTTON MANAGEMENT =====
    setupContinueButton(passageEl) {
      const continueLink = passageEl.querySelector(".next-link");
      if (!continueLink) return;

      // Check if passage has any option elements
      const hasOptions = this.passageHasUnselectedOptions(passageEl);

      if (hasOptions) {
        // Has options - continue will be shown when all are selected
        // (handled by checkPassageChoicesStatus)
        continueLink.style.display = "none";
      } else {
        // No options to select, show continue after delay
        setTimeout(() => {
          continueLink.style.display = "inline-block";
        }, 5000);
      }
    },

    passageHasUnselectedOptions(passageEl) {
      // Check all option containers
      const optionContainers = passageEl.querySelectorAll(
        ".static-option-container, .dynamic-options-container"
      );

      for (const container of optionContainers) {
        // Skip containers where a selection has already been made
        if (container.dataset.selectionComplete === "true") {
          continue;
        }

        // If there are any options that haven't been selected
        const options = container.querySelectorAll(".static-option");
        if (
          options.length > 0 &&
          !container.querySelector(".static-option.selected")
        ) {
          return true;
        }
      }

      return false;
    },

    checkPassageChoicesStatus() {
      const passageEl = document.getElementById(
        `passage-${this.state.currentPassageIndex}`
      );
      if (!passageEl) return;

      const continueLink = passageEl.querySelector(".next-link");
      if (!continueLink) return;

      // Check if there are any unselected options left
      const anyUnselectedOptions =
        this.passageHasUnselectedOptions(passageEl);

      // If no unselected options, show the continue button
      if (!anyUnselectedOptions) {
        continueLink.style.display = "inline-block";
      }
    },

    // ===== NAVIGATION =====
    goToNextPassage(currIndex) {
      const currentEl = document.getElementById(`passage-${currIndex}`);
      const nextIndex = currIndex + 1;

      // Render next passage if it doesn't exist yet
      if (!document.getElementById(`passage-${nextIndex}`)) {
        this.renderPassage(nextIndex);
      }

      const nextEl = document.getElementById(`passage-${nextIndex}`);
      nextEl.style.display = "none";

      // Handle transition
      this.transitionToNextPassage(currentEl, nextEl, nextIndex);
    },

    transitionToNextPassage(currentEl, nextEl, nextIndex) {
      // Start fade-out animation on current passage
      if (currentEl) {
        currentEl.classList.add("fade-out");
      }

      // Load dynamic content and handle transition
      this.loadDynamicContentForPassage(nextEl).then(() => {
        // Scroll to top immediately
        window.scrollTo(0, 0);

        // Simple approach: After fade-out completes, hide current and show next
        setTimeout(() => {
          if (currentEl) {
            // Hide current passage
            currentEl.classList.remove("active");
            currentEl.style.display = "none";
            currentEl.classList.remove("fade-out");
          }

          // Show next passage with fade-in
          nextEl.style.display = "block";
          nextEl.classList.add("active", "fade-in");
          this.state.currentPassageIndex = nextIndex;

          // Set up the continue button
          this.setupContinueButton(nextEl);

          // Clean up animation classes after fade-in completes
          setTimeout(() => {
            nextEl.classList.remove("fade-in");
          }, 3000); // Match the CSS animation duration (3s)
        }, 1000); // Wait for fade-out to complete (adjust if needed)
      });
    },
  }));
});