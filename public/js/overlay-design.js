// Shared defaults and limits keep the editor, OBS and server in agreement.
export const defaultDesign = Object.freeze({
  nameSize: 48,
  fontFamily: "arial",
  blueColor: "#1677ff",
  redColor: "#ef3340",
  textColor: "#ffffff",
  textStroke: 0.6,
  shadowOffset: 2,
  blockWidth: 650,
  centerGap: 420,
  shimmer: true
});

export const designFonts = Object.freeze({
  arial: '"Arial Black", Arial, sans-serif',
  barlow: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif',
  impact: 'Impact, "Arial Black", sans-serif'
});

export const designRanges = Object.freeze({
  nameSize: [24, 80], textStroke: [0, 2], shadowOffset: [0, 5],
  blockWidth: [400, 800], centerGap: [220, 640]
});

export function applyDesign(element, settings) {
  const design = { ...defaultDesign, ...settings };
  for (const key of Object.keys(designRanges)) element.style.setProperty(`--${key}`, design[key]);
  element.style.setProperty("--name-font", designFonts[design.fontFamily] || designFonts.arial);
  element.style.setProperty("--name-color", design.textColor);
  element.classList.toggle("has-shimmer", design.shimmer);
  for (const side of ["blue", "red"]) element.querySelector(`.${side}`).style.setProperty("--side-color", design[`${side}Color`]);
}
