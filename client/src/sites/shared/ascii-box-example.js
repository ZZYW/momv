/**
 * Example of using the ASCII Box utilities
 * 
 * Add this script to any page and include the following HTML:
 * <div id="ascii-box-demo"></div>
 */

import { createAsciiBox, applyAsciiBoxesToClass, createAsciiBoxButton } from './ascii-box-utils.js';

// Initialize the ASCII box demo
export function initAsciiBoxDemo() {
  const demoContainer = document.getElementById('ascii-box-demo');
  if (!demoContainer) return;
  
  // Add CSS
  const linkElement = document.createElement('link');
  linkElement.rel = 'stylesheet';
  linkElement.href = '/sites/shared/ascii-box.css';
  document.head.appendChild(linkElement);
  
  // Create demo content
  demoContainer.innerHTML = `
    <h2>ASCII Box Demo</h2>
    <div class="ascii-container">
      <div class="ascii-box-example" data-border="single">Single Border</div>
      <div class="ascii-box-example" data-border="double">Double Border</div>
      <div class="ascii-box-example" data-border="round">Round Border</div>
      <div class="ascii-box-example" data-border="dotted">Dotted Border</div>
    </div>
    
    <h3>Button Examples</h3>
    <div class="ascii-container">
      <button class="ascii-button-example" data-border="single">Click Me</button>
      <button class="ascii-button-example" data-border="double" data-color="blue">Blue Button</button>
      <button class="ascii-button-example" data-border="round" data-color="green">Green Button</button>
      <button class="ascii-button-example" data-border="retro" data-color="red">Retro Red</button>
    </div>
    
    <h3>Custom Box</h3>
    <div class="ascii-container">
      <div id="custom-box"></div>
    </div>
    
    <h3>Try It</h3>
    <div style="margin: 20px 0;">
      <textarea id="ascii-text-input" style="width: 100%; height: 80px;">Type your text here</textarea>
      <div style="margin-top: 10px;">
        <label>Border Style: 
          <select id="border-style">
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="round">Round</option>
            <option value="code">Code</option>
            <option value="dotted">Dotted</option>
            <option value="retro">Retro</option>
            <option value="single-double">Single-Double</option>
            <option value="double-single">Double-Single</option>
          </select>
        </label>
        <label style="margin-left: 15px;">Color: 
          <select id="color-style">
            <option value="">Default</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
            <option value="cyan">Cyan</option>
            <option value="magenta">Magenta</option>
            <option value="gray">Gray</option>
          </select>
        </label>
        <label style="margin-left: 15px;">Padding: 
          <input type="number" id="padding-value" min="0" max="5" value="1" style="width: 40px;">
        </label>
      </div>
      <button id="generate-box" style="margin-top: 10px;">Generate Box</button>
      <div id="result-box" style="margin-top: 15px;"></div>
    </div>
  `;
  
  // Apply ASCII boxes to examples
  const boxExamples = document.querySelectorAll('.ascii-box-example');
  boxExamples.forEach(async (box) => {
    const border = box.dataset.border || 'single';
    const color = box.dataset.color;
    
    await applyAsciiBoxToElement(box, {
      border,
      color,
      padding: 1
    });
    
    box.classList.add('ascii-box');
    if (color) box.classList.add(`ascii-${color}`);
  });
  
  // Create button examples
  const buttonExamples = document.querySelectorAll('.ascii-button-example');
  buttonExamples.forEach(async (button) => {
    const border = button.dataset.border || 'single';
    const color = button.dataset.color;
    
    await createAsciiBoxButton(button, {
      border,
      padding: 1
    });
    
    button.classList.add('ascii-box-button');
    if (color) button.classList.add(`ascii-${color}`);
    
    button.addEventListener('click', () => {
      alert(`You clicked: ${button.textContent.trim()}`);
    });
  });
  
  // Create a custom box
  const customBox = document.getElementById('custom-box');
  if (customBox) {
    createAsciiBox('Welcome to Mountain of Many Voices!', {
      border: 'double-single',
      padding: 2
    }).then(boxText => {
      customBox.textContent = boxText;
      customBox.classList.add('ascii-box');
    });
  }
  
  // Set up the try-it section
  const generateButton = document.getElementById('generate-box');
  if (generateButton) {
    generateButton.addEventListener('click', async () => {
      const textInput = document.getElementById('ascii-text-input').value;
      const borderStyle = document.getElementById('border-style').value;
      const colorStyle = document.getElementById('color-style').value;
      const paddingValue = parseInt(document.getElementById('padding-value').value, 10) || 0;
      
      const resultBox = document.getElementById('result-box');
      
      const options = {
        border: borderStyle,
        padding: paddingValue
      };
      
      if (colorStyle) options.color = colorStyle;
      
      const boxText = await createAsciiBox(textInput, options);
      resultBox.textContent = boxText;
      resultBox.style.whiteSpace = 'pre';
      resultBox.classList.add('ascii-box');
      
      if (colorStyle) {
        resultBox.className = 'ascii-box';
        resultBox.classList.add(`ascii-${colorStyle}`);
      }
    });
  }
}

// Helper function referenced in the code above
async function applyAsciiBoxToElement(element, options = {}) {
  if (!element) return;
  
  const text = element.textContent.trim();
  const boxedText = await createAsciiBox(text, options);
  
  element.style.whiteSpace = 'pre';
  element.textContent = boxedText;
}