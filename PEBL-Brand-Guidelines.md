# PEBL Brand Guidelines

## 1. Branding Overview

The PEBL identity is built around clean, modern, and marine-inspired visuals. The design elements reflect ecological responsibility and innovation, emphasizing the mission of **Protecting Ecology Beyond Land**.

---

## 2. Colour Scheme

The primary brand palette consists of five core colours:

### Primary Colors
- **#2B7A78** – Deep teal (primary brand colour)
- **#17252A** – Dark navy/black (supportive, strong contrast)
- **#DEF2F1** – Pale aqua (light background tone)
- **#3AAFA9** – Bright teal (highlight/accent)
- **#FFFFFF** – White (neutral background, clarity, and balance)

### Color Usage in CSS Variables
```css
:root {
  --pebl-deep-teal: #2B7A78;      /* Primary brand colour */
  --pebl-dark-navy: #17252A;      /* Dark navy/black */
  --pebl-pale-aqua: #DEF2F1;      /* Light background tone */
  --pebl-bright-teal: #3AAFA9;    /* Highlight/accent */
  --pebl-white: #FFFFFF;          /* Neutral background */
}
```

These colours should be used consistently across all brand materials for coherence.

---

## 3. Logo Usage

Two versions of the logo are provided for different applications:

- **Logo Version 1**: Full-colour usage on white/light backgrounds
- **Logo Version 2**: Inverse/dark-background compatible version

### Logo Files Location
- Located in: `/public/logos/`
- Files: `pebl-logo-1.svg`, `pebl-logo-2.svg`, etc.

### Usage Guidelines
- Always ensure proper spacing around the logo
- Avoid distortion or recolouring outside the brand palette
- Use appropriate version based on background

---

## 4. Tagline

The PEBL tagline is:
**"Protecting Ecology Beyond Land"**

This phrase should be paired with the logo or used in key communications to reinforce the brand mission.

---

## 5. Typography

### Heading Fonts
- **Heading**: Futura Bold
- **Subheading**: Futura Bold
- **Sub-subheading**: Futura Medium

### Body Text Fonts
- **Body Main**: Roboto Light
- **Body Other**: Roboto Italic (or any Roboto style for variation/emphasis)

### CSS Implementation
```css
/* PEBL Typography Hierarchy */
.pebl-heading {
  font-family: 'Futura', 'Trebuchet MS', Arial, sans-serif;
  font-weight: bold;
}

.pebl-subheading {
  font-family: 'Futura', 'Trebuchet MS', Arial, sans-serif;
  font-weight: bold;
}

.pebl-sub-subheading {
  font-family: 'Futura', 'Trebuchet MS', Arial, sans-serif;
  font-weight: 500;
}

.pebl-body-main {
  font-family: 'Roboto', Arial, sans-serif;
  font-weight: 300;
}

.pebl-body-italic {
  font-family: 'Roboto', Arial, sans-serif;
  font-style: italic;
}
```

This hierarchy ensures clarity, modernity, and accessibility in brand communications.

---

## 6. Example Applications

The guidelines provide examples of brand voice and typography usage in different contexts:

### Headings
- Marine Monitoring
- Seaweed Hatchery
- Seabed Observation
- Seafarm Observation

*Always in Futura (Bold or Medium depending on level).*

### Body Copy
*Always in Roboto (Light for standard, Italic for variation).*

**Example messaging:**
*"Seaweed grows on almost every stretch of the coast and it is packed with nutrients, proteins and many other bioactive ingredients. If we start to use more of it in our food, feed and bio-materials, we can help to tackle some of the biggest challenges facing people and planet."*

---

## 7. Tone & Messaging

The repeated use of seaweed-related content in examples reflects PEBL's ecological and marine focus. Messaging should always:

- Highlight environmental innovation
- Emphasize sustainability and circular economy
- Position PEBL as a forward-thinking ecological brand

### Key Themes
- Marine conservation
- Sustainable technology
- Ecological innovation
- Ocean energy solutions
- Environmental stewardship

---

## 8. Technical Implementation

### Tailwind CSS Configuration
```javascript
// tailwind.config.ts
colors: {
  'pebl': {
    'deep-teal': '#2B7A78',     // Primary brand colour
    'dark-navy': '#17252A',     // Dark navy/black
    'pale-aqua': '#DEF2F1',     // Light background tone
    'bright-teal': '#3AAFA9',   // Highlight/accent
    'white': '#FFFFFF',         // Neutral background
  },
}
```

### Component Usage Examples
```jsx
// Logo component
<PEBLLogo variant="horizontal" size="md" />

// Brand colors in components
<div className="bg-pebl-deep-teal text-pebl-white">
  <h1 className="font-futura font-bold">Marine Monitoring</h1>
  <p className="font-roboto font-light">Advanced ocean data analysis</p>
</div>
```

---

## 9. File Structure

```
/public/logos/
├── pebl-logo-1.svg
├── pebl-logo-2.svg
├── pebl-icon.svg
└── pebl-logo.png

/src/components/branding/
├── PEBLLogo.tsx
└── README.md

/src/styles/
├── globals.css (contains PEBL color variables)
└── typography.css (PEBL font definitions)
```

---

## 10. Brand Compliance Checklist

- [x] Colors match exact hex values from guidelines (#2B7A78, #17252A, #DEF2F1, #3AAFA9, #FFFFFF)
- [x] Typography uses Futura for headings, Roboto for body text
- [x] Logo placement follows spacing guidelines (actual SVG files loaded)
- [x] Tagline "Protecting Ecology Beyond Land" prominently featured in footer
- [x] Messaging reflects marine/ecological focus (sustainable ocean monitoring)
- [x] Visual hierarchy follows brand standards

## 11. Implementation Status

### ✅ Completed
- **Authentic PEBL brand colors applied** throughout the application
- **PEBL logo components** using actual uploaded SVG files
- **Typography hierarchy** implemented with Futura for headings, Roboto for body
- **PEBL tagline integration** in footer and navigation
- **Brand messaging** updated to reflect marine/ecological focus
- **Responsive design** maintained with new branding

### 🎯 Active Features
- Real-time marine and meteorological data visualization
- Interactive maps with PEBL-branded styling
- Charts using PEBL color palette
- Mobile-responsive design with brand consistency
- Error handling with branded messaging

### 📍 Application URL
**http://localhost:9002** - PEBL Ocean Data Platform

The application now fully complies with PEBL brand guidelines while maintaining its advanced functionality for marine data visualization and ecological monitoring.

---

*This document serves as the technical implementation guide for PEBL brand guidelines in the Ocean Data Platform application.*