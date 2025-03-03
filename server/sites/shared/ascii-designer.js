
document.addEventListener("DOMContentLoaded", function (event) {
    updateBorders();
    addVerticalBorders();

    // // Run again after a delay to catch any dynamic content loading
    // setTimeout(() => {
    //     updateBorders();
    //     addVerticalBorders();
    // }, 500);

    // // Also update when window is resized
    // window.addEventListener("resize", () => {
    //     updateBorders();
    //     addVerticalBorders();
    // });

    function updateBorders() {
        const passageContainer = document.getElementById("passage-container");
        if (!passageContainer) return;

        const width = passageContainer.offsetWidth;
        const dashCount = Math.max(width / 8 + 3, 20); // Approximate character width

        const borderLine = "+" + "-".repeat(Math.floor(dashCount)) + "+";

        document.getElementById("ascii-top").textContent = borderLine;
    }

    function addVerticalBorders() {
        // Configuration constants for border design
        const CONFIG = {
            maxHeight: 280,           // Maximum height for the borders
            baseInterval: 12,         // Base distance between markers
            barCount: 3,              // Number of solid bars at the top
            growthRate: 0.1,          // How quickly spacing increases (higher = faster fade)
            paddingSize: 20,          // Padding added to container for borders
            transitionPoint: 3        // Number of dots before more aggressive spacing
        };

        // Remove any existing vertical borders
        const existingBorders = document.querySelectorAll(".vertical-border");
        existingBorders.forEach((border) => border.remove());

        const passageContainer = document.getElementById("passage-container");
        if (!passageContainer) return;

        // Set relative positioning on the container if not already set
        if (getComputedStyle(passageContainer).position === "static") {
            passageContainer.style.position = "relative";
        }

        // Add padding to the sides of the container to make room for borders
        passageContainer.style.paddingLeft = `${CONFIG.paddingSize}px`;
        passageContainer.style.paddingRight = `${CONFIG.paddingSize}px`;

        // Get the height of the passage container
        const height = passageContainer.offsetHeight;
        const maxHeight = Math.min(CONFIG.maxHeight, height);

        // Create border containers with shared styles
        const createBorderContainer = (side) => {
            const border = document.createElement("div");
            border.className = `vertical-border ${side}-border`;
            Object.assign(border.style, {
                position: "absolute",
                [side]: "0",
                top: "0",
                height: `${height}px`,
                pointerEvents: "none" // Make sure it doesn't interfere with clicks
            });
            return border;
        };

        const leftBorder = createBorderContainer("left");
        const rightBorder = createBorderContainer("right");

        // Generate positions for border markers
        const generateMarkerPositions = () => {
            const positions = [];

            // Add solid bars at the top
            for (let i = 0; i < CONFIG.barCount; i++) {
                positions.push({
                    y: i * CONFIG.baseInterval,
                    char: "|"
                });
            }

            // Calculate starting position after bars
            let posY = CONFIG.baseInterval * CONFIG.barCount;
            let dotIndex = 0;

            // Add dots with exponentially increasing spacing
            while (posY < maxHeight) {
                positions.push({ y: posY, char: "." });

                // Adjust growth rate for smoother transition
                const growthFactor = dotIndex < CONFIG.transitionPoint ?
                    CONFIG.growthRate * 0.7 : CONFIG.growthRate;

                // Calculate gap to next marker using exponential growth
                const gap = CONFIG.baseInterval * Math.exp(growthFactor * dotIndex);
                posY += gap;
                dotIndex++;

                // Safety check to avoid infinite loops
                if (dotIndex > 30) break;
            }

            return positions;
        };

        // Create and add marker elements
        const addMarkers = (positions) => {
            positions.forEach((pos) => {
                // Create marker elements for both sides
                [leftBorder, rightBorder].forEach(border => {
                    const marker = document.createElement("div");
                    marker.textContent = pos.char;
                    marker.style.position = "absolute";
                    marker.style.top = `${pos.y}px`;
                    border.appendChild(marker);
                });
            });
        };

        // Generate and add marker positions
        const positions = generateMarkerPositions();
        addMarkers(positions);

        // Add the borders to the passage container
        passageContainer.appendChild(leftBorder);
        passageContainer.appendChild(rightBorder);
    }

    // Create a MutationObserver to watch for changes in the passage container
    const observer = new MutationObserver(() => {
        updateBorders();
        setTimeout(addVerticalBorders, 200); // Small delay to ensure content has rendered
    });
    observer.observe(document.getElementById("passage-container"), {
        childList: true,
        subtree: true,
        attributes: true,
    });
});
