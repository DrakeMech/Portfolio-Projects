/**
 * Function to set `textContext` for an element
 * @param {string} query 
 * @returns 
 */
export function textContent(query) {
  const element = document.querySelector(query);
  return (txt) => {
    if (element) {
      element.textContent = txt;
    } else {
      console.log(txt);
    }
  };
}