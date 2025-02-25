(function () {
    // Sample project JSON.
    // In production, you would load or pass in the exported JSON instead.
    var project = {
        autosave: "2025-02-24 10:00:00",
        blocks: [
            { type: "plain", text: "Welcome to our interactive story!" },
            { type: "static", options: ["Option A", "Option B"] },
            {
                type: "dynamic-option",
                blockName: "Dynamic Options",
                optionCount: 3,
                prompt: "Choose one dynamically",
                context: []
            },
            { type: "scene-header", titleName: "Scene Break" },
            { type: "plain", text: "This is the second page." },
            {
                type: "dynamic-text",
                blockName: "Dynamic Text",
                sentenceCount: 2,
                prompt: "Generate text here",
                context: []
            },
            {
                type: "dynamic-word",
                blockName: "Dynamic Word",
                lexiconCategory: "noun",
                prompt: "Give me a noun",
                context: []
            }
        ]
    };

    /**
     * Compiles the project JSON into a string containing HTML passages.
     * Blocks between scene-header blocks are grouped as a single passage.
     */
    function compilePlayableContent(proj) {
        var passages = [];
        var currentPassage = "";

        proj.blocks.forEach(function (block) {
            // Scene headers are used only as passage dividers.
            if (block.type === "scene-header") {
                if (currentPassage.trim() !== "") {
                    passages.push(currentPassage);
                }
                currentPassage = ""; // Reset passage content.
                return;
            }
            if (block.type === "plain") {
                currentPassage += `<span class="plain">${block.text}</span>`;
            } else if (block.type === "static") {
                var optionsHtml = "";
                block.options.forEach(function (option) {
                    if (option.trim() !== "") {
                        optionsHtml += `<span class="static-option" onclick="selectOption(this)">${option}</span>`;
                    }
                });
                currentPassage += `<span class="static-options">${optionsHtml}</span>`;
            } else if (block.type === "dynamic-option") {
                // Render dynamic option block using a data attribute.
                currentPassage += `<span class="dynamic-options" data-block='${JSON.stringify(
                    block
                )}'>Loading dynamic options...</span>`;
            } else if (block.type === "dynamic-text") {
                currentPassage += `<span class="dynamic-text-result" data-block='${JSON.stringify(
                    block
                )}'>Loading dynamic text...</span>`;
            } else if (block.type === "dynamic-word") {
                currentPassage += `<span class="dynamic-word-result" data-block='${JSON.stringify(
                    block
                )}'>Loading dynamic word...</span>`;
            }
        });
        // Push the final passage if it has content.
        if (currentPassage.trim() !== "") {
            passages.push(currentPassage);
        }

        // Build the full HTML for passages.
        // Use a single class attribute per passage.
        var passagesHtml = "";
        for (var i = 0; i < passages.length; i++) {
            passagesHtml += `<div class="passage ${i === 0 ? "active" : ""}" id="passage-${i}">
          ${passages[i]}
          ${i < passages.length - 1 ? `<br/><a href="#" class="next-link" onclick="goToNextPassage(${i})">Proceed</a>` : ""}
        </div>`;
        }
        return passagesHtml;
    }

    // Renders the compiled passages into the container.
    function renderPlayableContent() {
        var container = document.getElementById("passageContainer");
        container.innerHTML = compilePlayableContent(project);
        processDynamicBlocks();
    }

    // Passage navigation: hide current, show next.
    window.goToNextPassage = function (currentIndex) {
        var current = document.getElementById("passage-" + currentIndex);
        var next = document.getElementById("passage-" + (currentIndex + 1));
        if (current && next) {
            current.classList.remove("active");
            next.classList.add("active");
        }
    };

    // Option selection: record selection and fade out unselected options.
    window.selectOption = function (element) {
        var container = element.parentElement;
        var options = container.getElementsByClassName("static-option");
        for (var i = 0; i < options.length; i++) {
            options[i].classList.add("faded");
        }
        element.classList.remove("faded");
        element.classList.add("selected");
        // Optionally record the selection here.
    };

    /**
     * Process dynamic blocks.
     * In a real scenario, you would send block data via AJAX/fetch to your backend routes
     * (for example, '/api/dynamic-option', '/api/dynamic-text', etc.)
     * and then update the block content with the backend response.
     * Here, we simulate the responses.
     */
    function processDynamicBlocks() {
        // Process Dynamic Option blocks.
        var dynamicOptions = document.getElementsByClassName("dynamic-options");
        for (var i = 0; i < dynamicOptions.length; i++) {
            // Simulated backend response.
            dynamicOptions[i].innerHTML =
                "<ul>" +
                "<li onclick='selectOption(this)'>Dynamic Option 1</li>" +
                "<li onclick='selectOption(this)'>Dynamic Option 2</li>" +
                "</ul>";
        }
        // Process Dynamic Text blocks.
        var dynamicText = document.getElementsByClassName("dynamic-text-result");
        for (var i = 0; i < dynamicText.length; i++) {
            dynamicText[i].innerHTML =
                "This is the dynamic text generated by our backend.";
        }
        // Process Dynamic Word blocks.
        var dynamicWord = document.getElementsByClassName("dynamic-word-result");
        for (var i = 0; i < dynamicWord.length; i++) {
            dynamicWord[i].innerHTML =
                '<span class="dynamic-word-result">DynamicWord</span>';
        }
    }

    // Use DOMContentLoaded to initialize the playable content.
    document.addEventListener("DOMContentLoaded", renderPlayableContent);
})();