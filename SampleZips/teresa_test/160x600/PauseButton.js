// Created by Andrew Hatfield 01/09/2024


// Pause / Play / ISIExpand functionality:
window.MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

const observer = new MutationObserver(function(mutation) {
  // pause/play
  if (parent.$iframe.attributes.pause) {
    let pause = parent.$iframe.attributes.pause.value;
    pause === "true" ? tl.pause() : tl.play();
  }
  // expander
  if (parent.$iframe.attributes.expand) {
    let expand = parent.$iframe.attributes.expand.value;
    expand === "true" ? expandISI() : null;
  }

});

observer.observe(parent.$iframe, {
  attributes: true // this is to watch for attribute changes.
});
// observer.disconnect();