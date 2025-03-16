/**
 * Utility functions for creating ASCII boxes through the server-side API
 */

/**
 * Generate an ASCII box with the given text and options
 * 
 * @param {string} message - The text to put inside the box
 * @param {Object} options - Configuration options
 * @param {string} options.border - Border style: 'single', 'double', 'code', 'round', 'dotted', 'retro', 'single-double', 'double-single'
 * @param {string} options.color - Text color: 'green', 'red', 'blue', 'cyan', 'magenta', 'gray', 'black', 'white'
 * @param {number} options.padding - Padding inside the box
 * @param {number} options.minWidth - Minimum width of the box
 * @param {number} options.maxWidth - Maximum width of the box
 * @returns {Promise<string>} - The ASCII box text
 */
export async function createAsciiBox(message, options = {}) {
  try {
    const response = await fetch('/api/ascii-box', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        ...options
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate ASCII box');
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error creating ASCII box:', error);
    return message; // Return original message if there's an error
  }
}

/**
 * Apply an ASCII box to a DOM element
 * 
 * @param {HTMLElement} element - The element to apply the box to
 * @param {Object} options - Box options (see createAsciiBox)
 * @returns {Promise<void>}
 */
export async function applyAsciiBoxToElement(element, options = {}) {
  if (!element) return;
  
  const text = element.textContent.trim();
  const boxedText = await createAsciiBox(text, options);
  
  element.style.whiteSpace = 'pre';
  element.textContent = boxedText;
}

/**
 * Convert a button to have an ASCII box border
 * 
 * @param {HTMLElement} button - The button element
 * @param {Object} options - Box options (see createAsciiBox)
 * @returns {Promise<void>}
 */
export async function createAsciiBoxButton(button, options = {}) {
  if (!button) return;
  
  // Default options for buttons
  const buttonOptions = {
    border: 'single',
    padding: 1,
    ...options
  };
  
  await applyAsciiBoxToElement(button, buttonOptions);
  
  // Add appropriate styles
  button.style.cursor = 'pointer';
  button.style.display = 'inline-block';
}

/**
 * Apply ASCII boxes to all elements with a specific class
 * 
 * @param {string} className - CSS class name to select elements
 * @param {Object} options - Box options (see createAsciiBox)
 * @returns {Promise<void>}
 */
export async function applyAsciiBoxesToClass(className, options = {}) {
  const elements = document.querySelectorAll(`.${className}`);
  const promises = [];
  
  elements.forEach(element => {
    promises.push(applyAsciiBoxToElement(element, options));
  });
  
  await Promise.all(promises);
}